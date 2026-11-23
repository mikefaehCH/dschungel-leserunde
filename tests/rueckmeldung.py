"""Every area answers a miss the same way: the tapped answer fades, the second miss
outlines the right answer, and no feedback text names the answer."""

import io
import re
import math
import mimetypes
import os
import struct
import sys
import wave
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
url = "https://mikefaehch.github.io/dschungel-leserunde/"


def tone():
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setparams((1, 2, 8000, 0, "NONE", ""))
        w.writeframes(b"".join(struct.pack("<h", int(2000 * math.sin(i * 0.2))) for i in range(2000)))
    import base64
    return "data:audio/wav;base64," + base64.b64encode(buf.getvalue()).decode()


with sync_playwright() as p:
    kind = os.getenv("CAMP_BROWSER", "chromium")  # CAMP_BROWSER=webkit für Safari
    browser = getattr(p, kind).launch(**({"executable_path": os.getenv("CHROMIUM_PATH"), "args": ["--no-sandbox"]} if kind == "chromium" else {}))
    for width, height in [(744, 1133), (1133, 744)]:
        for with_audio in [False, True]:
            ctx = browser.new_context(viewport={"width": width, "height": height}, has_touch=True)
            if "--live" not in sys.argv:
                def serve(route):
                    name = route.request.url.split(url)[1].split("?")[0] or "index.html"
                    route.fulfill(body=(root / name).read_bytes(),
                                  content_type=mimetypes.guess_type(name)[0] or "application/octet-stream")
                ctx.route(url + "**", serve)
            page = ctx.new_page()
            page.set_default_timeout(8000)
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(url, timeout=60000)
            page.wait_for_function('typeof db!=="undefined" && !!db')
            if with_audio:
                page.evaluate("""async (url) => {
                  const keys=['ma','mi','la','ma-slow','mi-slow','wort-Mama','wort-Maler','wort-Mimi','wort-REGEN'];
                  const tx=db.transaction('app','readwrite');
                  tx.objectStore('app').put({...data,clips:Object.fromEntries(keys.map(k=>[k,url])),mikeKeys:keys},'family');
                  await new Promise(r=>tx.oncomplete=r);
                }""", tone())
                page.reload()
                page.wait_for_function('typeof db!=="undefined" && !!db')

            def check(container, wrong, right, by_label=False):
                box = page.locator("#" + container)
                pick = (lambda n: box.get_by_role("button", name=n, exact=True))
                pick(wrong).click()
                expect(box.locator("button.miss")).to_have_count(1)
                named = re.compile(r"\b" + re.escape(right) + r"\b", re.I)
                expect(page.locator("#feedback")).not_to_have_text(named)
                pick(wrong).click()
                guide = box.locator("button.guide")
                expect(guide).to_have_count(1)
                if by_label:
                    expect(guide).to_have_attribute("aria-label", right)
                else:
                    expect(guide).to_have_text(right)
                expect(page.locator("#feedback")).not_to_have_text(named)
                pick(right).click()

            def home():
                if page.locator("#homeLink").is_visible():
                    page.locator("#homeLink").click()

            # Affe and Jaguar
            for link, right, wrong in [("monkeyLink", "MA", "MI"), ("catLink", "MI", "MA")]:
                home(); page.locator("#" + link).click()
                check("trailChoices", wrong, right)
                expect(page.locator("#trailTools button").last).to_be_enabled()
            # Frosch: build REGEN
            home(); page.locator("#frogLink").click()
            for _ in range(2):
                page.locator("#frogOptions").get_by_role("button", name="♩ Klatschen").click()
            page.locator("#frogOptions").get_by_role("button", name="2", exact=True).click()
            page.locator("#frogNext").click()
            check("frogOptions", "GEN", "RE")
            # Tukan: start sound and letters
            home(); page.locator("#missionLink").click()
            page.locator("#nav button").last.click()
            page.locator("#options").get_by_role("button", name="Echo zurückgeben").click()
            page.locator("#nav button").last.click()
            answer = page.evaluate("huntCard().answer")
            check("options", "mi" if answer == "ma" else "ma", answer)
            page.locator("#nav button").last.click()
            check("options", "i", "m")
            # Silbenpfad station 1
            home(); page.locator("#practiceLink").click()
            page.locator("#practiceChoices button").filter(has=page.get_by_text("MA", exact=True)).click()
            check("practiceChoices", "MI", "MA")
            # Dschungelpost of the day
            home(); page.locator("#dailyInvite").click()
            post = page.evaluate("activePost")
            if post["kind"] in ("finden", "anfang"):
                right = post["a"] if post["kind"] == "anfang" else post["word"]
                wrong = post["b"] if post["kind"] == "anfang" else post["a"]
                check("postChoices", wrong, right)
            # River word
            home(); page.locator("#riverLink").click()
            page.locator("#riverActions button").first.click()
            page.locator("#riverBoard").get_by_role("button", name="M", exact=True).click()
            page.locator("#riverBoard").get_by_role("button", name="A", exact=True).click()
            page.locator("#riverActions").get_by_role("button", name="Affe").click()
            page.locator("#riverActions").get_by_role("button", name="Zettel öffnen").click()
            page.locator("#riverBoard button").click()
            page.locator("#riverBoard button").click()
            check("riverActions", "Lampe", "Lama", by_label=True)
            expect(page.locator("#riverTitle")).to_have_text("Ein langes Ohr!")
            assert not errors, errors
            print("PASS", width, height, "mit Ton" if with_audio else "ohne Ton",
                  "Affe, Jaguar, Frosch, Tukan, Silbenpfad, Post, Fluss: Fehler blasst ab, zweiter Fehler umrandet, kein Lösungstext", flush=True)
            ctx.close()
