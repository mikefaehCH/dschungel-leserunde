"""Tools live in their own row with fixed symbols, answers stay separate, and the
post sign shows today's sender as a picture."""

import mimetypes
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
url = "https://mikefaehch.github.io/dschungel-leserunde/"
TOOL_MARKS = ("?", "↻", "◖))", "➜", "⇄", "✕", "⌂", "✓", "▤")

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
        sender = page.evaluate("postFor(postDay()).animal").lower()
        expect(page.locator("#dailyInvite .postbox use")).to_have_attribute("href", "art/animals.svg#" + sender)
        expect(page.locator("#dailyInvite")).to_have_class("post-invite place post-place today")

        def check(answers, tools):
            texts = [t.strip() for t in page.locator("#" + answers + " button").all_inner_texts()]
            assert not [t for t in texts if t.startswith(TOOL_MARKS[:5])], (answers, texts)
            labels = [t.strip() for t in page.locator("#" + tools + " button:visible").all_inner_texts()]
            assert labels and all(l.startswith(TOOL_MARKS) or l.upper() == "WEITER" for l in labels), (tools, labels)
            sizes = page.evaluate("""(ids)=>ids.flatMap(id=>[...document.querySelectorAll('#'+id+' button')].filter(b=>b.offsetParent).map(b=>{const r=b.getBoundingClientRect();return Math.min(r.width,r.height)}))""", [answers, tools])
            assert min(sizes) >= 63.5, (answers, sizes)

        def home():
            page.locator("#homeLink").click()

        page.locator("#missionLink").click()
        page.locator("#nav button").last.click()
        page.locator("#options").get_by_role("button", name="Echo zurückgeben").click()
        page.locator("#nav button").last.click()
        check("options", "nav")
        page.evaluate("stage=4;render()")
        expect(page.locator("#options button")).to_have_count(0)
        check("options", "nav") if page.locator("#options button").count() else None
        home(); page.locator("#frogLink").click(); check("frogOptions", "frogTools")
        home(); page.locator("#monkeyLink").click(); check("trailChoices", "trailTools")
        home(); page.locator("#practiceLink").click()
        page.locator("#practiceChoices button").first.click()
        expect(page.locator("#practiceTools").get_by_role("button", name="➜ Weiter", exact=True)).to_be_visible()
        check("practiceChoices", "practiceTools")
        home(); page.locator("#dailyInvite").click(); check("postChoices", "postActions")
        # The two paintings of Emilia no longer contain an animal: one frog, one toucan per scene.
        assert not errors, errors
        print("PASS", width, height, "Werkzeugleiste getrennt, Symbole, 64 px, Post-Schild mit Tier", flush=True)
        ctx.close()
