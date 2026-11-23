const practiceKey = "silbenpfad:v1";
const practicePaths = {
  MA: { letters: ["M", "A"], other: "MI", word: "MAMA", otherWord: "MIMI" },
  MI: { letters: ["M", "I"], other: "MA", word: "MIMI", otherWord: "MAMA" },
  LA: { letters: ["L", "A"], other: "MA", word: "LAMA", otherWord: "MAMA" },
};
let practiceData = {},
  practiceTarget,
  practiceBusy = false,
  practiceStory = null,
  practiceVisit = 0;

async function openPractice() {
  if (practiceBusy) return;
  const visit = ++practiceVisit;
  practiceStory = null;
  navigate("practice");
  setStoryScene(null, 0);
  try {
    const saved = db ? (await readPost(practiceKey)) || {} : practiceData;
    if (visit !== practiceVisit || $("practice").hidden) return;
    practiceData = saved;
  } catch {
    if (visit !== practiceVisit) return;
    practiceData = {};
  }
  if (!$("practice").hidden) practiceHub();
}
function practiceButton(label, action, container = "practiceChoices") {
  btn(container, label, action);
  return $(container).lastElementChild;
}
function practicePanel(title, hint) {
  stop();
  msg();
  $("practiceTitle").textContent = title;
  $("practiceHint").textContent = hint;
  $("practiceModel").replaceChildren();
  $("practiceChoices").replaceChildren();
  $("practiceTools").replaceChildren();
}
function practiceProgress(count) {
  const track = $("practiceTrack");
  track.replaceChildren();
  track.setAttribute("aria-label", count + " von 5 Stationen");
  for (let i = 0; i < 5; i++) {
    const leaf = document.createElement("span");
    leaf.textContent = i < count ? "●" : "○";
    leaf.setAttribute("aria-hidden", "true");
    track.append(leaf);
  }
}
function practiceHub() {
  practicePanel("Mein Silbenpfad", "Wähle eine Silbe.");
  practiceProgress(0);
  for (const target of Object.keys(practicePaths)) {
    const saved = practiceData[target] || {};
    const card = practiceButton("", () => startPractice(target));
    card.className = "syllable-card";
    const name = document.createElement("strong");
    name.textContent = target;
    const detail = document.createElement("small");
    detail.textContent = saved.active
      ? saved.active.step + " / 5 · Weiter"
      : saved.rounds
        ? saved.rounds +
          (saved.rounds === 1
            ? " Weg geschafft · Nochmals"
            : " Wege geschafft · Nochmals")
        : "Los geht’s";
    card.append(name, detail);
  }
  practiceButton("Forscherbuch", () => navigate("book"), "practiceTools");
}
// Separate progress records preserve existing family recordings and animal finds.
async function savePractice(change, next) {
  if (practiceBusy) return;
  practiceBusy = true;
  const visit = practiceVisit;
  const story = practiceStory;
  const storageKey = story ? journeyKey : practiceKey;
  const controls = [...$("practice").querySelectorAll("button")].map(
    (button) => [button, button.disabled],
  );
  controls.forEach(([button]) => (button.disabled = true));
  try {
    if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("app", "readwrite");
        const store = tx.objectStore("app");
        const req = store.get(storageKey);
        let updated;
        req.onsuccess = () => {
          updated = req.result || {};
          change(updated);
          store.put(updated, storageKey);
        };
        tx.oncomplete = () => {
          if (visit === practiceVisit) practiceData = updated;
          if (story) {
            journeyProgress = updated;
            renderJourney();
          }
          resolve();
        };
        tx.onabort = () =>
          reject(Error("Dein Weg konnte nicht gespeichert werden."));
      });
    } else {
      change(practiceData);
    }
    if (visit === practiceVisit && !$("practice").hidden) next();
    if (!db) msg("Dieser Weg bleibt nur bis zum Neuladen erhalten.");
  } catch (e) {
    msg(e.message);
  } finally {
    controls.forEach(([button, disabled]) => {
      if (button.isConnected) button.disabled = disabled;
    });
    practiceBusy = false;
  }
}
function startPractice(target) {
  if (practiceBusy) return;
  practiceTarget = target;
  const entryKey = practiceStory?.id || target;
  const saved = practiceData[entryKey];
  if (saved?.active) {
    practiceTask();
    return;
  }
  savePractice((state) => {
    const path = state[entryKey] || {};
    // Reuse an active session created in another tab.
    if (!path.active) path.active = { id: crypto.randomUUID(), step: 0 };
    state[entryKey] = path;
  }, practiceTask);
}
function practiceTask() {
  $("practiceModel").classList.remove("pose-pop");
  const target = practiceTarget,
    path = practicePaths[target];
  const entryKey = practiceStory?.id || target;
  const active = practiceData[entryKey]?.active;
  if (!active) {
    if (practiceStory) practiceFinish();
    else practiceHub();
    return;
  }
  const index = active.step,
    session = active.id;
  const building = index === 3,
    reading = index === 4;
  let built = "",
    mistakes = 0,
    helped = false,
    solved = false;
  practicePanel(
    reading
      ? "Die Silbe im Wort"
      : building
        ? "Baue die Silbe"
        : "Ein Schritt weiter",
    reading
      ? "In welchem Wort steckt " + target + "?"
      : building
        ? "Erst " + path.letters[0] + ", dann " + path.letters[1] + "."
        : voice(target.toLowerCase())
          ? "Höre hin. Welche Silbe passt?"
          : "Finde die gleiche Silbe.",
  );
  if (practiceStory) {
    $("practiceTitle").textContent = practiceStory.title;
    $("practiceHint").textContent = practiceStory.scenes[index];
  }
  setStoryScene(practiceStory, index);
  practiceProgress(index);
  $("practiceModel").textContent = building
    ? "＿ ＿"
    : !reading && voice(target.toLowerCase())
      ? "◖))"
      : target;
  document
    .querySelector("#practice .companion")
    .style.setProperty(
      "--spot",
      (practiceStory ? 32 + index * 5 : 40 + index * 8) + "%",
    );
  const options = building
    ? path.letters
    : reading
      ? [path.word, path.otherWord]
      : [target, path.other];
  const buttons = [];
  function hint() {
    if (solved) return;
    helped = true;
    if (building) {
      $("practiceModel").textContent = (built || "＿") + " " + path.letters[1];
    } else {
      $("practiceModel").textContent = target;
    }
    for (const button of buttons) {
      const expected = building
        ? path.letters[built.length]
        : reading
          ? path.word
          : target;
      button.classList.toggle("guide", button.textContent === expected);
    }
    if (voice(target.toLowerCase())) play(target.toLowerCase());
  }
  for (const answer of mixed(options)) {
    const button = practiceButton(answer, () => {
      if (solved) return;
      const expected = building
        ? path.letters[built.length]
        : reading
          ? path.word
          : target;
      if (answer !== expected) {
        mistakes++;
        button.classList.add("miss");
        $("practiceModel").textContent = building
          ? (built || "＿") + " ＿"
          : target;
        msg(
          building
            ? "Schau auf den nächsten Buchstaben."
            : "Schau auf " + target + ".",
        );
        if (mistakes >= 2) hint();
        return;
      }
      if (building) {
        built += answer;
        $("practiceModel").textContent =
          built + (built.length === 1 ? " ＿" : "");
        buttons.forEach((b) => b.classList.remove("guide"));
        if (built.length < 2) return;
      }
      solved = true;
      buttons.forEach((b) => (b.disabled = true));
      $("practiceModel").textContent = reading ? path.word : target;
      $("practiceModel").classList.add("pose-pop");
      const scene = document.querySelector("#practice .companion");
      scene.style.setProperty(
        "--spot",
        (practiceStory ? 37 + index * 5 : 48 + index * 8) + "%",
      );
      scene.querySelector(".animal").classList.add("pose-pop");
      practiceProgress(index + 1);
      setStoryScene(practiceStory, index + 1);
      next.disabled = false;
      msg("Ein Schritt geschafft!");
    });
    buttons.push(button);
  }
  if (voice(target.toLowerCase()))
    practiceButton(
      "Anhören",
      () => play(target.toLowerCase()),
      "practiceTools",
    );
  practiceButton("Hilfe", hint, "practiceTools");
  practiceButton("Nochmals", practiceTask, "practiceTools");
  const next = practiceButton(
    index === 4
      ? practiceStory
        ? "Mein Tierfund"
        : "Mein Silbenfund"
      : "Weiter",
    () => {
      if (!solved) return;
      savePractice(
        (state) => {
          const saved = state[entryKey];
          if (saved?.active?.id !== session || saved.active.step !== index)
            return;
          saved.observations ||= { first: 0, retry: 0, helped: 0 };
          const mode = helped ? "helped" : mistakes ? "retry" : "first";
          saved.observations[mode]++;
          if (index === 4) {
            saved.rounds = (saved.rounds || 0) + 1;
            delete saved.active;
          } else saved.active.step++;
        },
        () =>
          practiceData[entryKey]?.active ? practiceTask() : practiceFinish(),
      );
    },
    "practiceTools",
  );
  next.disabled = true;
  if (practiceStory) {
    const clip = storyClip(practiceStory, index);
    practiceButton("Geschichte anhören", () => play(clip), "practiceTools");
    play(clip);
    practiceButton(
      "Zum Dschungelpfad",
      () => showJourneyPath(practiceStory.id),
      "practiceTools",
    );
  } else {
    if (!reading && voice(target.toLowerCase())) play(target.toLowerCase());
    practiceButton("Zu meinen Silben", practiceHub, "practiceTools");
  }
}
function practiceFinish() {
  practicePanel(
    practiceStory ? practiceStory.ending : "Dein Silbenfund",
    practiceStory
      ? practiceStory.scenes[5]
      : "Du hast mit " + practiceTarget + " geübt.",
  );
  setStoryScene(practiceStory, 5);
  practiceProgress(5);
  $("practiceModel").textContent = practiceTarget;
  practiceButton("Nochmals", () => startPractice(practiceTarget));
  if (practiceStory) {
    play(storyClip(practiceStory, 5));
    practiceButton("Geschichte anhören", () =>
      play(storyClip(practiceStory, 5)),
    );
    practiceButton("Zum Dschungelpfad", () =>
      showJourneyPath(practiceStory.id),
    );
  } else {
    const film = { MA: "mama", MI: "mimi", LA: "lama" }[practiceTarget];
    if (film)
      practiceButton("Film anschauen", () => openKino(film)).classList.add(
        "kino-reward",
      );
    practiceButton("Andere Silbe", practiceHub);
  }
  practiceButton("Forscherbuch", () => navigate("book"));
  practiceButton("Für heute fertig", () => navigate("home"), "practiceTools");
}
$("practiceLink").onclick = () => openPractice();
$("practiceBook").onclick = () => openPractice();
