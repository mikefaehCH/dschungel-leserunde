// Only clips identified by Mike as his recordings play in the children's camp.
function voice(key) {
  return data.mikeKeys?.includes(key) ? data.clips[key] : null;
}

const animals = {
  Tukan: "tukan",
  Frosch: "frosch",
  Affe: "affe",
  Jaguar: "jaguar",
};
function picture(id) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("animal");
  svg.setAttribute("viewBox", "0 0 120 100");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(svg.namespaceURI, "use");
  use.setAttribute("href", "art/animals.svg#" + id);
  svg.append(use);
  return svg;
}

function showCompanion(page, id, progress, celebrate = false) {
  const avatar = document.querySelector("#" + page + " aside");
  let scene = avatar.closest(".companion");
  if (!scene) {
    scene = document.createElement("div");
    scene.className = "companion";
    avatar.before(scene);
    scene.append(avatar, picture(id));
  }
  scene.style.setProperty("--spot", 41 + progress * 30 + "%");
  scene.lastElementChild.classList.toggle("pose-pop", celebrate);
}

const trailLengths = { Tukan: 5, Frosch: 6, Affe: 4, Jaguar: 4 };
function progressFor(family, name) {
  const found = family.stickers.includes(name);
  const saved = family.expeditions?.[name];
  return {
    steps: saved?.current ?? (found ? 0 : saved?.steps || 0),
    rounds: Math.max(found ? 1 : 0, saved?.rounds || 0),
  };
}
async function recordStep(name, step) {
  const finished = step === trailLengths[name];
  if (!db && !finished) return;
  if (!db) throw Error("Der Fund kann gerade nicht gespeichert werden.");
  // Merge into the latest family record, including recordings made in another tab.
  let newBadges = [];
  await new Promise((resolve, reject) => {
    const tx = db.transaction("app", "readwrite");
    const store = tx.objectStore("app");
    const read = store.get("family");
    let updated;
    read.onsuccess = () => {
      const latest = read.result || data;
      const previous = progressFor(latest, name);
      updated = {
        ...latest,
        stickers: finished
          ? [...new Set([...latest.stickers, name])]
          : latest.stickers,
        expeditions: {
          ...latest.expeditions,
          [name]: {
            steps: Math.max(latest.expeditions?.[name]?.steps || 0, step),
            current: finished ? 0 : step,
            syllable: name === "Tukan" ? target : null,
            rounds: previous.rounds + Number(finished),
          },
        },
      };
      const kind =
        name === "Tukan" && step === 1
          ? "Teilnahme"
          : name === "Tukan" && step === 4
            ? "Spur"
            : name === "Tukan" && step === 5
              ? "Wortaufgabe"
              : "Übung";
      const mode = attempt.help
        ? "mit Hilfe"
        : attempt.misses
          ? "nach einem weiteren Versuch"
          : "im ersten Versuch";
      const label = name + " · " + kind + " · " + mode;
      updated.observations = {
        ...latest.observations,
        [label]: (latest.observations?.[label] || 0) + 1,
      };
      if (finished) {
        const before = badgesFor(latest);
        newBadges = badgesFor(updated).filter(
          (badge, index) =>
            badge[2] >= badge[3] && before[index][2] < before[index][3],
        );
      }
      store.put(updated, "family");
    };
    tx.oncomplete = () => {
      data = updated;
      resolve();
    };
    tx.onabort = () =>
      reject(Error("Der Fund konnte nicht gespeichert werden."));
  });
  markDiscoveries();
  if (newBadges.length) {
    const notice = $("newAward");
    notice.textContent =
      "Abzeichen entdeckt · " + newBadges.map((b) => b[1]).join(" + ");
    notice.hidden = false;
  }
}
function markDiscoveries() {
  $("bookCount").textContent =
    Object.keys(animals).filter((name) => data.stickers.includes(name)).length +
    " / 4 Tiere";
  for (const [name, id] of Object.entries(animals)) {
    document
      .querySelector(".place." + id)
      .classList.toggle("found", data.stickers.includes(name));
  }
}
function badgesFor(family) {
  const count = Object.keys(animals).filter((name) =>
    family.stickers.includes(name),
  ).length;
  const mostRounds = Math.max(
    ...Object.keys(animals).map((name) => progressFor(family, name).rounds),
  );
  return [
    ["blatt", "Erster Fund", count, 1, "Entdecke ein Tier."],
    ["feder", "Tierduo", count, 2, "Entdecke zwei Tiere."],
    [
      "stern",
      "Wieder da",
      mostRounds,
      2,
      "Spiele zweimal mit demselben Tier bis zum Ende.",
    ],
    ["kompass", "Camp-Profi", count, 4, "Entdecke alle vier Tiere."],
  ];
}
function showFinds() {
  $("finds").replaceChildren();
  const discovered = Object.keys(animals).filter((name) =>
    data.stickers.includes(name),
  );
  $("bookText").textContent =
    discovered.length + " von 4 Tierfreunden entdeckt";
  for (const [name, id] of Object.entries(animals)) {
    const { steps, rounds } = progressFor(data, name);
    const total = trailLengths[name];
    const stamp = document.createElement("button");
    stamp.className = "album-card" + (rounds ? " collected" : "");
    const caption = document.createElement("strong");
    caption.textContent = name;
    const track = document.createElement("span");
    track.className = "step-track";
    track.setAttribute("aria-hidden", "true");
    for (let i = 0; i < total; i++) {
      const leaf = document.createElement("i");
      if (i < steps || (!steps && rounds)) leaf.className = "filled";
      track.append(leaf);
    }
    const status = document.createElement("small");
    status.textContent = rounds
      ? rounds +
        (rounds === 1 ? " Runde" : " Runden") +
        (steps ? " · " + steps + " / " + total : "")
      : steps + " von " + total + " Schritten";
    stamp.append(picture(id), caption, track, status);
    stamp.onclick = () => {
      if (!steps) {
        startAnimal(name);
        return;
      }
      if (name === "Tukan") {
        navigate("game");
        target = data.expeditions?.Tukan?.syllable || "ma";
        stage = steps + 1;
        render();
        cue();
      } else if (name === "Frosch") {
        navigate("frog");
        frogIndex = steps;
        showFrog();
      } else {
        startAnimal(name, steps);
      }
    };
    $("finds").append(stamp);
  }
  const badges = badgesFor(data);
  $("awards").replaceChildren();
  for (const [icon, title, count, goal, description] of badges) {
    const badge = document.createElement("div");
    badge.className = "badge" + (count >= goal ? " earned" : "");
    const emblem = picture(icon);
    emblem.firstElementChild.setAttribute("href", "art/abzeichen.svg#" + icon);
    const label = document.createElement("strong");
    label.textContent = title;
    const status = document.createElement("small");
    status.textContent =
      count >= goal ? "✓ Geschafft" : Math.min(count, goal) + " / " + goal;
    badge.setAttribute(
      "aria-label",
      title + ". " + description + " " + status.textContent,
    );
    badge.append(emblem, label, status);
    $("awards").append(badge);
  }
  const next = badges.find(([, , count, goal]) => count < goal);
  $("bookGoal").textContent = next
    ? "Nächstes Abzeichen · " + next[4]
    : "Alle Abzeichen sind da!";
}
const adventures = {
  Affe: {
    syllable: "ma",
    other: "mi",
    story: "Über den Bach",
    unit: "Stein",
    start: "M A",
    ending: "Am anderen Ufer!",
  },
  Jaguar: {
    syllable: "mi",
    other: "ma",
    story: "Die Spur im Sand",
    unit: "Spur",
    start: "M I",
    ending: "Die Lichtung gefunden!",
  },
};
let animalName,
  step,
  errors,
  letters,
  complete,
  repeatCount = 0;
