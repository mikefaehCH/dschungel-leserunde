"""Prüft 60 Kalendertage in einem isolierten Browserprofil."""

import mimetypes
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

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
    page = browser.new_page(
        viewport={"width": 744, "height": 1133},
        timezone_id="Europe/Zurich",
        ignore_https_errors=True,
    )
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    if "--live" not in sys.argv:

        def serve(route):
            name = route.request.url.split(url)[1].split("?")[0] or "index.html"
            route.fulfill(
                body=(root / name).read_bytes(),
                content_type=mimetypes.guess_type(name)[0]
                or "application/octet-stream",
            )

        page.route(url + "**", serve)
    page.clock.install(time="2026-11-23T08:00:00+01:00")
    page.goto(url, timeout=60000)
    expect(page.locator("#dailyInvite")).to_be_visible()
    tasks = page.evaluate(
        """() => Array.from({length:60},(_,n)=>postFor(postDay()+n))"""
    )
    assert len({(t["kind"], t["word"]) for t in tasks[:30]}) == 30
    for n, t in enumerate(tasks):
        page.clock.set_system_time(
            datetime.fromtimestamp(t["day"] * 86400 + 8 * 3600, timezone.utc)
        )
        page.evaluate("window.dispatchEvent(new Event('focus'))")
        page.click("#dailyInvite")
        expect(page.locator("#postAnimal use")).to_have_attribute(
            "href", "art/animals.svg#" + t["animal"].lower()
        )
        choices = page.locator("#postChoices")

        def choose(answer):
            choices.get_by_role("button", name=answer, exact=True).click()

        def solve():
            k = t["kind"]
            if k == "klatschen":
                for _ in t["word"].split("·"):
                    choose("♩ Klatschen")
            elif k == "legen":
                for c in t["word"]:
                    choose(c)
            else:
                expected = t["a"] if k == "anfang" else t["word"].split("·")[-1]
                if n == 0:
                    choose(t["a"])
                    expect(page.locator("#feedback")).to_contain_text("nochmals")
                choose(expected)
            choose("✓ Tiermarke sammeln")
            expect(page.locator("#postTitle")).to_have_text("Deine Tiermarke")

        solve()
        if n == 0:
            choose("↻ Nochmals")
            solve()
        choose("▤ Forscherbuch")
        expect(page.locator("#postTally")).to_contain_text(str(n + 1) + " Tiermark")
        if n == 0:
            page.reload(timeout=60000)
            expect(page.locator("#dailyLabel")).to_contain_text("geschafft")
        else:
            page.click("#homeLink")
    assert not errors, errors
    print(
        "PASS 60 Tage, fünf Aufgabenformen, Fehler, Wiederholen, Neuladen und 60 einzelne Tiermarken."
    )
