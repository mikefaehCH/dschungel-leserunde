import os, sys, math, struct, wave, io, mimetypes
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
url = "https://mikefaehch.github.io/dschungel-leserunde/"
local = "--live" not in sys.argv
pw = os.environ["CAMP_TEST_PASSWORD"]
with sync_playwright() as p:
    b = p.chromium.launch(
        executable_path=os.getenv("CHROMIUM_PATH"),
        args=["--no-sandbox", "--use-fake-device-for-media-stream"],
        proxy=(
            {"server": os.environ["CAMP_TEST_PROXY"]}
            if os.getenv("CAMP_TEST_PROXY")
            else None
        ),
    )
    for width, height in [(744, 1133), (1133, 744)]:
        ctx = b.new_context(
            ignore_https_errors=True,
            viewport={"width": width, "height": height},
            has_touch=True,
        )
        if local:

            def serve(route):
                name = route.request.url.split(url)[1].split("?")[0] or "index.html"
                file = root / name
                route.fulfill(
                    status=200,
                    body=file.read_bytes(),
                    content_type=mimetypes.guess_type(str(file))[0]
                    or "application/octet-stream",
                )

            ctx.route(url + "**", serve)
        page = ctx.new_page()
        page.set_default_timeout(8000)
        page.set_default_navigation_timeout(60000)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(url)
        page.wait_for_function('typeof db!=="undefined" && !!db')
        page.locator("#home h1").wait_for()

        def click(id):
            page.locator("#" + id).click()

        def choice(id, name):
            page.locator("#" + id).get_by_role("button", name=name, exact=True).click()

        def nextt():
            page.locator("#trailTools button").last.click()

        def playall():
            for link, syllable, name in [
                ("monkeyLink", "MA", "Affe"),
                ("catLink", "MI", "Jaguar"),
            ]:
                if not page.locator("#home").is_visible():
                    click("homeLink")
                click(link)
                for i in range(4):
                    if i < 3:
                        choice("trailChoices", "MI" if syllable == "MA" else "MA")
                        assert page.locator("#trailTools button").last.is_disabled()
                        choice("trailChoices", syllable)
                        if i == 0:
                            choice("trailTools", "↻ Nochmals")
                            choice("trailChoices", syllable)
                    else:
                        for c in syllable:
                            choice("trailChoices", c)
                    nextt()
                choice("trailTools", "▤ Forscherbuch")
                expect(page.locator("#finds")).to_contain_text(name)
            click("homeLink")
            click("frogLink")
            for ans in [
                ["2"],
                ["RE", "GEN"],
                ["3"],
                ["BA", "NA", "NE"],
                ["1"],
                ["FROSCH"],
            ]:
                for a in ans:
                    choice("frogOptions", a)
                click("frogNext")
            expect(page.locator("#book")).to_be_visible()
            click("homeLink")
            click("missionLink")
            for stage in range(6):
                if stage == 2:
                    choice("options", "mi")
                    choice("options", "ma")
                if stage == 3:
                    choice("options", "m")
                    choice("options", "a")
                page.locator("#nav button").last.click()
            if page.get_by_role("button", name="Tukan einkleben").count():
                choice("options", "Tukan einkleben")
            else:
                choice("options", "▤ Forscherbuch")
            expect(page.locator("#finds button")).to_have_count(4)
            page.reload()
            click("bookLink")
            expect(page.locator("#finds button")).to_have_count(4)

        # Old albums only contain stickers. Preserve the first completed round.
        page.evaluate("""async () => {
            await new Promise((resolve,reject)=>{
              const tx=db.transaction('app','readwrite');
              tx.objectStore('app').put({...data, stickers:['Frosch']},'family');
              tx.oncomplete=resolve;tx.onabort=reject;
            });
        }""")
        page.reload()
        click("bookLink")
        expect(page.locator("#bookText")).to_contain_text("1 von 4")
        expect(page.locator("#awards .earned")).to_have_count(1)
        click("homeLink")
        click("monkeyLink")
        choice("trailChoices", "MI")
        choice("trailChoices", "MA")
        nextt()
        expect(page.locator("#trailStep")).to_contain_text("2 / 4")
        page.reload()
        click("bookLink")
        expect(page.locator("#finds button").filter(has_text="Affe")).to_contain_text(
            "1 von 4 Schritten"
        )
        expect(page.locator("#awards .earned")).to_have_count(1)
        page.locator("#finds button").filter(has_text="Affe").click()
        expect(page.locator("#trailStep")).to_contain_text("2 / 4")
        playall()
        expect(page.locator("#awards .earned")).to_have_count(4)
        page.goto(url + "eltern.html")
        page.fill("#user", "mike")
        page.fill("#pw", pw)
        page.locator("form button").click()
        expect(page.locator("#studio")).to_be_visible()
        page.select_option("#clip", "ma")
        page.click("#record")
        expect(page.locator("#feedback")).to_contain_text("Mikrofon nicht verfügbar")
        ctx.grant_permissions(["microphone"])
        page.evaluate(
            """() => {navigator.mediaDevices.getUserMedia=async()=>{const ac=new AudioContext();await ac.resume();const oscillator=ac.createOscillator(),destination=ac.createMediaStreamDestination();oscillator.connect(destination);oscillator.start();return destination.stream}}"""
        )
        page.click("#record")
        expect(page.locator("#record")).to_contain_text("stoppen")
        page.wait_for_timeout(1200)
        page.click("#record")
        expect(page.locator("#draft")).to_be_visible()
        click("preview")
        click("use")
        expect(page.locator("#feedback")).to_contain_text("gespeichert")
        # Check replacement and clip for second adventure with a labelled test tone.
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setparams((1, 2, 16000, 0, "NONE", ""))
            w.writeframes(
                b"".join(
                    struct.pack("<h", int(3000 * math.sin(i * 0.12)))
                    for i in range(8000)
                )
            )
        for key in ["ma", "mi", "wort-REGEN", "wort-Mama"]:
            page.select_option("#clip", key)
            page.locator("#file").set_input_files(
                {"name": "test.wav", "mimeType": "audio/wav", "buffer": buf.getvalue()}
            )
            click("preview")
            click("use")
            expect(page.locator("#feedback")).to_contain_text("gespeichert")
        # Verify old voice packs remain usable and require Mike's confirmation.
        with page.expect_download() as download:
            page.locator("summary").filter(has_text="Stimmenpaket").click()
            click("export")
        import json

        package = json.loads(Path(download.value.path()).read_text())
        assert set(["ma", "mi"]).issubset(package["mikeKeys"])
        legacy = {
            "version": 1,
            "clips": {"ma": package["clips"]["ma"]},
            "words": package["words"],
        }
        page.locator("#import").set_input_files(
            {
                "name": "legacy.json",
                "mimeType": "application/json",
                "buffer": json.dumps(legacy).encode(),
            }
        )
        expect(page.locator("#feedback")).to_contain_text("übernommen")
        page.select_option("#clip", "ma")
        expect(page.locator("#confirm")).to_be_visible()
        click("confirm")
        expect(page.locator("#confirm")).to_be_hidden()
        page.goto(url)
        click("monkeyLink")
        expect(page.locator("#trailTools")).to_contain_text("Anhören")
        choice("trailTools", "◖)) Anhören")
        assert page.evaluate("player.src===data.clips.ma && !player.paused")
        playall()
        assert not errors, errors
        print(
            "PASS",
            width,
            height,
            "all four with/without audio; book; microphone denied/record/replace/reload",
            flush=True,
        )
        ctx.close()
