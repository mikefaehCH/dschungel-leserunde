"""Check a fresh installed-app profile and a rejected first audio playback."""
import base64
import io
import math
import mimetypes
import os
from pathlib import Path
import struct
import sys
import wave
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
url = "https://mikefaehch.github.io/dschungel-leserunde/"
buf = io.BytesIO()
with wave.open(buf, "wb") as tone:
    tone.setparams((1, 2, 24000, 0, "NONE", ""))
    tone.writeframes(b"".join(struct.pack("<h", int(2500 * math.sin(i * .1))) for i in range(24000)))
clip = "data:audio/wav;base64," + base64.b64encode(buf.getvalue()).decode()

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.getenv("CHROMIUM_PATH"),
        args=["--no-sandbox"],
        proxy={"server": os.environ["CAMP_TEST_PROXY"]} if os.getenv("CAMP_TEST_PROXY") else None,
    )

    def context(standalone):
        ctx = browser.new_context(
            viewport={"width": 744, "height": 1133},
            has_touch=True,
            ignore_https_errors=True,
        )
        if standalone:
            ctx.add_init_script("Object.defineProperty(navigator,'standalone',{get:()=>true})")
        if "--live" not in sys.argv:
            def serve(route):
                name = route.request.url.split(url)[1].split("?")[0] or "index.html"
                route.fulfill(body=(root / name).read_bytes(), content_type=mimetypes.guess_type(name)[0] or "application/octet-stream")
            ctx.route(url + "**", serve)
        return ctx

    def save_voice(page):
        page.wait_for_function('typeof db!=="undefined" && !!db')
        page.evaluate("""async clip => {
            const tx=db.transaction('app','readwrite');
            tx.objectStore('app').put({words:{ma:['Mama'],mi:['Mimi']},stickers:[],clips:{ma:clip},mikeKeys:['ma']},'family');
            await new Promise(resolve=>tx.oncomplete=resolve);
        }""", clip)

    safari = context(False)
    safari_page = safari.new_page()
    safari_page.set_default_navigation_timeout(60000)
    safari_page.goto(url)
    save_voice(safari_page)
    safari_page.reload()
    expect(safari_page.locator("#voiceSetup")).to_be_hidden()

    installed = context(True)
    page = installed.new_page()
    page.set_default_navigation_timeout(60000)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(url)
    expect(page.locator("#voiceSetup")).to_be_visible()
    page.get_by_role("link", name="Stimme einrichten", exact=True).click()
    expect(page.locator("form")).to_be_visible()
    assert page.locator('link[rel="manifest"]').get_attribute("href") == "manifest.webmanifest"
    page.get_by_role("link", name="Zum Dschungelcamp", exact=True).click()
    expect(page.locator("#voiceSetup")).to_be_visible()
    assert len(installed.pages) == 1
    save_voice(page)
    page.reload()
    expect(page.locator("#voiceSetup")).to_be_hidden()
    # Emulate iOS rejecting playback until its explicit retry button is tapped.
    page.evaluate("""() => {
        const original = HTMLMediaElement.prototype.play;
        window.audioAllowed = false;
        HTMLMediaElement.prototype.play = function() {
            if (!window.audioAllowed) return Promise.reject(new DOMException('Gesture required','NotAllowedError'));
            return original.call(this);
        };
        document.addEventListener('click',e=>{
            if(e.target.closest('#audioRetry')) {
                window.audioAllowed = true;
                window.retryWasGesture = navigator.userActivation.isActive;
            }
        },true);
    }""")
    page.locator("#monkeyLink").click()
    expect(page.locator("#audioRetry")).to_be_visible()
    page.locator("#audioRetry").click()
    page.wait_for_function("player && !player.paused && player.readyState>=2")
    expect(page.locator("#audioRetry")).to_be_hidden()
    assert page.evaluate("window.retryWasGesture")
    page.evaluate("window.firstAudio = player")
    page.locator("#trailTools").get_by_role("button", name="◖)) Anhören", exact=True).click()
    assert page.evaluate("player===window.firstAudio")
    page.locator("#homeLink").click()
    assert page.evaluate("player.paused")
    expect(page.locator("#audioRetry")).to_be_hidden()
    assert not errors, errors
    print("PASS getrennte Profile; Einrichtung innerhalb der App; direkter Audiostart; ein Player; Abbruch", flush=True)
    browser.close()
