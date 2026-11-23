"""Exercise the syllable path using isolated test data."""

import os
import mimetypes
import sys
import io, wave, math, struct
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
url = "https://mikefaehch.github.io/dschungel-leserunde/"
with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.getenv("CHROMIUM_PATH"),
        args=["--no-sandbox"],
        proxy=(
            {"server": os.environ["CAMP_TEST_PROXY"]}
            if os.getenv("CAMP_TEST_PROXY")
            else None
        ),
    )
    for width, height in [(744, 1133), (1133, 744)]:
        ctx = browser.new_context(
            viewport={"width": width, "height": height},
            has_touch=True,
            ignore_https_errors=True,
        )
        if "--live" not in sys.argv:

            def serve(route):
                name = route.request.url.split(url)[1].split("?")[0] or "index.html"
                route.fulfill(
                    body=(root / name).read_bytes(),
                    content_type=mimetypes.guess_type(name)[0]
                    or "application/octet-stream",
                )

            ctx.route(url + "**", serve)
        page = ctx.new_page()
        page.set_default_timeout(10000)
        page.set_default_navigation_timeout(60000)
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(url)
        page.wait_for_function('typeof db!=="undefined" && !!db')
        page.evaluate("""async () => {
          const tx=db.transaction('app','readwrite');
          tx.objectStore('app').put({...data, testMarker:'preserve', stickers:['Affe']},'family');
          await new Promise(resolve=>tx.oncomplete=resolve);
        }""")
        family = page.evaluate("readPost('family')")

        def button(name, container="practiceChoices"):
            page.locator("#" + container).get_by_role(
                "button", name=name, exact=True
            ).click()

        def tool(name):
            button(name, "practiceTools")

        page.locator("#practiceLink").click()
        for target, other, word in [
            ("MA", "MI", "MAMA"),
            ("MI", "MA", "MIMI"),
            ("LA", "MA", "LAMA"),
        ]:
            page.locator("#practiceChoices button").filter(
                has=page.get_by_text(target, exact=True)
            ).click()
            for station in range(5):
                expect(page.locator("#practiceTrack")).to_have_attribute(
                    "aria-label", str(station) + " von 5 Stationen"
                )
                expect(
                    page.locator("#practiceTools").get_by_role(
                        "button",
                        name="Weiter" if station < 4 else "Mein Silbenfund",
                        exact=True,
                    )
                ).to_be_disabled()
                if station < 3:
                    button(other)
                    expect(page.locator("#practiceTrack")).to_have_attribute(
                        "aria-label", str(station) + " von 5 Stationen"
                    )
                    if station == 1:
                        button(other)
                        expect(
                            page.locator("#practiceChoices button.guide")
                        ).to_have_text(target)
                    button(target)
                    if station == 0:
                        tool("Nochmals")
                        button(target)
                elif station == 3:
                    button(target[1])
                    button(target[0])
                    button(target[1])
                else:
                    button(word)
                tool("Weiter" if station < 4 else "Mein Silbenfund")
                if station < 4:
                    page.wait_for_function(
                        "([t,s])=>practiceData[t]?.active?.step===s",
                        arg=[target, station + 1],
                    )
                if station == 1:
                    expect(page.locator("#practiceTrack")).to_have_attribute(
                        "aria-label", "2 von 5 Stationen"
                    )
                    page.reload()
                    page.locator("#practiceLink").click()
                    page.locator("#practiceChoices button").filter(
                        has=page.get_by_text(target, exact=True)
                    ).click()
            expect(page.locator("#practiceTitle")).to_have_text("Dein Silbenfund")
            button("Andere Silbe")
        for target in ["MA", "MI", "LA"]:
            saved = page.evaluate("(target)=>practiceData[target]", target)
            assert saved["rounds"] == 1 and "active" not in saved
            assert sum(saved["observations"].values()) == 5
            assert saved["observations"]["helped"] == 1
        assert page.evaluate("readPost('family')") == family
        # Repeating starts a fresh route while retaining its previous collection.
        page.locator("#practiceChoices button").filter(
            has=page.get_by_text("MA", exact=True)
        ).click()
        expect(page.locator("#practiceTrack")).to_have_attribute(
            "aria-label", "0 von 5 Stationen"
        )
        button("MA")
        tool("Weiter")
        tool("Zu meinen Silben")
        expect(
            page.locator("#practiceChoices button").filter(
                has=page.get_by_text("MA", exact=True)
            )
        ).to_contain_text("1 / 5")
        assert page.evaluate("practiceData.MA.rounds") == 1
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        if os.getenv("CAMP_TEST_PASSWORD"):
            page.goto(url + "eltern.html")
            page.fill("#user", "mike")
            page.fill("#pw", os.environ["CAMP_TEST_PASSWORD"])
            page.locator("form button").click()
            expect(page.locator("#studio")).to_be_visible()
            expect(page.locator("#practiceNotes")).to_contain_text("LA · 1 Wege")
            page.select_option("#clip", "la")
            expect(page.locator("#scriptText")).to_have_text("La.")
            expect(page.locator("#where")).to_contain_text("Silbenpfad")
            buf = io.BytesIO()
            with wave.open(buf, "wb") as tone:
                tone.setparams((1, 2, 16000, 0, "NONE", ""))
                tone.writeframes(
                    b"".join(
                        struct.pack("<h", int(3000 * math.sin(i * 0.12)))
                        for i in range(8000)
                    )
                )
            page.locator("#file").set_input_files(
                {
                    "name": "test-la.wav",
                    "mimeType": "audio/wav",
                    "buffer": buf.getvalue(),
                }
            )
            page.locator("#use").click()
            expect(page.locator("#feedback")).to_contain_text("gespeichert")
            page.goto(url)
            page.locator("#practiceLink").click()
            page.locator("#practiceChoices button").filter(
                has=page.get_by_text("LA", exact=True)
            ).click()
            expect(
                page.locator("#practiceTools").get_by_role(
                    "button", name="Anhören", exact=True
                )
            ).to_be_visible()
            assert page.evaluate("player.src===data.clips.la")
            assert page.evaluate("data.testMarker") == "preserve"
        assert not errors, errors
        print(
            "PASS",
            width,
            height,
            "MA/MI/LA; Fehlerhilfe; fünf Stationen; Wiederholen; Neuladen; Familienbestand",
            flush=True,
        )
        ctx.close()
