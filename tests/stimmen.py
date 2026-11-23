"""Every clip key the camp plays has a card in the voice studio, the studio counts
the Dschungelpost, and the campfire waits for Emilia to turn the page."""

import mimetypes
import os
import re
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
url = "https://mikefaehch.github.io/dschungel-leserunde/"
password = os.environ.get("CAMP_TEST_PASSWORD")
if not password:
    sys.exit("CAMP_TEST_PASSWORD fehlt")

# Literal keys in the child area: play('x'), voice('x'), hear('x') and the campfire frames.
source = "".join((root / f).read_text() for f in ["index.html", "abenteuer.js", "fluss.js", "silbenpfad.js", "dschungelpost.js"])
literal = set(re.findall(r"""(?:voice|play|hear)\(\s*["']([A-Za-z0-9\-]+)["']""", source))
literal |= {f"feuer-{i}" for i in range(5)}
literal |= {"ma", "mi", "ma-slow", "mi-slow", "listen", "hunt", "build", "trace", "read", "end", "intro", "retry", "yes"}
literal -= {"wort-"}

with sync_playwright() as p:
    kind = os.getenv("CAMP_BROWSER", "chromium")  # CAMP_BROWSER=webkit für Safari
    browser = getattr(p, kind).launch(**({"executable_path": os.getenv("CHROMIUM_PATH"), "args": ["--no-sandbox"]} if kind == "chromium" else {}))
    ctx = browser.new_context(viewport={"width": 744, "height": 1133}, has_touch=True)
    if "--live" not in sys.argv:
        def serve(route):
            name = route.request.url.split(url)[1].split("?")[0] or "index.html"
            route.fulfill(body=(root / name).read_bytes(),
                          content_type=mimetypes.guess_type(name)[0] or "application/octet-stream")
        ctx.route(url + "**", serve)
    page = ctx.new_page()
    page.set_default_timeout(60000)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(url)
    page.wait_for_function('typeof db!=="undefined" && !!db')
    # Each post day needs at least one of its possible clip keys.
    post_keys = page.evaluate("""() => postPlan.map((_, i) => {
      const {word} = postFor(postDay(new Date(2026,10,23)) + i);
      const bare = word.split('·').join('');
      return [bare.toLowerCase(), 'wort-' + bare, 'wort-' + bare[0] + bare.slice(1).toLowerCase()];
    })""")
    # Teresa's profile: the studio lists every card without loading Mike's voices.
    page.goto(url + "eltern.html")
    page.fill("#user", "teresa")
    page.fill("#pw", password)
    page.locator("form button").click()
    expect(page.locator("#studio")).to_be_visible()
    cards = set(page.eval_on_selector_all("#clip option", "os=>os.map(o=>o.value)"))
    missing = sorted(k for k in literal if k not in cards)
    assert not missing, ("Clip ohne Studio-Karte", missing)
    days = [keys for keys in post_keys if not any(k in cards for k in keys)]
    assert not days, ("Post-Tag ohne Karte", days)
    expect(page.locator("#readiness")).to_contain_text("Dschungelpost 0/")
    page.select_option("#clip", "fluss-stein")
    expect(page.locator("#scriptText")).to_have_text("Bring M zu A.")
    expect(page.locator("#where")).to_contain_text("Fluss")

    # Campfire: after 20 simulated seconds the first picture is still shown.
    page.clock.install()
    page.goto(url)
    page.wait_for_function('typeof db!=="undefined" && !!db')
    page.evaluate("openRiver().then(()=>fire(0))")
    expect(page.locator("#riverHint")).to_have_text("Der Bach glitzert.")
    page.clock.run_for(20000)
    expect(page.locator("#riverHint")).to_have_text("Der Bach glitzert.")
    expect(page.locator("#riverScene .campfire")).to_have_count(1)
    assert not errors, errors
    print("PASS", len(literal), "Clip-Schlüssel mit Karte; 30 Post-Tage hörbar; Lagerfeuer ohne Autoplay", flush=True)
    ctx.close()
