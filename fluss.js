let attempt = { help: false, misses: 0 };
function resetAttempt() {
  attempt = { help: false, misses: 0 };
}
function mixed(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function visualHint(container, expected, level) {
  attempt.misses++;
  const box = $(container);
  box.classList.remove("ripple");
  void box.offsetWidth;
  box.classList.add("ripple");
  if (level >= 2)
    for (const button of box.querySelectorAll("button"))
      button.classList.toggle(
        "guide",
        button.textContent.toUpperCase() === expected.toUpperCase(),
      );
}
function watchTrace(svg, done) {
  const points = [...svg.querySelectorAll("path")].flatMap((path) =>
    Array.from({ length: 16 }, (_, i) => {
      const p = path.getPointAtLength((path.getTotalLength() * i) / 15);
      return p
        .matrixTransform(path.getCTM())
        .matrixTransform(svg.getCTM().inverse());
    }),
  );
  const covered = new Set();
  function mark(e) {
    if (!e.buttons) return;
    const pos = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      svg.getScreenCTM().inverse(),
    );
    points.forEach((p, i) => {
      if (Math.hypot(p.x - pos.x, p.y - pos.y) < 15) covered.add(i);
    });
    if (
      covered.size >= points.length * 0.7 &&
      covered.has(0) &&
      covered.has(points.length - 1)
    )
      done();
  }
  svg.addEventListener("pointermove", mark);
  svg.addEventListener("pointerdown", mark);
}
const riverKey = "fluss:v1";
let river = {},
  pendingRiver = false,
  fireTimer;