function startAnimal(name, firstStep = 0) {
  if (name === "Tukan" || name === "Frosch") {
    navigate(name === "Tukan" ? "game" : "frog");
    return;
  }
  navigate("trail");
  animalName = name;
  step = firstStep;
  repeatCount = 0;
  renderTrail();
}
function trailHelp() {
  attempt.help = true;
  const a = adventures[animalName];
  $("model").textContent = a.syllable.toUpperCase();
  visualHint(
    "trailChoices",
    step === 3 ? a.syllable[letters.length] : a.syllable,
    2,
  );
  msg(
    step === 3
      ? "Erst M. Dann " + a.syllable[1] + "."
      : "Finde " + a.syllable + ".",
  );
  if (voice(a.syllable)) play(a.syllable);
}
function sandTrack() {
  const pad = document.createElement("div");
  pad.className = "sand";
  const guide = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  guide.setAttribute("viewBox", "0 0 210 70");
  guide.setAttribute("aria-label", "Fahre das M und I im Sand nach");
  guide.innerHTML =
    '<path d="M28 56V13L53 46L79 13V56 M143 13V56" fill="none" stroke="#916e40" stroke-width="10" stroke-linecap="round"/><circle cx="28" cy="56" r="6" fill="#234e40"/>';
  let stroke;
  function mark(e) {
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      guide.getScreenCTM().inverse(),
    );
    stroke.setAttribute(
      "points",
      (stroke.getAttribute("points") || "") + " " + point.x + "," + point.y,
    );
  }
  guide.onpointerdown = (e) => {
    if (!e.isPrimary) return;
    guide.setPointerCapture(e.pointerId);
    stroke = document.createElementNS(guide.namespaceURI, "polyline");
    stroke.setAttribute("fill", "none");
    stroke.setAttribute("stroke", "#225b4a");
    stroke.setAttribute("stroke-width", "5");
    guide.append(stroke);
    mark(e);
  };
  guide.onpointermove = (e) => {
    if (stroke && e.isPrimary) mark(e);
  };
  guide.onpointerup = guide.onpointercancel = () => {
    stroke = null;
  };
  pad.append(guide);
  return pad;
}
function renderTrail() {
  resetAttempt();
  stop();
  msg();
  errors = 0;
  letters = "";
  complete = false;
  const a = adventures[animalName],
    ended = step === 4;
  $("trailChoices").replaceChildren();
  $("trailTools").replaceChildren();
  $("trailTitle").textContent = ended ? a.ending : a.story;
  $("trailStep").textContent = ended
    ? "Entdeckt"
    : a.unit + " " + (step + 1) + " / 4";
  $("friend").replaceChildren(picture(animals[animalName]));
  $("friend").style.setProperty("--spot", 40 + step * 8 + "%");
  document.querySelector("#trail aside").dataset.pose = ended
    ? "book"
    : step === 3
      ? "talk"
      : "listen";
  $("model").textContent = ended
    ? "✓"
    : step === 3
      ? a.start
      : animalName === "Jaguar"
        ? a.syllable.toUpperCase() + " · · ·"
        : voice(a.syllable)
          ? "◖))"
          : a.syllable.toUpperCase();
  if (ended) {
    btn("trailTools", "↻ Nochmals", () => startAnimal(animalName));
    btn("trailTools", "▤ Forscherbuch", () => navigate("book"));
    return;
  }
  if (animalName === "Affe" && step < 3 && !voice(a.syllable)) {
    $("model").replaceChildren(illustration("maler"));
    $("trailTitle").textContent = "Wie beginnt Maler?";
  }
  if (animalName === "Jaguar" && step < 3) {
    $("model").replaceChildren(sandTrack());
    $("trailTitle").textContent = "Folge der Spur";
  }
  const assemble = step === 3;
  const choices = assemble
    ? [a.syllable[1], "m"]
    : (step + repeatCount) % 2
      ? [a.syllable, a.other]
      : [a.other, a.syllable];
  for (const choice of mixed(choices))
    btn("trailChoices", choice.toUpperCase(), () => {
      if (complete) return;
      const expected = assemble ? a.syllable[letters.length] : a.syllable;
      if (choice !== expected) {
        errors++;
        visualHint("trailChoices", expected, errors);
        $("model").textContent = assemble
          ? (letters || "＿") + " · " + expected
          : a.syllable;
        msg(
          errors > 1
            ? "Tippe auf " + expected + "."
            : animalName === "Affe"
              ? "Schau auf den Stein."
              : "Schau auf die Spur.",
        );
        if (voice(a.syllable)) play(a.syllable);
        return;
      }
      if (assemble) {
        letters += choice;
        $("model").textContent = letters + (letters.length === 1 ? " ＿" : "");
        if (letters.length < 2) return;
      }
      complete = true;
      $("model").textContent = a.syllable + " ✓";
      $("friend").style.setProperty("--spot", 48 + step * 8 + "%");
      $("friend").firstElementChild.classList.add("pose-pop");
      $("trailTools").lastElementChild.disabled = false;
      msg(
        animalName === "Affe" ? "Ein Stein geschafft!" : "Eine Spur gefunden!",
      );
      if (voice(a.syllable)) play(a.syllable);
    });
  if (voice(a.syllable))
    btn("trailTools", "◖)) Anhören", () => play(a.syllable));
  btn("trailTools", "? Hilfe", trailHelp);
  btn("trailTools", "↻ Nochmals", () => {
    repeatCount++;
    renderTrail();
  });
  btn(
    "trailTools",
    step === 3 ? "✓ Fund" : "➜ Weiter",
    protect(async () => {
      if (!complete) return;
      await recordStep(animalName, step + 1);
      step++;
      renderTrail();
    }),
  );
  $("trailTools").lastElementChild.disabled = true;
  if (voice(a.syllable)) play(a.syllable);
}
$("monkeyLink").onclick = () => startAnimal("Affe");
$("catLink").onclick = () => startAnimal("Jaguar");
