// The login page decrypts this package before the studio receives it.
async function installVoiceBundle() {
  const status = document.getElementById("bundleStatus");
  if (!isMike) {
    status.textContent =
      "Mike kann das geprüfte Sprachpaket auf diesem Gerät aktivieren.";
    return;
  }
  const raw = document.getElementById("bundledVoiceData")?.textContent;
  const bundle = raw ? JSON.parse(raw) : null;
  if (!bundle || bundle.error) {
    status.textContent =
      "Das geprüfte Sprachpaket konnte nicht geladen werden. Melde dich nochmals an.";
    return;
  }
  if (
    bundle.version !== 1 ||
    !bundle.clips ||
    !Array.isArray(bundle.mikeKeys)
  ) {
    throw Error("Das Sprachpaket hat ein unbekanntes Format.");
  }
  const originals = data.clips || {};
  const replace = new Set();
  for (const [name, audio] of Object.entries(bundle.clips)) {
    if (
      !bundle.mikeKeys.includes(name) ||
      !/^data:audio\/wav;base64,UklGR[A-Za-z0-9+/=]+$/.test(audio)
    ) {
      throw Error("Das Sprachpaket enthält eine ungültige Aufnahme.");
    }
    const current = originals[name];
    if (!current || current === audio) {
      replace.add(name);
      continue;
    }
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(current),
    );
    const hash = [...new Uint8Array(digest)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    if (hash === bundle.sourceHashes?.[name]) replace.add(name);
  }
  let installed = 0,
    preserved = 0;
  await new Promise((resolve, reject) => {
    const tx = db.transaction("app", "readwrite");
    const store = tx.objectStore("app");
    const request = store.get("family");
    let merged;
    request.onsuccess = () => {
      const latest = request.result || data;
      merged = { ...latest, clips: { ...latest.clips } };
      const confirmed = new Set(latest.mikeKeys || []);
      for (const [name, audio] of Object.entries(bundle.clips)) {
        const current = latest.clips?.[name];
        // A recording saved by another tab after our comparison takes precedence.
        if (!current || (replace.has(name) && current === originals[name])) {
          merged.clips[name] = audio;
          confirmed.add(name);
          installed++;
        } else preserved++;
      }
      merged.mikeKeys = [...confirmed];
      merged.voiceBundle = bundle.release;
      store.put(merged, "family");
    };
    tx.oncomplete = () => {
      data = merged;
      resolve();
    };
    tx.onabort = () =>
      reject(Error("Das Sprachpaket konnte nicht gespeichert werden."));
  });
  document.getElementById("bundledVoiceData").remove();
  status.textContent =
    installed +
    " geprüfte Clips auf diesem Gerät bereit." +
    (preserved ? " " + preserved + " eigene Aufnahmen behalten." : "");
}
