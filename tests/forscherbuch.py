"""The Forscherbuch shows progress from every area and keeps old albums intact."""

import mimetypes
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
url = "https://mikefaehch.github.io/dschungel-leserunde/"

with sync_playwright() as p:
    kind = os.getenv("CAMP_BROWSER", "chromium")  # CAMP_BROWSER=webkit für Safari
    browser = getattr(p, kind).launch(**({"executable_path": os.getenv("CHROMIUM_PATH"), "args": ["--no-sandbox"]} if kind == "chromium" else {}))
    for width, height in [(744, 1133), (1133, 744)]:
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

        def press(container, name):
            page.locator("#" + container).get_by_role("button", name=name, exact=True).click()

        # A fresh book: four empty areas.
        page.locator("#bookLink").click()
        expect(page.locator("#bookAreas .area-tile")).to_have_count(4)
        expect(page.locator("#bookAreas .area-tile.started")).to_have_count(0)
        expect(page.locator("#bookText")).to_contain_text("0 von ")
        page.locator("#homeLink").click()

        # One Silbenpfad round with MA.
        page.locator("#practiceLink").click()
        page.locator("#practiceChoices button").filter(has=page.get_by_text("MA", exact=True)).click()
        for station, answer in enumerate(["MA", "MA", "MALER", None, "MAMA"]):
            if answer is None:
                press("practiceChoices", "M")
                press("practiceChoices", "A")
            else:
                press("practiceChoices", answer)
            press("practiceTools", "➜ Weiter" if station < 4 else "✓ Mein Silbenfund")
            if station < 4:
                page.wait_for_function("(s)=>practiceData.MA?.active?.step===s", arg=station + 1)
        expect(page.locator("#practiceTitle")).to_have_text("Dein Silbenfund")
        page.locator("#homeLink").click()

        # One Dschungelpost stamp.
        page.locator("#dailyInvite").click()
        post = page.evaluate("activePost")
        k = post["kind"]
        if k == "klatschen":
            parts = post["word"].split("·")
            for _ in parts:
                press("postChoices", "♩ Klatschen")
            press("postChoices", str(len(parts)))
        elif k == "legen":
            for c in post["word"]:
                press("postChoices", c)
        else:
            press("postChoices", post["a"] if k == "anfang" else post["word"].split("·")[-1])
        press("postChoices", "✓ Tiermarke sammeln")
        expect(page.locator("#postTitle")).to_have_text("Deine Tiermarke")
        page.locator("#homeLink").click()

        # The first river chapter.
        page.locator("#riverLink").click()
        page.locator("#riverActions button").first.click()
        press("riverBoard", "M")
        press("riverBoard", "A")
        page.locator("#riverActions").get_by_role("button", name="Affe").click()
        expect(page.locator("#riverTitle")).to_have_text("Zwei Zehen")
        page.locator("#homeLink").click()

        page.locator("#bookLink").click()
        expect(page.locator("#bookAreas .area-tile.started")).to_have_count(3)
        expect(page.locator("#bookAreas")).to_contain_text("Post")
        expect(page.locator("#awards .badge")).to_have_count(5)
        expect(page.locator("#awards .earned")).to_have_count(2)  # Selbst gelöst, Drei Wege
        expect(page.locator("#bookGoal")).to_contain_text("Nächstes Abzeichen")

        # An album from before PR #9 (only stickers) opens unchanged.
        old = {"clips": {}, "words": {"ma": ["Mama"], "mi": ["Mimi"]}, "stickers": ["Frosch"]}
        page.evaluate("""async (old) => {
          const tx=db.transaction('app','readwrite');const s=tx.objectStore('app');
          for (const k of ['silbenpfad:v1','fluss:v1','post-album']) s.delete(k);
          s.put(old,'family');await new Promise(r=>tx.oncomplete=r);
        }""", old)
        page.reload()
        page.wait_for_function('typeof db!=="undefined" && !!db')
        page.locator("#bookLink").click()
        expect(page.locator("#bookText")).to_contain_text("1 von ")
        expect(page.locator("#bookAreas .area-tile.started")).to_have_count(1)
        expect(page.locator("#awards .earned")).to_have_count(1)  # Erster Fund
        assert page.evaluate("readPost('family')") == old
        assert not errors, errors
        print("PASS", width, height, "Kopfzeile zeigt Silbenpfad, Post und Fluss; altes Album unverändert", flush=True)
        ctx.close()
