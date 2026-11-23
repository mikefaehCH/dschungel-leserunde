"""Check the campfire cinema: scenes, cues, held recordings, sounds, entry points and the parents' panel."""
import base64
import json
import io
import math
import mimetypes
import os
from pathlib import Path
import struct
import sys
import wave
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
url = "https://mikefaehch.github.io/dschungel-leserunde/"
shots = Path(os.getenv("KINO_SHOTS", "/tmp/kino-shots"))
shots.mkdir(parents=True, exist_ok=True)


def tone(seconds):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setparams((1, 2, 24000, 0, "NONE", ""))
        w.writeframes(b"".join(struct.pack("<h", int(2500 * math.sin(i * 0.1))) for i in range(int(24000 * seconds))))
    return buf.getvalue()


short, long_clip = tone(0.3), tone(3.0)
as_url = lambda raw: "data:audio/wav;base64," + base64.b64encode(raw).decode()
expected = {
    "mama": ["kino.intro", "kino.mama.1", "kino.mama.2", "kino.mama.3", "kino.mama.4", "kino.mama.5", "DAS HEISST MAMA. SUPER, EMILIA!", "kino.ende"],
    "mimi": ["kino.intro", "kino.mimi.1", "kino.mimi.2", "kino.mimi.3", "DER JAGUAR HOLT NOCH EIN MI.", "kino.mimi.4", "DAS HEISST MIMI. DER JAGUAR SCHNURRT.", "kino.ende"],
    "lama": ["kino.intro", "kino.lama.1", "kino.lama.2", "L UND A ZUSAMMEN: LA!", "kino.lama.3", "kino.lama.4", "DAS HEISST LAMA. SCHAU, DA IST ES JA!", "kino.ende"],
}


def fake_studio(password):
    """An encrypted stand-in for studio.bin, so eltern.html runs its real login and injection path."""
    page = (
        '<!doctype html><html lang="de-CH"><meta charset="utf-8"><link rel="stylesheet" href="camp.css"><main>'
        '<section id="studio"><h2>Stimmenstudio</h2></section></main><script>let data={clips:{}};</script></html>'
    )
    kdf = PBKDF2HMAC(hashes.SHA256(), 32, bytes([176, 48, 72, 24, 204, 232, 60, 218, 168, 14, 107, 230, 249, 0, 141, 18]), 600000)
    return AESGCM(kdf.derive(password.encode())).encrypt(bytes([108, 92, 95, 129, 188, 9, 22, 121, 77, 3, 253, 29]), page.encode(), None)


def put_family(page, family):
    page.evaluate(
        """async family=>{const tx=db.transaction('app','readwrite');tx.objectStore('app').put(family,'family');
        await new Promise(r=>tx.oncomplete=r)}""",
        family,
    )


