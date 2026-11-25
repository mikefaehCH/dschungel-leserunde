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

        def trace():
            # Follow every letter of the sand track from its start point.
            points = page.evaluate("""() => {
              const svg = document.querySelector('#task svg');
              return [...svg.querySelectorAll('path')].flatMap(path => {
                const m = path.getScreenCTM();
                return Array.from({length: 40}, (_, i) => {
                  const q = path.getPointAtLength(path.getTotalLength() * i / 39).matrixTransform(m);
                  return [q.x, q.y];
                });
              });
            }""")
            page.mouse.move(*points[0])
            page.mouse.down()
            for x, y in points:
                page.mouse.move(x, y, steps=2)
            page.mouse.up()

        def nextt():
            previous = page.locator("#trailStep").text_content()
            page.locator("#trailTools button").last.click()
            expect(page.locator("#trailStep")).not_to_have_text(previous)

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
                if ans[0].isdigit():
                    for _ in range(int(ans[0])):
                        choice("frogOptions", "♩ Klatschen")
                    assert page.locator("#frogNext").is_disabled()
                for a in ans:
                    choice("frogOptions", a)
                click("frogNext")
            expect(page.locator("#book")).to_be_visible()
            click("homeLink")
            click("missionLink")
            for stage in range(6):
                if stage in [1, 4, 5]:
                    expect(page.locator("#nav button").last).to_be_disabled()
                    if stage == 4:
                        # Letters are no shortcut: only the traced path unlocks the station.
                        expect(page.locator("#options button")).to_have_count(0)
                        trace()
                    else:
                        choice("options", {1: "Echo zurückgeben", 5: "Frosch"}[stage])
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
        expect(page.locator("#bookText")).to_contain_text("1 von 14")
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
        # Storage regression: Teresa can record/export without changing Mike's MA.
        original = page.evaluate("voice('ma')")
        page.goto(url + "eltern.html")
        page.fill("#user", "teresa")
        page.fill("#pw", pw)
        page.locator("form button").click()
        expect(page.locator("#studio")).to_be_visible()
        page.select_option("#clip", "ma")
        expect(page.locator("#listen")).to_be_disabled()
        page.locator("#file").set_input_files(
            {"name": "dummy.wav", "mimeType": "audio/wav", "buffer": buf.getvalue()[:44] + buf.getvalue()[8044:] + buf.getvalue()[44:8044]}
        )
        click("use")
        expect(page.locator("#feedback")).to_contain_text("gespeichert")
        page.goto(url)
        click("monkeyLink")
        assert original and page.evaluate("voice('ma')") == original
        # A second round must resume the next step, with the previous badge intact.
        choice("trailChoices", "MA")
        nextt()
        expect(page.locator("#trailStep")).to_contain_text("2 / 4")
        page.reload()
        click("bookLink")
        page.locator("#finds button").filter(has_text="Affe").click()
        expect(page.locator("#trailStep")).to_contain_text("2 / 4")
        click("homeLink")
        click("riverLink")

        def riverbtn(name):
            choice("riverActions", name)

        riverbtn("Der erste Stein")
        if width == 744:
            m = page.locator("#riverBoard button").first.bounding_box()
            a = page.locator("#riverBoard button").last.bounding_box()
            page.mouse.move(m["x"] + m["width"] / 2, m["y"] + m["height"] / 2)
            page.mouse.down()
            page.mouse.move(a["x"] + a["width"] / 2, a["y"] + a["height"] / 2, steps=10)
            page.mouse.up()
        else:
            choice("riverBoard", "M")
            choice("riverBoard", "A")
        riverbtn("Affe" if width == 744 else "Frosch")
        expect(page.locator("#riverTitle")).to_have_text(
            "Zwei Zehen" if width == 744 else "Zwei Ohren"
        )
        page.reload()
        click("riverLink")
        riverbtn("Der Zettel")
        page.locator("#riverBoard button").click()
        page.locator("#riverBoard button").click()
        riverbtn("Lampe")
        page.locator("#riverTools").get_by_role("button", name="? Hilfe", exact=True).click()
        riverbtn("Lama")
        expect(page.locator("#riverTitle")).to_have_text("Ein langes Ohr!")
        page.reload()
        click("riverLink")
        riverbtn("Das Glitzern")
        riverbtn("Im Schilf")
        expect(page.locator("#riverTitle")).to_have_text("Das Glöckchen!")
        riverbtn("Meine Fundseite")
        choice("riverBoard", "Glöckchen aufs Titelblatt")
        expect(
            page.get_by_role("button", name="Glöckchen aufs Titelblatt")
        ).to_have_attribute("aria-pressed", "true")
        riverbtn("Rätsel zeigen")
        riverbtn("Zettel aufdecken")
        expect(page.locator("#riverBoard")).to_have_text("LAMA")
        riverbtn("Geheimnis zeigen")
        riverbtn("Meine Fundseite")
        riverbtn("Meine Schatzkarte")
        for i in range(12):
            page.locator("#riverBoard button").nth(i).click()
            correct = page.evaluate("(i)=>fieldLetters[i][1]", i)
            riverbtn(correct)
            riverbtn("Zur Schatzkarte")
        expect(page.locator("#riverBoard button").filter(has_text="✓")).to_have_count(
            12
        )
        riverbtn("Zur Fundseite")
        riverbtn("Lagerfeuer")
        for i in range(4):
            riverbtn("➜ Nächstes Bild")
        expect(page.locator("#riverHint")).to_contain_text("still")
        riverbtn("Für heute fertig")
        print(
            "PASS: getrennte Aufnahmen, zweite Runde, Flussfall, zwölf Briefe, Kino",
            flush=True,
        )
        assert not errors, errors
        print(
            "PASS",
            width,
            height,
            "all four with/without audio; book; microphone denied/record/replace/reload",
            flush=True,
        )
        ctx.close()
