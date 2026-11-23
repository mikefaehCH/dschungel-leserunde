"""Check the shared clearing and its entry points at tablet and phone sizes."""
import mimetypes
import os
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
url = "https://mikefaehch.github.io/dschungel-leserunde/"
entries = {
    "missionLink": "game",
    "frogLink": "frog",
    "monkeyLink": "trail",
    "catLink": "trail",
    "bookLink": "book",
    "practiceLink": "practice",
    "dailyInvite": "daily",
    "riverLink": "river",
}
with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.getenv("CHROMIUM_PATH"),
        args=["--no-sandbox"],
        proxy={"server": os.environ["CAMP_TEST_PROXY"]} if os.getenv("CAMP_TEST_PROXY") else None,
    )
    for width, height in [(744, 1133), (1133, 744), (768, 1024), (1024, 768), (375, 667)]:
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
                    content_type=mimetypes.guess_type(name)[0] or "application/octet-stream",
                )
            ctx.route(url + "**", serve)
        page = ctx.new_page()
        page.set_default_navigation_timeout(60000)
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(url)
        page.locator("#dailyInvite").wait_for()
        scene = page.locator(".clearing").bounding_box()
        boxes = []
        for entry in entries:
            button = page.locator(".clearing #" + entry)
            expect(button).to_be_visible()
            box = button.bounding_box()
            assert box["width"] >= 64 and box["height"] >= 64, entry
            assert box["x"] >= scene["x"], entry
            assert box["x"] + box["width"] <= scene["x"] + scene["width"], entry
            assert box["y"] >= scene["y"], entry
            assert box["y"] + box["height"] <= scene["y"] + scene["height"], entry
            boxes.append((entry, box))
        for index, (name, a) in enumerate(boxes):
            for other, b in boxes[index + 1:]:
                overlap_x = min(a["x"] + a["width"], b["x"] + b["width"]) - max(a["x"], b["x"])
                overlap_y = min(a["y"] + a["height"], b["y"] + b["height"]) - max(a["y"], b["y"])
                assert overlap_x <= 1 or overlap_y <= 1, (name, other)
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        if width >= 600:
            assert scene["y"] + scene["height"] <= height
        for entry, destination in entries.items():
            page.locator("#" + entry).click()
            expect(page.locator("#" + destination)).to_be_visible()
            page.locator("#homeLink").click()
            expect(page.locator("#home")).to_be_visible()
        assert not errors, errors
        print("PASS", width, height, "gemeinsame Szene; acht Einstiege; Touchflächen; Navigation", flush=True)
        ctx.close()
    browser.close()
