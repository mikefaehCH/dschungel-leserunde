// Lagerfeuer-Kino: short animated scenes built from the camp's own SVG art.
// A scene is plain data (actors with keyframes, cues, sounds); kinoPlayer plays it.
const kinoKey = "kino:v1";
const kinoEase = {
  io: (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
  out: (p) => 1 - Math.pow(1 - p, 3),
  in: (p) => p * p,
  lin: (p) => p,
};
// href, width, height, anchor x, anchor y (the actor's point of reference)
const kinoArt = {
  tukan: ["art/animals.svg#tukan", 150, 125, -75, -112],
  jaguar: ["art/animals.svg#jaguar", 150, 125, -75, -112],
  frosch: ["art/animals.svg#frosch", 110, 92, -55, -84],
  affe: ["art/animals.svg#affe", 120, 100, -60, 0],
  lama: ["art/fund.svg#lama", 150, 125, -75, 0],
};
const kinoClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const kinoLerp = (a, b, p) => a + (b - a) * p;
const kinoEvery = (from, to, step, name) => {
  const list = [];
  for (let t = from; t < to - 0.01; t += step) list.push([+t.toFixed(2), name]);
  return list;
};
const kinoHops = (from, to, n) =>
  Array.from({ length: n }, (_, k) => [+(from + (k * (to - from)) / n).toFixed(2), "boing"]);

const kinoVine = { pivot: [720, -20], len: 300 };
const kinoSwing = {
  ...kinoVine,
  from: 4.8,
  to: 7.8,
  angles: [
    [4.8, 62],
    [6.4, -28],
    [7.2, 14],
    [7.8, 0],
  ],
};
const kinoIntro = { at: 0.1, until: 1.2, clip: "kino.intro", text: "PSST, DAS KINO BEGINNT!" };
const kinoEnde = (at, until) => ({ at, until, clip: "kino.ende", text: "WILLST DU ES NOCHMAL SEHEN?" });
const kinoGlows = (a, b) => [
  { at: a, dur: 1, r: 140 },
  { at: b, dur: 1.2, r: 300 },
];

const kinoScenes = [
  {
    id: "mama",
    word: "MAMA",
    star: "affe",
    title: "Drei Freunde bringen MAMA",
    dur: 25,
    actors: [
      {
        id: "tukan",
        art: "tukan",
        keys: [
          [1, -120, 230],
          [3.6, 80, 330],
          [4.3, 110, 490],
        ],
        flap: [1, 4.3],
        jumps: [
          [9, 3, 40],
          [19, 3, 40],
        ],
      },
      {
        id: "affe",
        art: "affe",
        swing: kinoSwing,
        keys: [
          [7.8, 720, 280],
          [8.4, 740, 390, { e: "in" }],
        ],
        jumps: [
          [9, 3, 45],
          [19, 3, 45],
        ],
      },
      {
        id: "frosch",
        art: "frosch",
        keys: [
          [12.4, 940, 500],
          [14.2, 635, 500, { e: "lin" }],
        ],
        hop: [12.4, 14.2, 4, 70],
        jumps: [[19, 3, 50]],
      },
    ],
    vine: { ...kinoVine, of: "affe", show: 4.8, release: 7.8 },
    cards: [
      { letter: "M", syll: "ma", carry: [-1, 4.3, "tukan", 69, 11], keys: [[5.1, 380, 360, { e: "out", lift: 60 }], [11.6, 380, 360], [12.6, 290, 360]], pulses: [9, 15.5, 19] },
      { letter: "A", syll: "ma", vowel: true, carry: [-1, 7.8, "affe", 0, 130], keys: [[8.6, 460, 360, { e: "out", lift: 50 }], [11.6, 460, 360], [12.6, 370, 360]], pulses: [9, 15.5, 19] },
      { letter: "M", syll: "ma", carry: [-1, 14.2, "frosch", -36, -118, 0.8], keys: [[15, 470, 360, { e: "out", lift: 70 }]], pulses: [16.9, 19] },
      { letter: "A", syll: "ma", vowel: true, carry: [-1, 14.2, "frosch", 36, -118, 0.8], keys: [[15, 550, 360, { e: "out", lift: 70 }]], pulses: [16.9, 19] },
    ],
    arcs: [
      { x1: 255, x2: 405, at: 15.5 },
      { x1: 435, x2: 585, at: 16.9 },
    ],
    glows: kinoGlows(9, 19),
    confetti: [9.1, 19.1],
    cues: [
      kinoIntro,
      { at: 1.2, until: 4.8, clip: "kino.mama.1", text: "DER TUKAN BRINGT EIN M." },
      { at: 5, until: 8.6, clip: "kino.mama.2", text: "DER AFFE BRINGT EIN A." },
      { at: 8.7, until: 11.8, clip: "kino.mama.3", text: "M UND A ZUSAMMEN: MA!" },
      { at: 12.2, until: 15.3, clip: "kino.mama.4", text: "DER FROSCH BRINGT NOCH EIN MA." },
      { at: 15.4, until: 22.6, clip: "kino.mama.5", text: "MA UND MA." },
      { at: 18.9, until: 22.6, text: "DAS HEISST MAMA. SUPER, EMILIA!" },
      kinoEnde(22.8, 25),
    ],
    sfx: [
      ...kinoEvery(1, 4.2, 0.33, "flap"),
      [4.9, "swoosh", 1.4],
      [5.1, "plop"],
      [6.5, "swoosh", 0.8],
      [8.6, "plop"],
      [9, "sparkle"],
      [9.1, "rustle"],
      ...kinoHops(12.4, 14.2, 4),
      [15, "plop"],
      [15.5, "arc", 0.9],
      [16.9, "arc", 0.9],
      [19, "fanfare"],
      [19.1, "rustle"],
    ],
  },
  {
    id: "mimi",
    word: "MIMI",
    star: "jaguar",
    title: "Der Jaguar findet MIMI",
    dur: 25,
    actors: [
      {
        id: "jaguar",
        art: "jaguar",
        keys: [
          [1.2, -120, 495],
          [4.4, 200, 495, { e: "out" }],
          [12, 200, 495],
          [13, -140, 495, { e: "in" }],
          [13.2, -140, 495],
          [15, 150, 495, { e: "out" }],
          [20.4, 150, 495],
          [21.2, 150, 500, { r: -6, s: 0.92 }],
        ],
        sneak: [
          [1.2, 4.4],
          [12, 13],
          [13.2, 15],
        ],
        jumps: [
          [9, 3, 40],
          [19, 2, 40],
        ],
      },
      {
        id: "tukan",
        art: "tukan",
        flip: true,
        keys: [
          [5.2, 960, 150],
          [7.4, 600, 200, { e: "out" }],
          [7.6, 600, 200],
          [8.8, 700, 490],
        ],
        flap: [5.2, 8.8],
        jumps: [[19, 3, 40]],
      },
    ],
    cards: [
      { letter: "M", syll: "mi", carry: [-1, 4.4, "jaguar", 0, -150], keys: [[5.2, 380, 360, { e: "out", lift: 50 }], [11.6, 380, 360], [12.6, 290, 360]], pulses: [9, 16, 19] },
      { letter: "I", syll: "mi", vowel: true, carry: [-1, 7.6, "tukan", -69, 11], keys: [[8.3, 460, 360, { e: "in" }], [11.6, 460, 360], [12.6, 370, 360]], pulses: [9, 16, 19] },
      { letter: "M", syll: "mi", carry: [13.1, 15, "jaguar", -36, -150, 0.8], keys: [[15.8, 470, 360, { e: "out", lift: 80 }]], pulses: [17.4, 19] },
      { letter: "I", syll: "mi", vowel: true, carry: [13.1, 15, "jaguar", 36, -150, 0.8], keys: [[15.8, 550, 360, { e: "out", lift: 80 }]], pulses: [17.4, 19] },
    ],
    arcs: [
      { x1: 255, x2: 405, at: 16 },
      { x1: 435, x2: 585, at: 17.4 },
    ],
    glows: kinoGlows(9, 19),
    confetti: [9.1, 19.1],
    cues: [
      kinoIntro,
      { at: 1.2, until: 5.2, clip: "kino.mimi.1", text: "DER JAGUAR BRINGT EIN M." },
      { at: 5.4, until: 8.7, clip: "kino.mimi.2", text: "UND DER TUKAN LÄSST EIN I FALLEN." },
      { at: 8.8, until: 11.8, clip: "kino.mimi.3", text: "M UND I ZUSAMMEN: MI!" },
      { at: 12.2, until: 15.8, text: "DER JAGUAR HOLT NOCH EIN MI." },
      { at: 15.9, until: 22.6, clip: "kino.mimi.4", text: "MI UND MI." },
      { at: 18.9, until: 22.6, text: "DAS HEISST MIMI. DER JAGUAR SCHNURRT." },
      kinoEnde(22.8, 25),
    ],
    sfx: [
      ...kinoEvery(1.2, 4.4, 0.4, "tap"),
      [5.2, "plop"],
      ...kinoEvery(5.2, 8.6, 0.33, "flap"),
      [8.3, "plop"],
      [9, "sparkle"],
      [9.1, "rustle"],
      ...kinoEvery(12, 13, 0.4, "tap"),
      ...kinoEvery(13.2, 15, 0.4, "tap"),
      [15.8, "plop"],
      [16, "arc", 0.9],
      [17.4, "arc", 0.9],
      [19, "fanfare"],
      [19.1, "rustle"],
      [20.4, "purr"],
      [21.6, "purr"],
    ],
  },
  {
    id: "lama",
    word: "LAMA",
    star: "lama",
    title: "Wer schaut da über den Hügel?",
    dur: 26,
    actors: [
      {
        id: "lama",
        art: "lama",
        back: true,
        keys: [
          [18.6, 600, 200],
          [19.8, 600, 85, { e: "out" }],
        ],
        jumps: [[21, 2, 12]],
      },
      {
        id: "frosch",
        art: "frosch",
        keys: [
          [1.2, -100, 500],
          [3.4, 200, 500, { e: "lin" }],
        ],
        hop: [1.2, 3.4, 4, 70],
        jumps: [
          [9, 3, 50],
          [19.6, 3, 50],
        ],
      },
      {
        id: "affe",
        art: "affe",
        swing: kinoSwing,
        keys: [
          [7.8, 720, 280],
          [8.4, 740, 390, { e: "in" }],
        ],
        jumps: [
          [9, 3, 45],
          [19.6, 3, 45],
        ],
      },
    ],
    vine: { ...kinoVine, of: "affe", show: 4.8, release: 7.8 },
    cards: [
      { letter: "L", syll: "la", carry: [-1, 3.4, "frosch", 0, -118], keys: [[4.2, 380, 360, { e: "out", lift: 60 }], [11.6, 380, 360], [12.6, 290, 360]], pulses: [9, 15.5, 19.6] },
      { letter: "A", syll: "la", vowel: true, carry: [-1, 7.8, "affe", 0, 130], keys: [[8.6, 460, 360, { e: "out", lift: 50 }], [11.6, 460, 360], [12.6, 370, 360]], pulses: [9, 15.5, 19.6] },
      { letter: "M", syll: "ma", keys: [[12.6, 470, -60], [14.4, 470, 360, { e: "out" }]], sway: [12.6, 14.4, 30, 0], pulses: [16.9, 19.6] },
      { letter: "A", syll: "ma", vowel: true, keys: [[12.6, 550, -60], [14.4, 550, 360, { e: "out" }]], sway: [12.6, 14.4, 30, 1.7], pulses: [16.9, 19.6] },
    ],
    arcs: [
      { x1: 255, x2: 405, at: 15.5 },
      { x1: 435, x2: 585, at: 16.9 },
    ],
    glows: kinoGlows(9, 19.6),
    confetti: [9.1, 19.7],
    cues: [
      kinoIntro,
      { at: 1.2, until: 4.6, clip: "kino.lama.1", text: "DER FROSCH BRINGT EIN L." },
      { at: 5, until: 11.8, clip: "kino.lama.2", text: "DER AFFE BRINGT EIN A." },
      { at: 8.7, until: 11.8, text: "L UND A ZUSAMMEN: LA!" },
      { at: 12.2, until: 15.3, clip: "kino.lama.3", text: "UND MA KENNST DU SCHON." },
      { at: 15.4, until: 23.2, clip: "kino.lama.4", text: "LA UND MA." },
      { at: 18.6, until: 23.2, text: "DAS HEISST LAMA. SCHAU, DA IST ES JA!" },
      kinoEnde(23.4, 26),
    ],
    sfx: [
      ...kinoHops(1.2, 3.4, 4),
      [4.2, "plop"],
      [4.9, "swoosh", 1.4],
      [6.5, "swoosh", 0.8],
      [8.6, "plop"],
      [9, "sparkle"],
      [9.1, "rustle"],
      [12.6, "rustle"],
      [14.4, "plop"],
      [15.5, "arc", 0.9],
      [16.9, "arc", 0.9],
      [19.6, "fanfare"],
      [19.7, "rustle"],
    ],
  },
];
// Recording cards for the parents' area, in the order of the scenes.
const kinoClips = [
  ["kino.intro", "alle", "Psst, das Lagerfeuer-Kino beginnt!"],
  ["kino.mama.1", "MAMA", "Der Tukan bringt ein M."],
  ["kino.mama.2", "MAMA", "Der Affe bringt ein A."],
  ["kino.mama.3", "MAMA", "M und A zusammen: MA!"],
  ["kino.mama.4", "MAMA", "Der Frosch bringt noch ein MA."],
  ["kino.mama.5", "MAMA", "MA und MA. Das heisst MAMA. Super, Emilia!"],
  ["kino.mimi.1", "MIMI", "Der Jaguar bringt ein M."],
  ["kino.mimi.2", "MIMI", "Und der Tukan lässt ein I fallen."],
  ["kino.mimi.3", "MIMI", "M und I zusammen: MI!"],
  ["kino.mimi.4", "MIMI", "MI und MI. Das heisst MIMI. Der Jaguar schnurrt vor Freude."],
  ["kino.lama.1", "LAMA", "Der Frosch bringt ein L."],
  ["kino.lama.2", "LAMA", "Der Affe bringt ein A. L und A: LA!"],
  ["kino.lama.3", "LAMA", "Und MA kennst du schon."],
  ["kino.lama.4", "LAMA", "LA und MA. Das heisst LAMA. Schau, da ist es ja!"],
  ["kino.ende", "alle", "Willst du es nochmal sehen?"],
];

const kinoSvgNs = "http://www.w3.org/2000/svg";
const kinoBackdrop =
  '<defs><linearGradient id="kinoSky" x2=".2" y2="1"><stop stop-color="#b1d9c4"/><stop offset="1" stop-color="#f4dda8"/></linearGradient></defs>' +
  '<rect width="840" height="520" fill="url(#kinoSky)"/><circle class="k-sun" cx="565" cy="100" r="56" fill="#ffecb5"/><g class="k-back"></g>' +
  '<path d="M0 281Q125 105 262 213T540 198T840 169V560H0" fill="#90b68b"/><path d="M0 306Q156 201 355 259T840 218V560H0" fill="#b8c98a"/>' +
  '<path d="M495 560Q400 471 526 414T497 289Q663 351 577 422T655 560" fill="#e7cc91"/>' +
  '<path d="M52 0Q98 110 52 323l41-8Q133 190 122 145Q190 158 267 125l-10-8Q171 137 122 122L114 0" fill="#866344"/>' +
  '<path d="M0 0h840v35q-43 48-89 16q-48 47-118-6q-70 38-136-16q-76 34-144 4q-61 67-112 23q-68 58-119 19Q58 117 0 78" fill="#47775a"/>' +
  '<path fill="#588458" d="M0 560v-95q40 3 54 48q-4-45 15-61q31 24 25 68q30-50 55-44q-2 44-33 84zM840 560v-144q-43 30-46 83q-7-36-30-46q-15 31 2 68q-36-41-66-29q12 42 42 68z"/>';

function kinoEl(tag, attrs = {}, parent) {
  const el = document.createElementNS(kinoSvgNs, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.append(el);
  return el;
}
function kinoPlace(el, x, y, r = 0, s = 1, o = 1, sx = 1) {
  el.setAttribute(
    "transform",
    "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ") rotate(" + r.toFixed(1) + ") scale(" + (s * sx).toFixed(3) + " " + s.toFixed(3) + ")",
  );
  el.setAttribute("opacity", kinoClamp(o, 0, 1).toFixed(2));
}
function kinoBump(t, at, dur) {
  return t < at || t > at + dur ? 0 : Math.sin((Math.PI * (t - at)) / dur);
}
// Interpolates [time, x, y, {e, r, s, o, lift}] keys. Calm mode fades instead of flying.
function kinoKeys(keys, t, calm) {
  const first = keys[0],
    last = keys[keys.length - 1];
  const value = (k) => ({ x: k[1], y: k[2], r: k[3]?.r ?? 0, s: k[3]?.s ?? 1, o: k[3]?.o ?? 1 });
  if (t <= first[0]) return value(first);
  if (t >= last[0]) return value(last);
  let i = 0;
  while (t > keys[i + 1][0]) i++;
  const a = value(keys[i]),
    b = value(keys[i + 1]),
    opt = keys[i + 1][3] || {},
    p = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
  if (calm && Math.hypot(b.x - a.x, b.y - a.y) > 4) {
    const near = p < 0.5 ? a : b;
    return { ...near, o: near.o * Math.abs(1 - 2 * p) };
  }
  const q = kinoEase[opt.e || "io"](p),
    out = {};
  for (const k of ["x", "y", "r", "s", "o"]) out[k] = kinoLerp(a[k], b[k], q);
  if (opt.lift) out.y -= Math.sin(Math.PI * q) * opt.lift;
  return out;
}

function kinoPlayer(host, scene, options = {}) {
  const calm = !!options.calm,
    audio = options.audio || { has: () => false },
    sound = options.sound || { play() {}, duck() {}, setAmbient() {} };
  const svg = kinoEl("svg", { viewBox: "0 0 840 520", class: "kino-stage", role: "img" });
  svg.setAttribute("aria-label", "Trickfilm " + scene.word);
  svg.innerHTML = kinoBackdrop;
  const back = svg.querySelector(".k-back"),
    sun = svg.querySelector(".k-sun");
  const glows = (scene.glows || []).map((g) => ({ ...g, el: kinoEl("circle", { cx: 420, cy: 360, r: 0, fill: "#ffecb5" }, svg) }));
  const vine = scene.vine
    ? kinoEl("line", { stroke: "#608653", "stroke-width": 6, "stroke-linecap": "round", x1: scene.vine.pivot[0], y1: scene.vine.pivot[1] }, svg)
    : null;
  const arcs = (scene.arcs || []).map((a) => ({
    ...a,
    el: kinoEl("path", { d: "M" + a.x1 + " 412Q" + (a.x1 + a.x2) / 2 + " 448 " + a.x2 + " 412", pathLength: 1, fill: "none", stroke: "#f5ad32", "stroke-width": 7, "stroke-linecap": "round", "stroke-dasharray": 1, "stroke-dashoffset": 1 }, svg),
  }));
  const cardLayer = kinoEl("g", {}, svg);
  const cards = scene.cards.map((c) => {
    const g = kinoEl("g", { class: "k-card" }, cardLayer);
    kinoEl("rect", { x: -35, y: -40, width: 70, height: 80, rx: 12, fill: "#fff9e9", stroke: "#205946", "stroke-width": 4 }, g);
    const text = kinoEl("text", { y: 19, "text-anchor": "middle", "font-family": "Verdana,Arial,sans-serif", "font-size": 52, "font-weight": 700, fill: c.vowel ? "#d8653c" : "#143b32" }, g);
    text.textContent = c.letter;
    g.addEventListener("click", () => ended && options.onCard?.(c));
    return { ...c, el: g };
  });
  const actors = {};
  for (const a of scene.actors) {
    const [href, w, h, ax, ay] = kinoArt[a.art];
    const g = kinoEl("g", {}, a.back ? back : svg);
    kinoEl("use", { href, x: ax, y: ay, width: w, height: h }, g);
    actors[a.id] = { ...a, el: g };
  }
  const leaves = [],
    leafLayer = kinoEl("g", {}, svg);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < (calm ? 0 : 26); i++) {
    const angle = rnd() * Math.PI * 2,
      speed = 180 + rnd() * 260;
    leaves.push({
      el: kinoEl("ellipse", { rx: 9, ry: 4.5, fill: ["#80ae47", "#518958", "#f5ad32", "#d8653c", "#699151", "#fff1c8"][i % 6], opacity: 0 }, leafLayer),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 200,
      rot: rnd() * 360,
      spin: (rnd() - 0.5) * 700,
    });
  }
  const caption = kinoEl("g", { opacity: 0, class: "k-caption" }, svg);
  const pill = kinoEl("rect", { y: 22, height: 58, rx: 29, fill: "#fff9e9", stroke: "#205946", "stroke-width": 3 }, caption);
  const words = kinoEl("text", { x: 420, y: 60, "text-anchor": "middle", "font-family": "Verdana,Arial,sans-serif", "font-size": 24, "font-weight": 700, fill: "#143b32" }, caption);
  host.replaceChildren(svg);

  function swingPos(a, t) {
    const s = a.swing,
      angle = kinoKeys(s.angles.map(([k, v]) => [k, v, 0]), calm ? s.to : t, false).x,
      rad = (angle * Math.PI) / 180;
    return { x: s.pivot[0] + s.len * Math.sin(rad), y: s.pivot[1] + s.len * Math.cos(rad), r: -angle * 0.8, s: 1, o: calm ? kinoClamp((t - s.from) / 0.6, 0, 1) : 1 };
  }
  function actorPos(a, t) {
    let p = a.swing && t < a.swing.to ? swingPos(a, t) : kinoKeys(a.keys, t, calm);
    if (calm) return p;
    p = { ...p };
    if (a.flap && t >= a.flap[0] && t <= a.flap[1]) {
      const fade = 1 - kinoClamp((t - (a.flap[1] - 0.7)) / 0.7, 0, 1);
      p.y += Math.sin(t * 9) * 10 * fade;
      p.r += Math.sin(t * 9) * 6 * fade;
    }
    if (a.hop && t >= a.hop[0] && t <= a.hop[1]) {
      const [from, to, n, height] = a.hop;
      p.y -= Math.abs(Math.sin(Math.PI * n * ((t - from) / (to - from)))) * height;
    }
    for (const [from, to] of a.sneak || []) if (t >= from && t <= to) p.y -= Math.abs(Math.sin(t * 8)) * 4;
    for (const [at, n, height] of a.jumps || []) {
      const d = t - at;
      if (d >= 0 && d <= n * 0.5) p.y -= Math.abs(Math.sin((Math.PI * d) / 0.5)) * height;
    }
    return p;
  }
  function carried(c, t) {
    const [, , who, dx, dy, scale = 1] = c.carry,
      a = actorPos(actors[who], t),
      rad = ((a.r || 0) * Math.PI) / 180;
    return {
      x: a.x + dx * Math.cos(rad) - dy * Math.sin(rad),
      y: a.y + dx * Math.sin(rad) + dy * Math.cos(rad),
      r: (a.r || 0) + (calm ? 0 : Math.sin(t * 9 + dx) * 8),
      s: scale,
      o: a.o,
    };
  }
  function cardPos(c, t) {
    let keys = c.keys;
    if (c.carry) {
      const [from, to] = c.carry;
      if (t < from) return { x: -200, y: -200, r: 0, s: 1, o: 0 };
      if (t <= to) return carried(c, t);
      const start = carried(c, to);
      keys = [[to, start.x, start.y, { s: start.s }], ...keys.map((k, i) => (i === 0 ? [k[0], k[1], k[2], { s: 1, ...k[3] }] : k))];
    }
    const p = kinoKeys(keys, t, calm);
    if (c.sway && !calm && t >= c.sway[0] && t <= c.sway[1]) {
      const [from, to, amp, phase] = c.sway,
        f = 1 - (t - from) / (to - from);
      p.x += Math.sin(t * 3 + phase) * amp * f;
      p.r += Math.sin(t * 3 + phase) * 12 * f;
    }
    return p;
  }

  let t = 0,
    last = null,
    raf = 0,
    playing = false,
    ended = false,
    holding = false,
    speaking = null,
    shownText = null;
  const fired = new Set(),
    log = [];
  const state = { rate: 1, log, get t() { return t; }, get holding() { return holding; }, get ended() { return ended; }, get playing() { return playing; } };

  function draw() {
    sun.setAttribute("r", (56 + Math.sin(t * 2) * 3).toFixed(1));
    for (const a of Object.values(actors)) {
      const p = actorPos(a, t);
      kinoPlace(a.el, p.x, p.y, p.r, p.s, p.o, a.flip ? -1 : 1);
    }
    if (vine) {
      const a = actors[scene.vine.of],
        v = scene.vine,
        end = t < v.release ? actorPos(a, t) : { x: v.pivot[0] + (calm ? 0 : Math.sin(t * 2) * 6), y: v.pivot[1] + v.len };
      vine.setAttribute("x2", end.x.toFixed(1));
      vine.setAttribute("y2", end.y.toFixed(1));
      vine.setAttribute("opacity", t < v.show ? 0 : 1);
    }
    for (const c of cards) {
      const p = cardPos(c, t),
        pulse = c.pulses.reduce((sum, at) => sum + kinoBump(t, at, 0.7), 0);
      kinoPlace(c.el, p.x, p.y, p.r, p.s * (1 + 0.18 * pulse), p.o);
    }
    for (const a of arcs) a.el.setAttribute("stroke-dashoffset", (1 - kinoClamp((t - a.at) / 0.9, 0, 1)).toFixed(3));
    for (const g of glows) {
      const on = !calm && t >= g.at && t <= g.at + g.dur,
        q = (t - g.at) / g.dur;
      g.el.setAttribute("r", on ? (40 + g.r * kinoEase.out(q)).toFixed(1) : 0);
      g.el.setAttribute("opacity", on ? (0.85 * (1 - q)).toFixed(2) : 0);
    }
    const burst = (scene.confetti || []).find((at) => t >= at && t < at + 1.8);
    for (const l of leaves) {
      if (burst === undefined) {
        l.el.setAttribute("opacity", 0);
        continue;
      }
      const d = t - burst;
      l.el.setAttribute("transform", "translate(" + (420 + l.vx * d).toFixed(1) + " " + (350 + l.vy * d + 320 * d * d).toFixed(1) + ") rotate(" + (l.rot + l.spin * d).toFixed(0) + ")");
      l.el.setAttribute("opacity", (1 - d / 1.8).toFixed(2));
    }
    let cue = null;
    for (const c of scene.cues) if (c.text && t >= c.at && t < c.until && (!cue || c.at >= cue.at)) cue = c;
    if (cue) {
      if (shownText !== cue.text) {
        shownText = cue.text;
        words.textContent = cue.text;
        let width = 540;
        try {
          width = Math.min(800, Math.max(300, words.getComputedTextLength() + 64));
        } catch {}
        pill.setAttribute("x", (420 - width / 2).toFixed(0));
        pill.setAttribute("width", width.toFixed(0));
      }
      caption.setAttribute("opacity", Math.min(kinoClamp((t - cue.at) / 0.3, 0, 1), kinoClamp((cue.until - t) / 0.3, 0, 1)).toFixed(2));
    } else caption.setAttribute("opacity", 0);
    options.onTick?.(t);
  }
  function fire(from, to) {
    for (const cue of scene.cues) {
      const id = "cue:" + cue.at;
      if (cue.at >= from && cue.at < to && !fired.has(id)) {
        fired.add(id);
        log.push(cue.clip || cue.text);
        if (cue.clip && audio.has(cue.clip)) {
          speaking = cue;
          sound.duck(true);
          audio.start(cue.clip, () => {
            if (speaking !== cue) return;
            speaking = null;
            holding = false;
            sound.duck(false);
          });
        }
      }
    }
    scene.sfx.forEach(([at, name, arg], i) => {
      if (at >= from && at < to && !fired.has("sfx:" + i)) {
        fired.add("sfx:" + i);
        sound.play(name, arg);
      }
    });
  }
  function frame(now) {
    raf = 0;
    if (!playing) return;
    const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.1) * state.rate;
    last = now;
    let next = t + dt;
    // A recording that is longer than its window holds the picture until it is finished.
    if (speaking && next >= speaking.until) {
      next = Math.max(t, speaking.until);
      holding = true;
    }
    fire(t, next + 1e-6);
    t = Math.min(next, scene.dur);
    draw();
    if (t >= scene.dur && !speaking) {
      playing = false;
      ended = true;
      sound.setAmbient(false);
      options.onEnd?.();
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  function play() {
    if (ended) return restart();
    if (playing) return;
    playing = true;
    last = null;
    sound.setAmbient(!calm);
    if (speaking) audio.resume?.();
    raf = requestAnimationFrame(frame);
  }
  function pause() {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(raf);
    raf = 0;
    sound.setAmbient(false);
    if (speaking) audio.pause?.();
  }
  function silence() {
    if (speaking) audio.stop?.();
    speaking = null;
    holding = false;
    sound.duck(false);
  }
  function seek(time) {
    pause();
    silence();
    t = kinoClamp(time, 0, scene.dur);
    ended = false;
    fired.clear();
    for (const c of scene.cues) if (c.at < t) fired.add("cue:" + c.at);
    scene.sfx.forEach(([at], i) => at < t && fired.add("sfx:" + i));
    draw();
  }
  function restart() {
    seek(0);
    log.length = 0;
    play();
  }
  function destroy() {
    pause();
    silence();
    host.replaceChildren();
  }
  draw();
  return { play, pause, seek, restart, destroy, state, scene };
}

// Children's area
let kinoNow = null,
  kinoSettings = { watched: {}, sfx: true };
const kinoReduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const kinoChildAudio = {
  has: (key) => !!voice(key),
  start: (key, done) => play(key, null, done),
  pause: () => player?.pause(),
  resume: () => player?.play().catch(() => {}),
  stop: () => stop(),
};
function kinoButton(label, act, where = "kinoControls", name) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  if (name) b.setAttribute("aria-label", name);
  b.onclick = act;
  $(where).append(b);
  return b;
}
async function kinoLoadSettings() {
  try {
    kinoSettings = { watched: {}, sfx: true, ...((await readPost(kinoKey)) || {}) };
  } catch {}
  kinoSfx.setEnabled(kinoSettings.sfx !== false);
}
async function kinoMarkWatched(id) {
  if (!db) return;
  await new Promise((resolve) => {
    const tx = db.transaction("app", "readwrite"),
      store = tx.objectStore("app"),
      req = store.get(kinoKey);
    req.onsuccess = () => {
      const fresh = { watched: {}, ...(req.result || {}) };
      fresh.watched = { ...fresh.watched, [id]: (fresh.watched[id] || 0) + 1 };
      store.put(fresh, kinoKey);
      kinoSettings = { sfx: true, ...fresh };
    };
    tx.oncomplete = resolve;
    tx.onabort = resolve;
  });
}
function stopKino() {
  kinoNow?.destroy();
  kinoNow = null;
  kinoSfx.setAmbient(false);
}
function openKino(id) {
  kinoSfx.unlock();
  navigate("kino");
  kinoLoadSettings().then(() => {
    if ($("kino").hidden) return;
    const scene = kinoScenes.find((s) => s.id === id);
    scene ? kinoStart(scene) : kinoPicker();
  });
}
function kinoPicker() {
  stopKino();
  $("kinoTitle").textContent = "Lagerfeuer-Kino";
  $("kinoStage").replaceChildren();
  $("kinoControls").replaceChildren();
  $("kinoPicker").replaceChildren();
  $("kinoPicker").hidden = false;
  for (const scene of kinoScenes) {
    const card = kinoButton("", () => {
      kinoSfx.unlock();
      kinoStart(scene);
    }, "kinoPicker", "Film " + scene.word);
    card.className = "kino-film";
    const pic = picture(scene.star);
    if (scene.star === "lama") pic.firstElementChild.setAttribute("href", "art/fund.svg#lama");
    const word = document.createElement("strong");
    word.textContent = scene.word;
    const seen = document.createElement("small");
    const count = kinoSettings.watched?.[scene.id] || 0;
    seen.textContent = count ? "✓ Gesehen" : "Neu";
    if (count) card.classList.add("seen");
    card.append(pic, word, seen);
  }
  kinoButton("Zur Lichtung", () => navigate("home"), "kinoPicker");
}
function kinoStart(scene) {
  stopKino();
  $("kinoPicker").hidden = true;
  $("kinoTitle").textContent = scene.word;
  $("kinoControls").replaceChildren();
  kinoNow = kinoPlayer($("kinoStage"), scene, {
    calm: kinoReduced(),
    audio: kinoChildAudio,
    sound: kinoSfx,
    onCard: (card) => voice(card.syll) && play(card.syll),
    onEnd: () => {
      kinoMarkWatched(scene.id);
      $("kinoStage").classList.add("ended");
      $("kinoControls").replaceChildren();
      kinoButton("↻ Nochmal", () => kinoStart(scene));
      kinoButton("Andere Filme", kinoPicker);
      kinoButton("Zur Lichtung", () => navigate("home"));
    },
  });
  $("kinoStage").classList.remove("ended");
  const toggle = kinoButton("❚❚", () => {
    if (kinoNow.state.playing) {
      kinoNow.pause();
      toggle.textContent = "▶";
      toggle.setAttribute("aria-label", "Weiter abspielen");
    } else {
      kinoSfx.unlock();
      kinoNow.play();
      toggle.textContent = "❚❚";
      toggle.setAttribute("aria-label", "Pause");
    }
  }, "kinoControls", "Pause");
  kinoButton("↻", () => {
    kinoSfx.unlock();
    kinoStart(scene);
  }, "kinoControls", "Nochmal von vorn");
  kinoButton("◀", kinoPicker, "kinoControls", "Zurück zu den Filmen");
  kinoNow.play();
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden && kinoNow?.state.playing) {
    kinoNow.pause();
    const toggle = $("kinoControls")?.firstElementChild;
    if (toggle) {
      toggle.textContent = "▶";
      toggle.setAttribute("aria-label", "Weiter abspielen");
    }
  }
});
document.getElementById("kinoBook")?.addEventListener("click", () => openKino());
