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

async function collect(name) {
  if (!db) throw Error("Der Fund kann gerade nicht gespeichert werden.");
  // Merge into the latest family record, including recordings made in another tab.
  await new Promise((resolve, reject) => {
    const tx = db.transaction("app", "readwrite");
    const store = tx.objectStore("app");
    const read = store.get("family");
    let updated;
    read.onsuccess = () => {
      const latest = read.result || data;
      updated = {
        ...latest,
        stickers: [...new Set([...latest.stickers, name])],
      };
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
}
function markDiscoveries() {
  for (const [name, id] of Object.entries(animals)) {
    document
      .querySelector(".place." + id)
      .classList.toggle("found", data.stickers.includes(name));
  }
}
function showFinds() {
  $("finds").replaceChildren();
  for (const name of data.stickers.filter((name) => animals[name])) {
    const stamp = document.createElement("button");
    stamp.className = "stamp";
    stamp.append(picture(animals[name]), document.createTextNode(name));
    stamp.onclick = () => startAnimal(name);
    $("finds").append(stamp);
  }
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
function startAnimal(name) {
  if (name === "Tukan" || name === "Frosch") {
    navigate(name === "Tukan" ? "game" : "frog");
    return;
  }
  navigate("trail");
  animalName = name;
  step = 0;
  repeatCount = 0;
  renderTrail();
}
function trailHelp() {
  const a = adventures[animalName];
  $("model").textContent = a.syllable.toUpperCase();
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
  for (const choice of choices)
    btn("trailChoices", choice.toUpperCase(), () => {
      if (complete) return;
      const expected = assemble ? a.syllable[letters.length] : a.syllable;
      if (choice !== expected) {
        errors++;
        $("model").textContent = assemble
          ? (letters || "＿") + " · " + expected
          : a.syllable;
        msg(errors > 1 ? "Tippe auf " + expected + "." : "Schau auf die Spur.");
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
      if (step === 3) await collect(animalName);
      step++;
      renderTrail();
    }),
  );
  $("trailTools").lastElementChild.disabled = true;
  if (voice(a.syllable)) play(a.syllable);
}
$("monkeyLink").onclick = () => startAnimal("Affe");
$("catLink").onclick = () => startAnimal("Jaguar");
init().then(markDiscoveries);
