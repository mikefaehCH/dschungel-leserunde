"""Check the continuous road across the clearing and its growing horizon."""
import mimetypes
import os
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
url = "https://mikefaehch.github.io/dschungel-leserunde/"
with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.getenv("CHROMIUM_PATH"), args=["--no-sandbox"],
        proxy={"server": os.environ["CAMP_TEST_PROXY"]} if os.getenv("CAMP_TEST_PROXY") else None,
    )
    for width, height in [(744, 1133), (1133, 744), (375, 667)]:
        context = browser.new_context(viewport={"width": width, "height": height}, ignore_https_errors=True, has_touch=True)
        if "--live" not in sys.argv:
            def serve(route):
                name = route.request.url.split(url)[1].split("?")[0] or "index.html"
                route.fulfill(body=(root / name).read_bytes(), content_type=mimetypes.guess_type(name)[0] or "application/octet-stream")
            context.route(url + "**", serve)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(url)
        expect(page.locator("#journeyStops button:disabled")).to_have_count(10)
        page.wait_for_function("document.querySelector('#continuousPath path').hasAttribute('d')")
        geometry = page.evaluate("""() => {
            const clearing = document.querySelector('.clearing').getBoundingClientRect();
            const expedition = document.querySelector('#expeditionPath').getBoundingClientRect();
            const road = document.querySelector('#continuousPath path');
            return { gap: expedition.top - clearing.bottom,
                background: getComputedStyle(road.parentElement).backgroundColor,
                moves: (road.getAttribute('d').match(/M/g)||[]).length,
                overflow: document.documentElement.scrollWidth > innerWidth };
        }""")
        assert abs(geometry['gap']) < 1, geometry
        assert geometry['moves'] == 1 and not geometry['overflow'], geometry
        assert geometry['background'] == 'rgba(0, 0, 0, 0)', geometry
        page.evaluate("scrollTo(0, document.querySelector('.clearing').offsetHeight - innerHeight / 2)")
        page.screenshot(path=f"/tmp/continuous-seam-{width}.png")
        for _ in range(2):
            previous = page.locator("#journeyBeyond").evaluate("el => el.offsetHeight")
            page.locator("#journeyHorizon").scroll_into_view_if_needed()
            page.wait_for_function("old => document.querySelector('#journeyBeyond').offsetHeight > old", arg=previous)
        expect(page.locator("#journeyStops .journey-stop")).to_have_count(10)
        page.locator("#journeyTop").click()
        page.wait_for_function("scrollY < 50")
        assert not errors, errors
        print(f"PASS {width}x{height}: unbroken road, growing horizon, grey animals, return", flush=True)
        context.close()
    browser.close()
