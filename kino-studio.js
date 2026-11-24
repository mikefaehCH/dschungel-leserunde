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
  const say = (text) => {
    const line = document.getElementById("kinoFeedback");
    if (line) line.textContent = text;
  };

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
  const dataUrl = (blob) =>
    new Promise((ok, no) => {
      const reader = new FileReader();
      reader.onload = () => ok(reader.result);
      reader.onerror = no;
      reader.readAsDataURL(blob);
    });
  // Same format as the studio: mono 24 kHz WAV with a gently adjusted level.
  async function toWav(blob) {
    if (blob.size > 15e6) throw Error("Bitte eine kurze Aufnahme wählen.");
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    try {
      const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
      if (audio.duration > 45) throw Error("Bitte höchstens 45 Sekunden aufnehmen.");
      const offline = new OfflineAudioContext(1, Math.ceil(audio.duration * 24000), 24000);
      const src = offline.createBufferSource();
      src.buffer = audio;
      src.connect(offline.destination);
      src.start();
      const samples = (await offline.startRendering()).getChannelData(0);
      let peak = 0,
        sum = 0;
      for (const v of samples) {
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      if (peak < 0.005) throw Error("Kaum hörbar. Bitte näher am Mikrofon erneut aufnehmen.");
      const gain = Math.min(5, 0.92 / peak, 0.13 / Math.sqrt(sum / samples.length));
      const bytes = new ArrayBuffer(44 + samples.length * 2),
        view = new DataView(bytes),
        tag = (at, text) => [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
      tag(0, "RIFF");
      view.setUint32(4, bytes.byteLength - 8, true);
      tag(8, "WAVE");
      tag(12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, 24000, true);
      view.setUint32(28, 48000, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      tag(36, "data");
      view.setUint32(40, samples.length * 2, true);
      samples.forEach((x, i) => view.setInt16(44 + i * 2, kinoClamp(x * gain, -1, 1) * 32767, true));
      return dataUrl(new Blob([bytes], { type: "audio/wav" }));
    } finally {
      ctx.close?.();
    }
  }
  async function takeFile(file) {
    if (!file) return;
    if (!/^audio\//.test(file.type)) {
      say("Bitte eine Audiodatei wählen.");
      return;
    }
    try {
      draft = await toWav(file);
      document.getElementById("kinoUse").disabled = false;
      say("Lautstärke angepasst. Probehören oder speichern.");
    } catch (e) {
      draft = null;
      say(e.message || "Diese Aufnahme kann nicht gelesen werden.");
    }
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
  // The studio import accepts only its own cards. Kino clips in a voice package are
  // taken over here first; the rest of the package goes to the studio unchanged.
  const wav = /^data:audio\/wav;base64,UklGR[A-Za-z0-9+/=]+$/;
  document.addEventListener(
    "change",
    async (event) => {
      const input = event.target;
      if (input.id !== "import" || input.dataset.kinoChecked) return;
      const file = input.files?.[0];
      if (!file || file.size > 80e6) return;
      event.stopImmediatePropagation();
      let forward = file,
        note = "";
      try {
        const pack = JSON.parse(await file.text());
        const ids = new Set(kinoClips.map(([key]) => key));
        const found = Object.entries(pack?.clips || {}).filter(([key]) => ids.has(key));
        if (found.length) {
          if (found.some(([, v]) => typeof v !== "string" || !wav.test(v) || v.length > 3e6))
            throw Error("Ungültige Kino-Aufnahme im Paket.");
          const confirmed = found.filter(([key]) => Array.isArray(pack.mikeKeys) && pack.mikeKeys.includes(key));
          if (mike && confirmed.length) {
            store ||= await openStore();
            const merged = await change("family", (latest) => {
              const fresh = { stickers: [], words: {}, ...(latest || {}) };
              fresh.clips = { ...fresh.clips, ...Object.fromEntries(confirmed) };
              fresh.mikeKeys = [...new Set([...(fresh.mikeKeys || []), ...confirmed.map(([key]) => key)])];
              return fresh;
            });
            try {
              if (typeof data === "object" && data) data = merged;
            } catch {}
            note = confirmed.length + " Kino-Aufnahmen übernommen.";
          }
          for (const [key] of found) delete pack.clips[key];
          forward = new File([JSON.stringify(pack)], file.name, { type: "application/json" });
        }
      } catch (e) {
        if (e instanceof SyntaxError) forward = file;
        else {
          input.value = "";
          say(e.message);
          return;
        }
      }
      const transfer = new DataTransfer();
      transfer.items.add(forward);
      input.files = transfer.files;
      input.dataset.kinoChecked = "1";
      input.dispatchEvent(new Event("change", { bubbles: true }));
      delete input.dataset.kinoChecked;
      if (note) {
        await readiness().catch(() => {});
        say(note);
      }
    },
    true,
  );
  let tries = 0;
  (function wait() {
    if (document.getElementById("studio")) mount().catch(() => {});
    else if (tries++ < 100) setTimeout(wait, 100);
  })();
})();
