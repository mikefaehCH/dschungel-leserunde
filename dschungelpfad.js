const journeyKey = "tierpfad:v1";
let journeyProgress = {};

function storyReady(story) {
  return [story.syllable.toLowerCase(), ...storyRecordings(story)].every(voice);
}
function junglePicture(id) {
  const pic = picture(id);
  pic.firstElementChild.setAttribute("href", "art/pfadtiere.svg#" + id);
  return pic;
}
function discoveredJourneyCount() {
  return jungleStories.filter((story) => journeyProgress[story.id]?.rounds)
    .length;
}
async function refreshJourney() {
  try {
    journeyProgress = (await readPost(journeyKey)) || {};
  } catch {
    journeyProgress = {};
  }
  renderJourney();
}
function storyNode(story, album = false) {
  const ready = storyReady(story);
  const progress = journeyProgress[story.id] || {};
  const node = document.createElement(album ? "div" : "li");
  node.className =
    "journey-stop" +
    (ready ? " ready" : " waiting") +
    (progress.rounds ? " discovered" : "");
  node.id = (album ? "album-" : "station-") + story.id;
  const button = document.createElement("button");
  button.type = "button";
  button.disabled = !ready;
  button.setAttribute("aria-label", story.name + " · " + story.title);
  const title = document.createElement("strong");
  title.textContent = story.name;
  const caption = document.createElement("span");
  caption.textContent = story.title;
  button.append(junglePicture(story.id), title, caption);
  button.onclick = () => openJungleStory(story);
  const status = document.createElement("small");
  status.id = node.id + "-status";
  status.textContent = !ready
    ? "Papa liest hier bald vor"
    : progress.active
      ? "Hier geht es weiter"
      : progress.rounds
        ? "Entdeckt · nochmals spielen"
        : "Entdecken";
  button.setAttribute("aria-describedby", status.id);
  node.append(button, status);
  return node;
}
function renderJourney() {
  const map = $("journeyStops");
  if (!map) return;
  map.replaceChildren(...jungleStories.map((story) => storyNode(story)));
  const count =
    Object.keys(animals).filter((name) => data.stickers.includes(name)).length +
    discoveredJourneyCount();
  $("bookCount").textContent =
    count +
    " / " +
    (Object.keys(animals).length + jungleStories.length) +
    " Tiere";
}
function showJourneyFinds() {
  $("journeyFinds").replaceChildren(
    ...jungleStories.map((story) => storyNode(story, true)),
  );
  const count =
    Object.keys(animals).filter((name) => data.stickers.includes(name)).length +
    discoveredJourneyCount();
  $("bookText").textContent =
    count +
    " von " +
    (Object.keys(animals).length + jungleStories.length) +
    " Tierfreunden entdeckt";
}
function showJourneyPath(id) {
  navigate("home");
  document
    .getElementById(id ? "station-" + id : "expeditionPath")
    .scrollIntoView({ block: "center" });
}
async function openJungleStory(story) {
  if (practiceBusy || !storyReady(story)) return;
  const visit = ++practiceVisit;
  practiceStory = story;
  practiceTarget = story.syllable;
  navigate("practice");
  practicePanel(story.title, "Einen Augenblick …");
  setStoryScene(story, 0);
  try {
    const progress = db ? (await readPost(journeyKey)) || {} : journeyProgress;
    if (visit !== practiceVisit || $("practice").hidden) return;
    journeyProgress = progress;
    practiceData = progress;
    startPractice(story.syllable);
  } catch {
    if (visit === practiceVisit)
      msg("Der Pfad konnte nicht geöffnet werden. Versuche es nochmals.");
  }
}
function setStoryScene(story, count) {
  const page = $("practice");
  page.classList.toggle("story-mode", Boolean(story));
  const scene = page.querySelector(".companion");
  scene.querySelector("aside").dataset.pose =
    story && count === 5 ? "book" : story && count >= 3 ? "talk" : "listen";
  const icon = scene.querySelector(".animal use");
  icon.setAttribute(
    "href",
    story ? "art/pfadtiere.svg#" + story.id : "art/animals.svg#tukan",
  );
  scene.dataset.story = story?.id || "";
  let prop = scene.querySelector(".story-prop");
  if (!story) {
    prop?.remove();
    return;
  }
  if (!prop) {
    prop = document.createElement("div");
    prop.className = "story-prop";
    prop.setAttribute("aria-hidden", "true");
    scene.append(prop);
  }
  prop.replaceChildren();
  for (let i = 0; i < 5; i++) {
    const piece = document.createElement("i");
    piece.className = i < count ? "found" : "";
    piece.textContent = ["schildkroete", "schmetterling"].includes(story.id)
      ? "✿"
      : story.id === "krokodil"
        ? "♪"
        : "●";
    prop.append(piece);
  }
}
$("journeyTop").onclick = () => navigate("home");

async function refreshJourneyVoices() {
  if (!db || $("home").hidden || practiceBusy) return;
  try {
    const saved = await readPost("family");
    if ($("home").hidden) return;
    if (saved) data = saved;
    await refreshJourney();
    refreshVoiceSetup();
    markDiscoveries();
  } catch {
    msg("Neue Aufnahmen werden beim nächsten Öffnen geladen.");
  }
}
window.addEventListener("pageshow", (event) => {
  if (event.persisted) refreshJourneyVoices();
});
window.addEventListener("focus", refreshJourneyVoices);
