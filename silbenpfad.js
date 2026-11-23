const practiceKey = "silbenpfad:v1";
const practicePaths = {
  MA: { letters: ["M", "A"], other: "MI", word: "MAMA", otherWord: "MIMI" },
  MI: { letters: ["M", "I"], other: "MA", word: "MIMI", otherWord: "MAMA" },
  LA: { letters: ["L", "A"], other: "MA", word: "LAMA", otherWord: "MAMA" },
};
let practiceData = {},
  practiceTarget,
  practiceBusy = false;

async function openPractice() {
  navigate("practice");
  try {
    if (db) practiceData = (await readPost(practiceKey)) || {};
  } catch {
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
  const controls = [...$("practice").querySelectorAll("button")].map(
    (button) => [button, button.disabled],
  );
  controls.forEach(([button]) => (button.disabled = true));
  try {
    if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("app", "readwrite");
        const store = tx.objectStore("app");
        const req = store.get(practiceKey);
        let updated;
        req.onsuccess = () => {
          updated = req.result || {};
          change(updated);
          store.put(updated, practiceKey);
        };
        tx.oncomplete = () => {
          practiceData = updated;
          resolve();
        };
        tx.onabort = () =>
          reject(Error("Dein Weg konnte nicht gespeichert werden."));
      });
    } else {
      change(practiceData);
    }
    if (!$("practice").hidden) next();
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
  const saved = practiceData[target];
  if (saved?.active) {
    practiceTask();
    return;
  }
  savePractice((state) => {
    const path = state[target] || {};
    // Reuse an active session created in another tab.
    if (!path.active) path.active = { id: crypto.randomUUID(), step: 0 };
    state[target] = path;
  }, practiceTask);
}
function practiceTask() {
  $("practiceModel").classList.remove("pose-pop");
  const target = practiceTarget,
    path = practicePaths[target];
  const active = practiceData[target]?.active;
  if (!active) {
    practiceHub();
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
  practiceProgress(index);
  $("practiceModel").textContent = building
    ? "＿ ＿"
    : !reading && voice(target.toLowerCase())
      ? "◖))"
      : target;
  document
    .querySelector("#practice .companion")
    .style.setProperty("--spot", 40 + index * 8 + "%");
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
      scene.style.setProperty("--spot", 48 + index * 8 + "%");
      scene.lastElementChild.classList.add("pose-pop");
      practiceProgress(index + 1);
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
    index === 4 ? "Mein Silbenfund" : "Weiter",
    () => {
      if (!solved) return;
      savePractice(
        (state) => {
          const saved = state[target];
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
          practiceData[target]?.active ? practiceTask() : practiceFinish(),
      );
    },
    "practiceTools",
  );
  next.disabled = true;
  if (!reading && voice(target.toLowerCase())) play(target.toLowerCase());
  practiceButton("Zu meinen Silben", practiceHub, "practiceTools");
}
function practiceFinish() {
  practicePanel("Dein Silbenfund", "Du hast mit " + practiceTarget + " geübt.");
  practiceProgress(5);
  $("practiceModel").textContent = practiceTarget;
  practiceButton("Nochmals", () => startPractice(practiceTarget));
  practiceButton("Andere Silbe", practiceHub);
  practiceButton("Forscherbuch", () => navigate("book"));
  practiceButton("Für heute fertig", () => navigate("home"), "practiceTools");
}
$("practiceLink").onclick = openPractice;
$("practiceBook").onclick = openPractice;