with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.getenv("CHROMIUM_PATH"),
        args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
        proxy={"server": os.environ["CAMP_TEST_PROXY"]} if os.getenv("CAMP_TEST_PROXY") else None,
    )
    studio_bin = fake_studio("kino-test") if "--live" not in sys.argv else None

    def context(**kw):
        ctx = browser.new_context(has_touch=True, ignore_https_errors=True, **kw)
        if "--live" not in sys.argv:

            def serve(route):
                name = route.request.url.split(url)[1].split("?")[0] or "index.html"
                body = studio_bin if name == "studio.bin" else (root / name).read_bytes()
                route.fulfill(body=body, content_type=mimetypes.guess_type(name)[0] or "application/octet-stream")

            ctx.route(url + "**", serve)
        page = ctx.new_page()
        page.set_default_timeout(15000)
        page.set_default_navigation_timeout(60000)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(url)
        page.wait_for_function('typeof db!=="undefined" && !!db')
        return ctx, page, errors

    for width, height in [(744, 1133), (1133, 744), (390, 844)]:
        ctx, page, errors = context(viewport={"width": width, "height": height})
        put_family(page, {"clips": {}, "mikeKeys": [], "stickers": ["Frosch"], "words": {"ma": ["Mama"], "mi": ["Mimi"]}, "testMarker": "keep"})
        page.reload()
        page.wait_for_function('typeof db!=="undefined" && !!db')
        page.locator("#bookLink").click()
        page.locator("#kinoBook").click()
        expect(page.locator("#kinoPicker .kino-film")).to_have_count(3)
        page.screenshot(path=str(shots / f"auswahl-{width}.png"))
        for scene in ["mama", "mimi", "lama"]:
            page.locator("#kinoPicker").get_by_role("button", name="Film " + scene.upper()).click()
            page.wait_for_function("kinoNow && kinoNow.state.playing")
            for t in [3.5, 10, 20.5]:
                page.evaluate("t=>kinoNow.seek(t)", t)
                page.screenshot(path=str(shots / f"{scene}-{width}-{t}.png"))
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
            page.evaluate("kinoNow.seek(0);kinoNow.state.log.length=0;kinoNow.state.rate=10;kinoNow.play()")
            page.wait_for_function("kinoNow.state.ended", timeout=20000)
            assert page.evaluate("kinoNow.state.log") == expected[scene], page.evaluate("kinoNow.state.log")
            expect(page.locator("#kinoControls")).to_contain_text("Nochmal")
            page.locator("#kinoControls").get_by_role("button", name="Andere Filme").click()
        expect(page.locator("#kinoPicker .seen")).to_have_count(3)
        assert page.evaluate("readPost('kino:v1').then(v=>v.watched)") == {"mama": 1, "mimi": 1, "lama": 1}
        assert page.evaluate("readPost('family').then(v=>v.testMarker)") == "keep"
        assert not errors, errors
        print("PASS", width, height, "Auswahl; drei Szenen; Cue-Reihenfolge; Ende; Stempel; Daten unverändert", flush=True)
        ctx.close()

    # Recordings: a long clip holds the picture, the scene continues afterwards, cards replay syllables.
    ctx, page, errors = context(viewport={"width": 1133, "height": 744})
    put_family(page, {"clips": {"kino.lama.1": as_url(long_clip), "la": as_url(short), "kino.mama.2": as_url(tone(0.4))}, "mikeKeys": ["kino.lama.1", "la"], "stickers": [], "testMarker": "keep"})
    page.reload()
    page.wait_for_function('typeof db!=="undefined" && !!db')
    page.locator("#bookLink").click()
    page.locator("#kinoBook").click()
    page.locator("#kinoPicker").get_by_role("button", name="Film LAMA").click()
    page.evaluate("kinoNow.state.rate=4")
    page.wait_for_function("kinoNow.state.holding")
    assert abs(page.evaluate("kinoNow.state.t") - 4.6) < 0.01
    assert page.evaluate("player.src===data.clips['kino.lama.1'] && !player.paused")
    page.wait_for_function("!kinoNow.state.holding && kinoNow.state.t>4.7", timeout=10000)
    # Unconfirmed clips (not in mikeKeys) never play.
    page.locator("#kinoControls").get_by_role("button", name="Pause").click()
    t = page.evaluate("kinoNow.state.t")
    page.wait_for_timeout(500)
    assert page.evaluate("kinoNow.state.t") == t
    page.locator("#kinoControls").get_by_role("button", name="Weiter abspielen").click()
    page.wait_for_function("t=>kinoNow.state.t>t", arg=t)
    page.locator("#kinoControls").get_by_role("button", name="Nochmal von vorn").click()
    assert page.evaluate("kinoNow.state.t") < 1
    page.evaluate("kinoNow.state.rate=12")
    page.wait_for_function("kinoNow.state.ended", timeout=20000)
    page.locator("#kinoStage .k-card").first.click()
    assert page.evaluate("player.src===data.clips.la")
    page.locator("#kinoControls").get_by_role("button", name="Andere Filme").click()
    page.locator("#kinoPicker").get_by_role("button", name="Film MAMA").click()
    page.evaluate("kinoNow.state.rate=10")
    page.wait_for_function("kinoNow.state.t>8.7")
    assert page.evaluate("player.src!==data.clips['kino.mama.2']")
    assert page.evaluate("kinoNow.state.log").count("kino.mama.2") == 1
    # Every generated sound runs without errors.
    page.evaluate("kinoSfx.unlock();kinoSfx.sounds.forEach(n=>kinoSfx.play(n,.3));kinoSfx.duck(true);kinoSfx.duck(false)")
    page.wait_for_timeout(300)
    # Entry points: campfire and syllable path reward.
    page.evaluate("navigate('river');fire(0)")
    page.locator("#riverActions").get_by_role("button", name="Lagerfeuer-Kino").click()
    expect(page.locator("#kinoPicker .kino-film")).to_have_count(3)
    page.evaluate("navigate('practice');practiceStory=null;practiceTarget='LA';practiceFinish()")
    page.locator("#practiceChoices").get_by_role("button", name="Film anschauen").click()
    expect(page.locator("#kinoTitle")).to_have_text("LAMA")
    page.locator("#homeLink").click()
    assert page.evaluate("kinoNow") is None
    assert page.evaluate("readPost('family').then(v=>v.testMarker)") == "keep"
    assert not errors, errors
    print("PASS Aufnahme hält das Bild; Pause; Nochmal; Silbe antippen; nur bestätigte Clips; Geräusche; Lagerfeuer; Silbenpfad", flush=True)
    ctx.close()

    # Reduced motion: no confetti, no glow, scene still complete.
    ctx, page, errors = context(viewport={"width": 744, "height": 1133}, reduced_motion="reduce")
    page.locator("#bookLink").click()
    page.locator("#kinoBook").click()
    page.locator("#kinoPicker").get_by_role("button", name="Film MAMA").click()
    page.evaluate("kinoNow.seek(9.4)")
    assert page.evaluate("document.querySelectorAll('#kinoStage ellipse').length") == 0
    assert page.evaluate("[...document.querySelectorAll('#kinoStage circle')].slice(1).every(c=>c.getAttribute('r')==='0')")
    page.screenshot(path=str(shots / "ruhig-mama.png"))
    page.evaluate("kinoNow.seek(0);kinoNow.state.rate=12;kinoNow.play()")
    page.wait_for_function("kinoNow.state.ended", timeout=20000)
    assert not errors, errors
    print("PASS reduzierte Bewegung", flush=True)
    ctx.close()

    if "--live" not in sys.argv:
        # Parents' area: the real eltern.html login path with an encrypted stand-in studio.
        ctx, page, errors = context(viewport={"width": 744, "height": 1133})
        put_family(page, {"clips": {"ma": as_url(short)}, "mikeKeys": ["ma"], "stickers": ["Affe"], "testMarker": "keep"})

        def login(user):
            page.goto(url + "eltern.html")
            page.fill("#user", user)
            page.fill("#pw", "kino-test")
            page.locator("form button").click()
            expect(page.locator("#kinoStudio")).to_be_visible()

        login("mike")
        expect(page.locator("#kinoReady")).to_contain_text("0 / 15")
        expect(page.locator("#kinoClip")).to_have_value("kino.intro")
        page.select_option("#kinoClip", "kino.mama.1")
        expect(page.locator("#kinoText")).to_have_text("Der Tukan bringt ein M.")
        page.locator("#kinoFile").set_input_files({"name": "tukan.wav", "mimeType": "audio/wav", "buffer": short})
        page.locator("#kinoListen").click()
        page.locator("#kinoUse").click()
        expect(page.locator("#kinoFeedback")).to_contain_text("gespeichert")
        expect(page.locator("#kinoReady")).to_contain_text("1 / 15")
        expect(page.locator("#kinoClip")).to_have_value("kino.mama.2")
        assert page.evaluate("!!data.clips['kino.mama.1']")
        page.locator("#kinoSfxToggle").uncheck()
        expect(page.locator("#kinoFeedback")).to_contain_text("aus")
        page.select_option("#kinoScene", "mama")
        page.locator("#kinoPreviewPlay").click()
        page.wait_for_function("document.querySelector('#kinoPreview svg')")
        page.locator("#kinoScrub").fill("12")
        page.screenshot(path=str(shots / "eltern-kino.png"), full_page=True)
        login("teresa")
        expect(page.locator("#kinoClip")).to_have_count(0)
        expect(page.locator("#kinoStudio")).to_contain_text("nimmt Mike auf")
        page.goto(url)
        page.wait_for_function('typeof db!=="undefined" && !!db')
        assert page.evaluate("voice('kino.mama.1')===data.clips['kino.mama.1'] && !!voice('ma')")
        assert page.evaluate("data.testMarker") == "keep"
        page.locator("#bookLink").click()
        page.locator("#kinoBook").click()
        page.wait_for_function("!kinoSfx.isEnabled()")
        assert not errors, errors
        print("PASS Elternbereich: Kino-Karten; Speichern; Vorschau; Geräusch-Schalter; Teresa", flush=True)
        ctx.close()
    if os.getenv("CAMP_TEST_PASSWORD"):
        # The real encrypted studio: both areas side by side, studio saves keep kino clips, package import.
        studio_bin = (root / "studio.bin").read_bytes()
        ctx, page, errors = context(viewport={"width": 744, "height": 1133})
        put_family(page, {"clips": {}, "mikeKeys": [], "stickers": ["Affe"], "words": {"ma": ["Mama"], "mi": ["Mimi"]}, "testMarker": "keep"})

        def real_login(user):
            page.goto(url + "eltern.html")
            page.fill("#user", user)
            page.fill("#pw", os.environ["CAMP_TEST_PASSWORD"])
            page.locator("form button").click()
            expect(page.locator("#studio")).to_be_visible(timeout=60000)
            expect(page.locator("#kinoStudio")).to_be_visible()

        real_login("mike")
        page.select_option("#kinoClip", "kino.mama.1")
        page.locator("#kinoFile").set_input_files({"name": "tukan.wav", "mimeType": "audio/wav", "buffer": tone(0.8)})
        expect(page.locator("#kinoUse")).to_be_enabled()
        page.locator("#kinoUse").click()
        expect(page.locator("#kinoFeedback")).to_contain_text("gespeichert")
        assert page.evaluate("data.clips['kino.mama.1'].startsWith('data:audio/wav;base64,UklGR')")
        page.select_option("#clip", "mi")
        page.locator("#file").set_input_files({"name": "mi.wav", "mimeType": "audio/wav", "buffer": tone(0.6)})
        page.locator("#use").click()
        expect(page.locator("#feedback")).to_contain_text("gespeichert")
        family = page.evaluate("readFamily=()=>new Promise(r=>{const q=indexedDB.open('emilia-leserunde',1);q.onsuccess=()=>{const g=q.result.transaction('app').objectStore('app').get('family');g.onsuccess=()=>r(g.result)}});readFamily()")
        assert "kino.mama.1" in family["clips"] and "mi" in family["clips"], list(family["clips"])
        assert {"kino.mama.1", "mi"} <= set(family["mikeKeys"])
        pack = {"version": 1, "words": {"ma": ["Mama"], "mi": ["Mimi"]}, "clips": {"kino.mama.2": as_url(tone(0.5)), "ma": as_url(tone(0.7))}, "mikeKeys": ["kino.mama.2", "ma"]}
        page.locator("#import").set_input_files({"name": "paket.json", "mimeType": "application/json", "buffer": json.dumps(pack).encode()})
        expect(page.locator("#feedback")).to_contain_text("übernommen")
        expect(page.locator("#kinoFeedback")).to_contain_text("1 Kino-Aufnahmen übernommen")
        family = page.evaluate("readFamily()")
        assert {"kino.mama.1", "kino.mama.2", "ma", "mi"} <= set(family["mikeKeys"]), family["mikeKeys"]
        assert family["testMarker"] == "keep"
        real_login("teresa")
        expect(page.locator("#kinoStudio")).to_contain_text("nimmt Mike auf")
        page.goto(url)
        page.wait_for_function('typeof db!=="undefined" && !!db')
        assert page.evaluate("!!voice('kino.mama.1') && !!voice('kino.mama.2') && !!voice('mi')")
        assert not errors, errors
        print("PASS echtes Studio: Kino-Bereich; Studio-Aufnahme behält Kino-Clips; Paketimport; Teresa", flush=True)
        ctx.close()
    browser.close()
