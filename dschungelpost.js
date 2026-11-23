// Each line is one day. The six sets practise familiar material in different ways.
const postPlan = [
  ["Affe", "finden", "MA", "MI"],
  ["Frosch", "klatschen", "BA·NA·NE"],
  ["Jaguar", "legen", "MI", "A"],
  ["Tukan", "anfang", "MAMA", "MA", "MI"],
  ["Frosch", "ende", "RE·GEN", "NA"],
  ["Jaguar", "finden", "MI", "MA"],
  ["Affe", "legen", "MA", "I"],
  ["Tukan", "anfang", "MIMI", "MI", "MA"],
  ["Frosch", "klatschen", "RE·GEN"],
  ["Affe", "ende", "MA·MA", "MI"],
  ["Tukan", "finden", "RE", "NE"],
  ["Jaguar", "legen", "LA", "M"],
  ["Affe", "anfang", "MALER", "MA", "MI"],
  ["Frosch", "ende", "BA·NA·NE", "BA"],
  ["Tukan", "klatschen", "MI·MI"],
  ["Jaguar", "finden", "NA", "MA"],
  ["Frosch", "legen", "RE", "A"],
  ["Tukan", "anfang", "MIRA", "MI", "MA"],
  ["Affe", "ende", "MI·MI", "MA"],
  ["Jaguar", "klatschen", "FROSCH"],
  ["Affe", "finden", "MO", "MA"],
  ["Tukan", "legen", "MO", "I"],
  ["Frosch", "anfang", "REGEN", "RE", "BA"],
  ["Jaguar", "ende", "MA·LER", "MA"],
  ["Affe", "klatschen", "MA·MA"],
  ["Frosch", "finden", "NE", "RE"],
  ["Jaguar", "legen", "NA", "M"],
  ["Affe", "anfang", "BANANE", "BA", "NA"],
  ["Tukan", "ende", "MI·RA", "MI"],
  ["Frosch", "klatschen", "MA·LER"],
];
const postNames = ["Tukan", "Frosch", "Affe", "Jaguar"];
let postReady = false,
  activePost,
  postAlbum = { count: 0, recent: [] },
  postSaving = false;
