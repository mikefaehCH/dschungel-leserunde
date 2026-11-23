// Parents' area: recordings, sound switch and preview for the campfire cinema.
// eltern.html loads this after a successful login. The encrypted studio stays unchanged.
(function () {
  const parent = document.documentElement.dataset.parent;
  const mike = parent === "mike";
  let store = null,
    draft = null,
    recorder = null,
    preview = null;
  const listen = new Audio();

  const el = (tag, props = {}, parentEl) => {
    const node = Object.assign(document.createElement(tag), props);
    if (parentEl) parentEl.append(node);
    return node;
  };
  function openStore() {
    return new Promise((ok, no) => {
      const r = indexedDB.open("emilia-leserunde", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("app");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    });
  }
  function read(key) {
    return new Promise((ok, no) => {
      const r = store.transaction("app").objectStore("app").get(key);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    });
  }
  // Read-modify-write on the latest record, so recordings from other tabs survive.
  function change(key, update) {
    return new Promise((ok, no) => {
      const tx = store.transaction("app", "readwrite"),
        st = tx.objectStore("app"),
        r = st.get(key);
      let fresh;
      r.onsuccess = () => {
        fresh = update(r.result);
        st.put(fresh, key);
      };
      tx.oncomplete = () => ok(fresh);
      tx.onabort = () => no(Error("Speichern fehlgeschlagen. Prüfe den freien Speicher."));
    });
  }
  const say = (text) => (document.getElementById("kinoFeedback").textContent = text);

  async function readiness() {
    const family = (await read("family")) || {};
    const done = kinoClips.filter(([key]) => family.mikeKeys?.includes(key) && family.clips?.[key]).length;
    document.getElementById("kinoReady").textContent =
      "Kino-Aufnahmen von Mike: " + done + " / " + kinoClips.length;
    const select = document.getElementById("kinoClip");
    if (select)
      for (const option of select.options) {
        const ok = family.mikeKeys?.includes(option.value) && family.clips?.[option.value];
        option.textContent = (ok ? "✓ " : "") + option.dataset.label;
      }
    return family;
  }
  function showCard() {
    const key = document.getElementById("kinoClip").value,
      [, scene, text] = kinoClips.find(([k]) => k === key);
    document.getElementById("kinoWhere").textContent =
      scene === "alle" ? "Am Anfang oder Ende jedes Films" : "Film " + scene;
    document.getElementById("kinoText").textContent = text;
    draft = null;
    document.getElementById("kinoUse").disabled = true;
    document.getElementById("kinoFile").value = "";
  }
  function takeFile(file) {
    if (!file) return;
    if (!/^audio\//.test(file.type) || file.size > 4e6) {
      say("Bitte eine Audiodatei unter 4 MB wählen.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      draft = reader.result;
      document.getElementById("kinoUse").disabled = false;
      say("Aufnahme bereit. Probehören oder speichern.");
    };
    reader.readAsDataURL(file);
  }
  async function toggleRecording(button) {
    if (recorder) {
      recorder.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const parts = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => e.data.size && parts.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(parts, { type: recorder.mimeType || "audio/webm" });
        recorder = null;
        button.textContent = "● Aufnehmen";
        takeFile(new File([blob], "kino", { type: blob.type.split(";")[0] }));
      };
      recorder.start();
      button.textContent = "■ Aufnahme stoppen";
      say("Aufnahme läuft …");
    } catch {
      recorder = null;
      say("Das Mikrofon ist nicht freigegeben. Du kannst auch eine Datei wählen.");
    }
  }
  async function saveDraft() {
    if (!draft || !mike) return;
    const key = document.getElementById("kinoClip").value,
      audio = draft;
    const merged = await change("family", (latest) => {
      const fresh = { stickers: [], words: {}, ...(latest || {}) };
      fresh.clips = { ...fresh.clips, [key]: audio };
      fresh.mikeKeys = [...new Set([...(fresh.mikeKeys || []), key])];
      return fresh;
    });
    // Keep the studio's own copy current, as the voice bundle does.
    try {
      if (typeof data === "object" && data) data = merged;
    } catch {}
    draft = null;
    document.getElementById("kinoUse").disabled = true;
    say("Kino-Aufnahme gespeichert.");
    const select = document.getElementById("kinoClip");
    await readiness();
    if (select.selectedIndex < select.options.length - 1) {
      select.selectedIndex++;
      showCard();
    }
  }
  function previewAudio(family) {
    const known = (key) => family.mikeKeys?.includes(key) && family.clips?.[key];
    return {
      has: known,
      start(key, done) {
        listen.src = known(key);
        listen.onended = done;
        listen.play().catch(done);
      },
      pause: () => listen.pause(),
      resume: () => listen.play().catch(() => {}),
      stop() {
        listen.onended = null;
        listen.pause();
      },
    };
  }
  async function startPreview() {
    const scene = kinoScenes.find((s) => s.id === document.getElementById("kinoScene").value);
    const scrub = document.getElementById("kinoScrub");
    preview?.destroy();
    kinoSfx.unlock();
    scrub.max = scene.dur;
    preview = kinoPlayer(document.getElementById("kinoPreview"), scene, {
      audio: previewAudio((await read("family")) || {}),
      sound: kinoSfx,
      onTick: (t) => (scrub.value = t.toFixed(1)),
    });
    preview.play();
  }

  async function mount() {
    const studio = document.getElementById("studio");
    if (!studio || document.getElementById("kinoStudio")) return;
    store = await openStore();
    const settings = { sfx: true, ...((await read(kinoKey)) || {}) };
    const box = el("section", { id: "kinoStudio" });
    box.setAttribute("aria-label", "Lagerfeuer-Kino");
    el("h2", { textContent: "Lagerfeuer-Kino" }, box);
    el("p", { id: "kinoReady" }, box);
    if (mike) {
      const label = el("label", { textContent: "Kino-Karte " }, box);
      const select = el("select", { id: "kinoClip" }, label);
      for (const [key, scene, text] of kinoClips) {
        const option = el("option", { value: key }, select);
        option.dataset.label = (scene === "alle" ? "Alle Filme" : scene) + " · " + text;
        option.textContent = option.dataset.label;
      }
      select.onchange = showCard;
      el("p", { id: "kinoWhere" }, box);
      el("p", { id: "kinoText" }, box);
      const tools = el("div", {}, box);
      const rec = el("button", { type: "button", id: "kinoRecord", textContent: "● Aufnehmen" }, tools);
      rec.onclick = () => toggleRecording(rec);
      const fileLabel = el("label", { textContent: "Oder Datei wählen " }, tools);
      el("input", { type: "file", id: "kinoFile", accept: "audio/*" }, fileLabel).onchange = (e) =>
        takeFile(e.target.files[0]);
      el("button", { type: "button", id: "kinoListen", textContent: "▶ Probehören" }, tools).onclick = () => {
        const key = document.getElementById("kinoClip").value;
        read("family").then((f) => {
          const url = draft || (f?.mikeKeys?.includes(key) && f.clips?.[key]);
          if (!url) return say("Für diese Karte gibt es noch keine Aufnahme.");
          listen.onended = null;
          listen.src = url;
          listen.play().catch(() => say("Tippe nochmals auf Probehören."));
        });
      };
      el("button", { type: "button", id: "kinoUse", textContent: "✓ Speichern", disabled: true }, tools).onclick =
        () => saveDraft().catch((e) => say(e.message));
    } else {
      el("p", { textContent: "Die Kino-Stimmen nimmt Mike auf. Im Kinderbereich spielen nur Mikes Aufnahmen." }, box);
    }
    el("p", { id: "kinoFeedback", role: "status" }, box);
    const sfxLabel = el("label", {}, box);
    const sfx = el("input", { type: "checkbox", id: "kinoSfxToggle", checked: settings.sfx !== false }, sfxLabel);
    sfxLabel.append(" Geräusche im Kino");
    sfx.onchange = async () => {
      await change(kinoKey, (latest) => ({ watched: {}, ...(latest || {}), sfx: sfx.checked }));
      kinoSfx.setEnabled(sfx.checked);
      say(sfx.checked ? "Geräusche sind an." : "Geräusche sind aus.");
    };
    kinoSfx.setEnabled(sfx.checked);
    el("h3", { textContent: "Vorschau mit deinen Aufnahmen" }, box);
    const choose = el("select", { id: "kinoScene" }, box);
    for (const scene of kinoScenes) el("option", { value: scene.id, textContent: scene.word }, choose);
    el("div", { id: "kinoPreview" }, box);
    const scrub = el("input", { type: "range", id: "kinoScrub", min: 0, max: 25, step: 0.1, value: 0 }, box);
    scrub.setAttribute("aria-label", "Zeit in der Vorschau");
    scrub.oninput = () => preview?.seek(Number(scrub.value));
    const controls = el("div", {}, box);
    el("button", { type: "button", id: "kinoPreviewPlay", textContent: "▶ Vorschau abspielen" }, controls).onclick = () =>
      preview && preview.scene.id === choose.value && !preview.state.ended ? (kinoSfx.unlock(), preview.play()) : startPreview();
    el("button", { type: "button", textContent: "❚❚ Pause" }, controls).onclick = () => preview?.pause();
    choose.onchange = startPreview;
    studio.after(box);
    if (mike) showCard();
    await readiness();
  }
  let tries = 0;
  (function wait() {
    if (document.getElementById("studio")) mount().catch(() => {});
    else if (tries++ < 100) setTimeout(wait, 100);
  })();
})();