function stopFire() {
  clearInterval(fireTimer);
  fireTimer = null;
}
function illustration(id) {
  if (Object.values(animals).includes(id)) return picture(id);
  const pic = picture(id);
  pic.firstElementChild.setAttribute("href", "art/fund.svg#" + id);
  return pic;
}
function riverButton(label, act, icon, where = "riverActions") {
  const b = document.createElement("button");
  b.type = "button";
  if (icon) b.append(illustration(icon));
  b.append(document.createTextNode(label));
  b.onclick = act;
  $(where).append(b);
  return b;
}
function panel(title, hint, icon) {
  stopFire();
  stop();
  msg();
  $("riverBoard").className = "";
  $("riverBoard").replaceChildren();
  $("riverActions").replaceChildren();
  $("riverTitle").textContent = title;
  $("riverHint").textContent = hint;
  const avatar = document.createElement("aside");
  avatar.dataset.pose = "book";
  avatar.setAttribute("aria-label", "Emilia mit ihrem Forscherbuch");
  avatar.setAttribute("role", "img");
  $("riverScene").replaceChildren(avatar, illustration(icon));
  if (icon === "affe") {
    const scope = document.createElement("span");
    scope.className = "telescope";
    scope.setAttribute("aria-hidden", "true");
    $("riverScene").append(scope);
  }
  $("riverScene").className = "";
}
async function updateRiver(change, next) {
  if (pendingRiver) return;
  pendingRiver = true;
  try {
    if (!db) throw Error("Der Flussfund braucht lokalen Speicher.");
    await new Promise((ok, no) => {
      const tx = db.transaction("app", "readwrite"),
        store = tx.objectStore("app"),
        req = store.get(riverKey);
      let fresh;
      req.onsuccess = () => {
        fresh = req.result || {};
        change(fresh);
        store.put(fresh, riverKey);
      };
      tx.oncomplete = () => {
        river = fresh;
        ok();
      };
      tx.onabort = () =>
        no(Error("Speichern fehlgeschlagen. Bitte nochmals versuchen."));
    });
    if (!$("river").hidden) next();
  } catch (e) {
    msg(e.message);
  } finally {
    pendingRiver = false;
  }
}
async function openRiver(album = false) {
  navigate("river");
  panel("Am Fluss", "", "tukan");
  try {
    river = (await readPost(riverKey)) || {};
  } catch {
    river = {};
  }
  if (!$("river").hidden) (album ? fundPage : riverHub)();
}
function mapFragment() {
  const count = postAlbum.count;
  const route = document.createElement("div");
  route.className = "treasure";
  route.setAttribute(
    "aria-label",
    Math.min(count, 5) + " von fünf Kartenstücken",
  );
  for (let i = 0; i < 5; i++) {
    const tile = document.createElement("span");
    tile.className = i < count ? "charted" : "fog";
    tile.style.backgroundPosition = i * 25 + "% center";
    tile.textContent = i < count ? "" : "?";
    route.append(tile);
  }
  $("riverBoard").append(route);
  const label = document.createElement("small");
  label.className = "map-note";
  label.textContent =
    count >= 5
      ? "Der Wasserfall ist entdeckt."
      : Math.min(count, 5) + " / 5 Tiermarken · Zum Wasserfall";
  $("riverBoard").append(label);
}
function riverHub() {
  const step = river.chapter || 0;
  panel(
    "Das Geheimnis am Fluss",
    [
      "Was glitzert im Wasser?",
      "Der Tukan hat einen Zettel.",
      "Was spiegelt sich im Bach?",
      "Du kennst das Geheimnis.",
    ][step],
    ["tukan", "affe", "ohren", "glocke"][step],
  );
  riverButton(
    ["Der erste Stein", "Der Zettel", "Das Glitzern", "Mein Fund"][step],
    [slide, wordScene, recap, fundPage][step],
    ["affe", "tukan", "spur", "glocke"][step],
  );
  if (step > 0) riverButton("Nochmals zum Bach", slide, "affe");
  if (step === 3) {
    riverButton("Meine Schatzkarte", atlas, "spur");
    riverButton("Forscherrätsel", family);
    riverButton("Lagerfeuer", () => fire(0), "feuer");
  }
}
function slide() {
  panel("Der erste Stein", "Bring M zu A.", "affe");
  const board = $("riverBoard");
  board.className = "liane";
  let armed = false,
    ended = false;
  const m = riverButton(
    "M",
    () => {
      if (!ended) {
        armed = true;
        m.classList.add("guide");
        a.classList.add("guide");
      }
    },
    null,
    "riverBoard",
  );
  const a = riverButton("A", join, null, "riverBoard");
  function join() {
    if (ended) return;
    if (!armed) {
      m.classList.add("guide");
      return;
    }
    ended = true;
    board.className = "";
    board.textContent = "MA";
    $("riverScene").className = "stone";
    const stone = document.createElement("span");
    stone.className = "stepping-stone";
    stone.textContent = "MA";
    $("riverScene").append(stone);
    if (voice("fluss-gleiten") || voice("ma"))
      play(voice("fluss-gleiten") ? "fluss-gleiten" : "ma");
    $("riverHint").textContent = "Ein Stein! Wer darf hinüber?";
    if (voice("ma")) riverButton("MA anhören", () => play("ma"));
    for (const [name, clue] of [
      ["Affe", "spur"],
      ["Frosch", "ohren"],
    ])
      riverButton(
        name,
        () =>
          updateRiver(
            (s) => {
              s.chapter = Math.max(1, s.chapter || 0);
              s.clues = [...new Set([...(s.clues || []), clue])];
              s.clue = clue;
            },
            () => discovery(clue),
          ),
        animals[name],
      );
  }
  m.onpointerdown = (e) => {
    armed = true;
    m.setPointerCapture(e.pointerId);
    a.classList.add("guide");
  };
  m.onpointerup = (e) => {
    if (document.elementFromPoint(e.clientX, e.clientY) === a) join();
  };
}
function discovery(clue) {
  panel(
    clue === "spur" ? "Zwei Zehen" : "Zwei Ohren",
    clue === "spur"
      ? "Der Affe schaut durchs falsche Ende!"
      : "Im Wasser wackeln lange Ohren.",
    clue,
  );
  riverButton("Zettel öffnen", wordScene);
  riverButton("Für heute fertig", () => navigate("home"));
}
function wordScene() {
  panel("Der Zettel", "Öffne die beiden Falten.", "tukan");
  let folded = 0,
    errors = 0,
    helped = false;
  const board = $("riverBoard");
  board.className = "";
  function unfold() {
    board.replaceChildren();
    if (folded < 2) {
      riverButton(
        folded ? "LA · ▸" : "▸",
        () => {
          folded++;
          unfold();
        },
        null,
        "riverBoard",
      );
      return;
    }
    board.textContent = "LAMA";
    $("riverHint").textContent = "Wen suchen wir?";
    for (const id of mixed(["lama", "lampe"])) {
      const b = riverButton(
        "",
        () => {
          if (id !== "lama") {
            errors++;
            b.classList.add("miss");
            if (errors > 1) {
              board.innerHTML = "LA · <strong>MA</strong>";
              helped = true;
            }
            msg("Lies den zweiten Teil.");
            return;
          }
          const mode = helped ? "guided" : errors ? "retry" : "first";
          updateRiver(
            (s) => {
              s.chapter = Math.max(s.chapter || 0, 2);
              s.readings = {
                ...s.readings,
                [mode]: (s.readings?.[mode] || 0) + 1,
              };
            },
            () => {
              panel(
                "Ein langes Ohr!",
                "Der Affe dreht sein Fernrohr um.",
                "ohren",
              );
              if (voice("fluss-lama")) play("fluss-lama");
              riverButton("Zur letzten Spur", recap);
              riverButton("Für heute fertig", () => navigate("home"));
            },
          );
        },
        id,
      );
      b.setAttribute("aria-label", id === "lama" ? "Lama" : "Lampe");
    }
    riverButton("Hilfe", () => {
      helped = true;
      board.innerHTML = "LA · <strong>MA</strong>";
      visualHint("riverActions", "Lama", 1);
    });
  }
  unfold();
}
function recap() {
  const clue = river.clue || "spur";
  panel("Die letzte Spur", "Wo willst du nachsehen?", clue);
  const memories = document.createElement("div");
  memories.className = "river-memories";
  memories.setAttribute("role", "img");
  memories.setAttribute("aria-label", "Dein Hinweis vom Bach, der Zettel LAMA und die Ohren am Wasser");
  const note = document.createElement("strong");
  note.textContent = "LAMA";
  memories.append(illustration(clue), note, illustration("ohren"));
  $("riverBoard").append(memories);
  for (const [label, id] of [
    ["Am Ufer", "spur"],
    ["Im Schilf", "ohren"],
  ])
    riverButton(
      label,
      () =>
        updateRiver((s) => {
          s.chapter = 3;
          s.place = id;
        }, reveal),
      id,
    );
}
function reveal() {
  panel(
    "Das Glöckchen!",
    river.place === "ohren"
      ? "Unter den Ohren glitzert das Spiegelbild."
      : "Die Spur führt zum Lama am Ufer.",
    "lama",
  );
  $("riverScene").className = "reveal";
  const bell = illustration("glocke");
  bell.classList.add("neck-bell");
  $("riverScene").append(bell);
  const reflection = illustration("lama");
  reflection.classList.add("reflection");
  $("riverScene").append(reflection);
  $("riverBoard").append(illustration("glocke"));
  riverButton("Meine Fundseite", fundPage);
  riverButton("Nochmals entdecken", riverHub);
}
function fundPage() {
  const clue = river.cover || river.clue || "spur";
  panel(
    "Meine Flussfunde",
    river.chapter
      ? "Dein Hinweis vom Bach."
      : "Dein erstes Blatt wartet am Bach.",
    river.chapter ? clue : "tukan",
  );
  mapFragment();
  if (river.chapter) {
    for (const id of [
      ...(river.clues || []),
      ...(river.chapter === 3 ? ["glocke", "lama"] : []),
    ]) {
      const b = riverButton(
        { spur: "Spur", ohren: "Ohren", lama: "Lama", glocke: "Glöckchen" }[
          id
        ] + " aufs Titelblatt",
        () => updateRiver((s) => (s.cover = id), fundPage),
        id,
        "riverBoard",
      );
      b.setAttribute("aria-pressed", String(id === clue));
    }
  }
  if (river.chapter === 3) {
    riverButton("Meine Schatzkarte", atlas, "spur");
    riverButton("Rätsel zeigen", family);
    riverButton("Lagerfeuer", () => fire(0), "feuer");
  }
  riverButton("Zum Fall", riverHub);
}
function family() {
  panel(
    "Wo würdest du suchen?",
    "Emilia zeigt den ersten Hinweis.",
    river.cover || river.clue || "spur",
  );
  riverButton("Zettel aufdecken", () => {
    $("riverBoard").textContent = "LAMA";
    $("riverHint").textContent = "Was glitzert unter seinem Hals?";
  });
  riverButton("Geheimnis zeigen", reveal);
  riverButton("Forscherauftrag", () => {
    panel(
      "Suche zu Hause",
      "Findet gemeinsam etwas, das mit M beginnt.",
      "affe",
    );
    if (voice("fluss-brief")) play("fluss-brief");
    riverButton("Zur Lichtung", () => navigate("home"));
  });
}
const fireFrames = [
  ["Der Bach glitzert.", "spur"],
  ["Der Frosch lauscht im Schilf.", "frosch"],
  ["Das Lama trinkt am Ufer.", "lama"],
  ["Das Glöckchen funkelt.", "glocke"],
  ["Am Feuer wird es still.", "feuer"],
];
function fire(frame) {
  const [line, id] = fireFrames[frame];
  panel("Am Lagerfeuer", line, id);
  $("riverScene").className = "fire-scene";
  const audio = "feuer-" + frame;
  if (voice(audio)) play(audio);
  else if (frame === 2 && voice("fluss-lama")) play("fluss-lama");
  if (frame < 4) {
    riverButton("Nächstes Bild", () => fire(frame + 1));
    fireTimer = setInterval(() => fire(frame + 1), 15000);
  }
  riverButton("Für heute fertig", () => navigate("home"));
}
$("riverLink").onclick = () => openRiver();
$("riverBook").onclick = () => openRiver(true);
// Twelve optional field letters. Human-paced so a break never costs a discovery.
const fieldLetters = [
  [
    "Die lange Nase",
    "lama",
    "lampe",
    "LAMA",
    "Suche zwei Dinge, die mit L beginnen.",
  ],
  [
    "Licht im Schilf",
    "lampe",
    "lama",
    "LAMPE",
    "Macht mit der Hand einen Schatten.",
  ],
  ["Zwei Zehen", "spur", "ohren", "SPUR", "Folge drei leisen Schritten."],
  [
    "Am Teich",
    "frosch",
    "jaguar",
    "FROSCH",
    "Hüpfe einmal pro Silbe in RE-GEN.",
  ],
  ["Der laute Ruf", "tukan", "affe", "TUKAN", "Erfinde ein Echo für Papa."],
  [
    "Im Korb",
    "affe",
    "lama",
    "AFFE",
    "Spiele den Affen mit dem falschen Fernrohr.",
  ],
  [
    "Im Spiegel",
    "ohren",
    "spur",
    "OHREN",
    "Halte beim Lauschen die Hand ans Ohr.",
  ],
  [
    "Leise Pfoten",
    "jaguar",
    "tukan",
    "JAGUAR",
    "Schleiche bis zur nächsten Tür.",
  ],
  [
    "Funkeln im Gras",
    "glocke",
    "lampe",
    "GLOCKE",
    "Suche etwas, das leise klingt.",
  ],
  [
    "Farbe am Steg",
    "maler",
    "affe",
    "MALER",
    "Male eine Spur mit dem Finger in die Luft.",
  ],
  [
    "Der warme Schein",
    "feuer",
    "glocke",
    "FEUER",
    "Zeige mit den Händen eine kleine Flamme.",
  ],
  [
    "Zurück am Ufer",
    "lama",
    "lampe",
    "LAMA",
    "Erzähle die Geschichte mit drei Bildern.",
  ],
];
function atlas() {
  panel(
    "Meine Schatzkarte",
    "Wähle einen Brief. Jeder Fund bleibt hier.",
    "spur",
  );
  $("riverBoard").className = "board-path";
  fieldLetters.forEach(([title, icon], i) => {
    const done = river.letters?.includes(i);
    riverButton(
      (done ? "✓ " : "") + title,
      () => fieldLetter(i),
      icon,
      "riverBoard",
    );
  });
  riverButton("Zur Fundseite", fundPage);
}
function fieldLetter(i) {
  const [title, answer, other, word, prompt] = fieldLetters[i];
  panel(title, "Lies mit Emilia oder hol jemanden dazu.", "tukan");
  $("riverBoard").textContent = word;
  for (const id of mixed([answer, other])) {
    const b = riverButton(
      "",
      () => {
        if (id !== answer) {
          b.classList.add("miss");
          return;
        }
        updateRiver(
          (s) => (s.letters = [...new Set([...(s.letters || []), i])]),
          () => {
            panel("Ein neuer Fund", prompt, answer);
            riverButton("Zur Schatzkarte", atlas);
            riverButton("Für heute fertig", () => navigate("home"));
          },
        );
      },
      id,
    );
    b.setAttribute("aria-label", id);
  }
  riverButton("Hilfe", () => {
    $("riverBoard").replaceChildren(
      illustration(answer),
      document.createTextNode(word),
    );
  });
}
