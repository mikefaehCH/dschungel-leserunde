"""Verify activation of the encrypted voice bundle in isolated browser profiles."""
import os
import json
import mimetypes
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
url = "https://mikefaehch.github.io/dschungel-leserunde/"
password = os.environ["CAMP_TEST_PASSWORD"]
original_path = os.getenv("CAMP_TEST_VOICE_PACKAGE")
original = json.loads(Path(original_path).read_text()) if original_path else None
with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.getenv("CHROMIUM_PATH"),
        args=["--no-sandbox"],
        proxy={"server": os.environ["CAMP_TEST_PROXY"]} if os.getenv("CAMP_TEST_PROXY") else None,
    )
    for width, height in [(744, 1133), (1133, 744)]:
        ctx = browser.new_context(
            viewport={"width": width, "height": height},
            ignore_https_errors=True,
        )
        if "--live" not in sys.argv:
            def serve(route):
                name = route.request.url.split(url)[1].split("?")[0] or "index.html"
                route.fulfill(
                    body=(root / name).read_bytes(),
                    content_type=mimetypes.guess_type(name)[0] or "application/octet-stream",
                )
            ctx.route(url + "**", serve)
        page = ctx.new_page()
        page.set_default_timeout(15000)
        page.set_default_navigation_timeout(60000)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        def login(user):
            page.goto(url + "eltern.html")
            page.fill("#user", user)
            page.fill("#pw", password)
            page.locator("form button").click()
            expect(page.locator("#studio")).to_be_visible()

        login("mike")
        expect(page.locator("#bundleStatus")).to_contain_text("34 geprüfte Clips")
        expect(page.locator("#readiness")).to_contain_text("Silbenpfad 3/3")
        assert page.evaluate("Object.keys(data.clips).length") == 34
        assert page.evaluate("data.mikeKeys.length") == 34
        ma = page.evaluate("data.clips.ma")
        page.goto(url)
        page.locator("#monkeyLink").click()
        assert page.evaluate("player.src===voice('ma')")
        page.reload()
        page.locator("#monkeyLink").click()
        assert page.evaluate("data.clips.ma") == ma
        # Original audio is upgraded while later recordings and discoveries survive.
        fixture = {
            "words": {"ma": ["Mama"], "mi": ["Mimi"]},
            "clips": {"ma": original["clips"]["ma"] if original else ma, "mi": ma},
            "mikeKeys": ["ma", "mi"],
            "stickers": ["Frosch"],
            "testMarker": "keep",
        }
        page.evaluate("""async family => {
          const tx=db.transaction('app','readwrite');
          tx.objectStore('app').put(family,'family');
          await new Promise(resolve=>tx.oncomplete=resolve);
        }""", fixture)
        login("mike")
        expect(page.locator("#bundleStatus")).to_contain_text("1 eigene Aufnahmen behalten")
        assert page.evaluate("data.clips.ma") == ma
        assert page.evaluate("data.clips.mi") == ma
        assert page.evaluate("data.stickers") == ["Frosch"]
        assert page.evaluate("data.testMarker") == "keep"
        login("teresa")
        expect(page.locator("#bundleStatus")).to_contain_text("Mike")
        assert page.evaluate("Object.keys(data.clips).length") == 0
        if "--live" not in sys.argv:
            ctx.route(url + "voice-bundle.bin*", lambda route: route.fulfill(status=503, body="unavailable"))
            login("mike")
            expect(page.locator("#bundleStatus")).to_contain_text("nicht geladen")
            assert page.evaluate("data.clips.mi") == ma
        assert not errors, errors
        print("PASS", width, height, "34 verschlüsselte Clips; Aktivierung; Wiedergabe; Original-Upgrade; eigene Aufnahmen; Teresa", flush=True)
        ctx.close()
