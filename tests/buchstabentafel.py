"""Open the illustrated chart from the camp and inspect every card on a tablet."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    for width, height in [(744, 1133), (1133, 744)]:
        page = browser.new_page(viewport={"width": width, "height": height}, has_touch=True)
        page.goto((root / "index.html").as_uri())
        page.locator("#bookLink").click()
        page.get_by_role("link", name="Aa · Buchstabentafel öffnen ›").click()
        cards = page.locator(".tile")
        assert cards.count() == 37
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        for card in cards.all():
            card.tap()
            dialog = page.get_by_role("dialog")
            assert dialog.get_attribute("aria-label") == card.get_attribute("aria-label")
            picture = dialog.locator(".image > *").bounding_box()
            assert picture and min(picture["width"], picture["height"]) >= 100
            dialog.get_by_role("button").tap()
            assert not dialog.is_visible()
        assert page.get_by_role("link", name="Zur Lichtung").get_attribute("href") == "./"
        page.close()
    browser.close()
