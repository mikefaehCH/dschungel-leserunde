"""Progress backup in the parent area: export and re-import restore the same progress
without recordings; the encryption script uses a new salt and nonce on every run."""

import json
import mimetypes
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
url = "https://mikefaehch.github.io/dschungel-leserunde/"
password = os.environ.get("CAMP_TEST_PASSWORD")
if not password:
    sys.exit("CAMP_TEST_PASSWORD fehlt")

# 1. Encryption script: fresh salt and nonce per run, round trip, no password in the output.
with tempfile.TemporaryDirectory() as tmp:
    plain = Path(tmp, "plain.txt")
    plain.write_text("Testinhalt ohne Familiendaten")
    env = {**os.environ, "CAMP_PASSWORD": "test-only-passwort"}
    outs = []
    for n in range(2):
        out = Path(tmp, f"out{n}.bin")
        subprocess.run([sys.executable, str(root / "tools/encrypt.py"), "encrypt", f"{plain}:{out}"], env=env, check=True, capture_output=True)
        outs.append(out.read_bytes())
    assert all(o.startswith(b"EJC1") for o in outs)
    assert outs[0][4:20] != outs[1][4:20] and outs[0][20:32] != outs[1][20:32], "Salt und Nonce müssen neu sein"
    assert b"test-only-passwort" not in outs[0]
    back = Path(tmp, "back.txt")
    subprocess.run([sys.executable, str(root / "tools/encrypt.py"), "decrypt", str(Path(tmp, "out1.bin")), str(back)], env=env, check=True, capture_output=True)
    assert back.read_text() == plain.read_text()

# 2. Export and re-import in the studio.
with sync_playwright() as p:
    kind = os.getenv("CAMP_BROWSER", "chromium")
    browser = getattr(p, kind).launch(**({"executable_path": os.getenv("CHROMIUM_PATH"), "args": ["--no-sandbox"]} if kind == "chromium" else {}))
    ctx = browser.new_context(viewport={"width": 744, "height": 1133}, accept_downloads=True)
    if "--live" not in sys.argv:
        def serve(route):
            name = route.request.url.split(url)[1].split("?")[0] or "index.html"
            route.fulfill(body=(root / name).read_bytes(), content_type=mimetypes.guess_type(name)[0] or "application/octet-stream")
        ctx.route(url + "**", serve)
    page = ctx.new_page()
    page.set_default_timeout(60000)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(url)
    page.wait_for_function('typeof db!=="undefined" && !!db')
    progress = page.evaluate("""async () => {
      const tx=db.transaction('app','readwrite');const s=tx.objectStore('app');
      s.put({...data,clips:{x:'data:audio/wav;base64,UklGRg=='},mikeKeys:['x'],stickers:['Affe','Frosch'],expeditions:{Affe:{steps:4,current:0,rounds:2}},observations:{'Affe · Übung · im ersten Versuch':3}},'family');
      s.put({MA:{rounds:1,observations:{first:4,retry:0,helped:1}}},'silbenpfad:v1');
      s.put({chapter:2,clues:['spur'],readings:{first:1}},'fluss:v1');
      s.put({count:2,recent:[{day:20780,animal:'Affe'}]},'post-album');
      s.put({day:20780,animal:'Affe'},'post:20780');
      await new Promise(r=>tx.oncomplete=r);
      const st=db.transaction('app').objectStore('app');
      const get=k=>new Promise(r=>{const q=st.get(k);q.onsuccess=()=>r(q.result)});
      const f=await get('family');
      return {stickers:f.stickers,expeditions:f.expeditions,observations:f.observations,pfad:await get('silbenpfad:v1'),fluss:await get('fluss:v1'),album:await get('post-album'),post:await get('post:20780')};
    }""")
    page.goto(url + "eltern.html")
    page.fill("#user", "teresa")
    page.fill("#pw", password)
    page.locator("form button").click()
    expect(page.locator("#studio")).to_be_visible()
    page.locator("#backup summary").click()
    expect(page.locator("#backupStatus")).to_have_text("Noch nie gesichert.")
    expect(page.locator("#storageStatus")).not_to_be_empty()
    with page.expect_download() as info:
        page.locator("#progressExport").click()
    path = info.value.path()
    exported = json.loads(Path(path).read_text())
    assert exported["type"] == "emilia-fortschritt" and "clips" not in exported["family"] and "mikeKeys" not in exported["family"]
    expect(page.locator("#backupStatus")).to_contain_text("Zuletzt gesichert")
    # Wipe the progress (recordings stay), then import the file again.
    page.evaluate("""async () => {
      const tx=db.transaction('app','readwrite');const s=tx.objectStore('app');
      const q=s.get('family');q.onsuccess=()=>s.put({...q.result,stickers:[],expeditions:{},observations:{}},'family');
      for (const k of ['silbenpfad:v1','fluss:v1','post-album','post:20780']) s.delete(k);
      await new Promise(r=>tx.oncomplete=r);
    }""")
    page.locator("#progressImport").set_input_files(path)
    expect(page.locator("#feedback")).to_contain_text("Fortschritt übernommen")
    restored = page.evaluate("""async () => {
      const st=db.transaction('app').objectStore('app');
      const get=k=>new Promise(r=>{const q=st.get(k);q.onsuccess=()=>r(q.result)});
      const f=await get('family');
      return {result:{stickers:f.stickers,expeditions:f.expeditions,observations:f.observations,pfad:await get('silbenpfad:v1'),fluss:await get('fluss:v1'),album:await get('post-album'),post:await get('post:20780')}, clip:f.clips.x};
    }""")
    assert restored["result"] == progress, (restored["result"], progress)
    assert restored["clip"] == "data:audio/wav;base64,UklGRg==", "Aufnahmen bleiben erhalten"
    # An unrelated JSON file is refused.
    bad = Path(tempfile.gettempdir(), "kein-fortschritt.json")
    bad.write_text(json.dumps({"version": 1, "clips": {}}))
    page.locator("#progressImport").set_input_files(str(bad))
    expect(page.locator("#feedback")).to_contain_text("keine Fortschrittsdatei")
    assert not errors, errors
    print("PASS Verschlüsselungsskript (neues Salt und Nonce, Rundlauf); Export und Re-Import ergeben denselben Fortschritt; Aufnahmen bleiben", flush=True)
    ctx.close()