function postDay(date = new Date()) {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000,
  );
}
function postFor(day) {
  const elapsed = day - postDay(new Date(2026, 10, 23));
  const cycle = Math.floor(elapsed / 30);
  const index = ((elapsed % 30) + 30) % 30;
  const [original, kind, word, a, b] =
    postPlan[(((index + cycle * 7) % 30) + 30) % 30];
  const animal =
    postNames[(((postNames.indexOf(original) + cycle) % 4) + 4) % 4];
  return { day, animal, kind, word, a, b, index, cycle };
}
function readPost(key) {
  if (!db) return Promise.resolve(undefined);
  return new Promise((ok, no) => {
    const r = db.transaction("app").objectStore("app").get(key);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
}
async function refreshPost() {
  const day = postDay(),
    post = postFor(day);
  $("dailyInvite").hidden = false;
  $("dailyLabel").textContent =
    "Heute mit dem " + post.animal.replace("Affe", "Affen");
  // The sign shows who writes today, so Emilia does not need to read the label.
  const box = document.querySelector("#dailyInvite .postbox");
  if (box) {
    const pic = picture(animals[post.animal]);
    pic.classList.add("post-sender");
    box.replaceChildren(pic);
  }
  $("dailyInvite").classList.add("today");
  try {
    const [earned, album] = await Promise.all([
      readPost("post:" + day),
      readPost("post-album"),
    ]);
    if (day !== postDay()) return;
    if (earned) {
      $("dailyLabel").textContent = "Heute geschafft · nochmals spielen";
      $("dailyInvite").classList.remove("today");
    }
    if (album) postAlbum = album;
    if (!$("book").hidden) showPostAlbum();
  } catch {
    /* The daily puzzle also works without storage. */
  }
}
function showPostAlbum() {
  $("postTally").textContent =
    postAlbum.count === 1
      ? "1 Tiermarke gesammelt"
      : postAlbum.count + " Tiermarken gesammelt";
  $("postStamps").replaceChildren();
  for (const stamp of postAlbum.recent) {
    const item = document.createElement("span");
    item.className = "post-stamp";
    item.title =
      stamp.animal +
      " · " +
      new Date(stamp.day * 86400000).toLocaleDateString("de-CH", {
        timeZone: "UTC",
      });
    item.append(picture(animals[stamp.animal]));
    const date = document.createElement("small");
    date.textContent = new Date(stamp.day * 86400000).toLocaleDateString(
      "de-CH",
      { timeZone: "UTC", day: "2-digit", month: "2-digit" },
    );
    item.append(date);
    $("postStamps").append(item);
  }
}
async function earnPost(post) {
  if (!db)
    throw Error(
      "Geschafft! Die Tiermarke lässt sich hier gerade nicht speichern.",
    );
  return new Promise((ok, no) => {
    const tx = db.transaction("app", "readwrite"),
      store = tx.objectStore("app");
    const key = "post:" + post.day,
      prior = store.get(key),
      album = store.get("post-album");
    let latest;
    album.onsuccess = () => {
      latest = album.result || { count: 0, recent: [] };
      if (prior.result) return;
      const stamp = { day: post.day, animal: post.animal };
      latest = {
        count: latest.count + 1,
        recent: [stamp, ...latest.recent]
          .sort((x, y) => y.day - x.day)
          .slice(0, 6),
      };
      store.put(stamp, key);
      store.put(latest, "post-album");
    };
    tx.oncomplete = () => {
      postAlbum = latest;
      ok();
    };
    tx.onabort = () =>
      no(
        Error(
          "Die Marke konnte nicht gespeichert werden. Versuche es nochmals.",
        ),
      );
  });
}
const postStories = {
  Tukan: "Der Tukan bringt einen Brief vom Baum.",
  Frosch: "Am Teich wartet ein Brief auf dich.",
  Jaguar: "Der Jaguar hat Post am Pfad entdeckt.",
  Affe: "Der Affe hat einen Brief im Korb.",
};
const postTasks = {
  finden: "Finde die Silbe",
  klatschen: "Klatsche mit",
  legen: "Lege die Buchstaben",
  anfang: "Finde den Anfang",
  ende: "Finde das Ende",
};
// Without a recording the syllable is shown briefly and then hidden, so Emilia
// remembers it instead of matching two shapes that stand side by side.
function coverLater(element, text, active) {
  element.textContent = text;
  setTimeout(() => {
    if (activePost === active && element.textContent === text)
      element.textContent = "🍃";
  }, 2500);
}
function openPost(post = postFor(postDay())) {
  if (postSaving) return;
  navigate("daily");
  activePost = post;
  resetAttempt();
  const { animal, kind, word, a, b, index, cycle } = post;
  const parts = word.split("·");
  const bare = parts.join("");
  const answer = kind === "anfang" ? a : kind === "ende" ? parts.at(-1) : word;
  let placed = 0,
    claps = 0,
    solved = false;
  $("postAnimal").replaceChildren(picture(animals[animal]));
  $("postTitle").textContent = postTasks[kind];
  $("postCue").textContent = postStories[animal];
  $("postChoices").replaceChildren();
  $("postActions").replaceChildren();
  const key = [
    bare.toLowerCase(),
    "wort-" + bare,
    "wort-" + bare[0] + bare.slice(1).toLowerCase(),
  ].find(voice);
  const model = $("postModel");
  if (kind === "finden") {
    if (key) model.textContent = "◖))";
    else coverLater(model, word, post);
  } else if (kind === "klatschen") model.textContent = bare;
  else if (kind === "ende") model.textContent = bare;
  else model.textContent = word;
  function done() {
    solved = true;
    model.textContent = word + " ✓";
    msg("Geschafft!");
    $("postChoices").replaceChildren();
    btn("postChoices", "✓ Tiermarke sammeln", async () => {
      if (postSaving) return;
      postSaving = true;
      try {
        await earnPost(post);
        if (!$("daily").hidden && activePost === post) {
          $("postTitle").textContent = "Deine Tiermarke";
          model.replaceChildren(picture(animals[animal]));
          $("postChoices").replaceChildren();
          $("postActions").replaceChildren();
          msg();
          btn("postChoices", "▤ Forscherbuch", () => navigate("book"));
          btn("postChoices", "↻ Nochmals", () => openPost(post));
          if (post.index % 3 === 0)
            btn("postChoices", "Brief vom Fluss", () => openRiver());
        }
      } catch (e) {
        msg(e.message);
      } finally {
        postSaving = false;
      }
    });
  }
  function expected() {
    if (kind === "klatschen")
      return claps < parts.length ? "♩ Klatschen" : String(parts.length);
    return kind === "legen" ? word[placed] : answer;
  }
  if (kind === "klatschen") {
    btn("postChoices", "♩ Klatschen", () => {
      if (solved || claps >= parts.length) return;
      claps++;
      model.textContent =
        parts.slice(0, claps).join(" · ") + " ○".repeat(parts.length - claps);
      if (claps === parts.length) msg("Wie oft hast du geklatscht?");
    });
    for (const value of mixed(["1", "2", "3"]))
      btn("postChoices", value, (ev) => {
        if (solved) return;
        if (claps === parts.length && Number(value) === parts.length) {
          done();
          return;
        }
        missTap("postChoices", expected(), claps < parts.length ? null : ev.currentTarget);
        msg(claps < parts.length ? "Klatsche zuerst mit." : "Zähle nochmals.");
      });
  } else {
    const choices =
      kind === "legen"
        ? [...new Set([...word, a])]
        : [answer, kind === "anfang" ? b : a];
    const shift =
      (((index + cycle) % choices.length) + choices.length) % choices.length;
    const ordered = choices.slice(shift).concat(choices.slice(0, shift));
    for (const value of ordered)
      btn("postChoices", value, (ev) => {
        if (solved) return;
        if (value !== expected()) {
          missTap("postChoices", expected(), ev.currentTarget);
          msg("Schau nochmals.");
          return;
        }
        for (const button of $("postChoices").querySelectorAll("button"))
          button.classList.remove("guide", "miss");
        if (kind === "legen" && ++placed < word.length) {
          model.textContent = word + " · " + word.slice(0, placed) + " ＿";
          msg();
          return;
        }
        done();
      });
  }
  if (key) btn("postActions", "◖)) Anhören", () => play(key));
  btn("postActions", "? Hilfe", () => {
    if (solved) return;
    attempt.help = true;
    if (kind === "finden") model.textContent = word;
    if (kind === "ende" || kind === "klatschen") model.textContent = word;
    if (kind === "anfang")
      model.replaceChildren(
        Object.assign(document.createElement("strong"), { textContent: a }),
        document.createTextNode(word.slice(a.length)),
      );
    guideTo("postChoices", expected());
    if (key) play(key);
  });
  btn("postActions", "↻ Nochmals", () => openPost(post));
  if (kind === "finden" && key) play(key);
}
$("dailyInvite").onclick = () => openPost();
init().then(() => {
  markDiscoveries();
  postReady = true;
  refreshPost();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && postReady) refreshPost();
});
window.addEventListener("focus", () => {
  if (postReady) refreshPost();
});

function schedulePostChange() {
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 100);
  setTimeout(() => {
    if (postReady) refreshPost();
    schedulePostChange();
  }, tomorrow.getTime() - Date.now());
}
schedulePostChange();
