"""Check narration gates, all six stories, resume and retained discoveries."""
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
cases = [
    ("elefant", "LA", "LAMA"),
    ("schildkroete", "MA", "MAMA"),
    ("schlange", "MI", "MIMI"),
    ("schmetterling", "LA", "LAMA"),
    ("faultier", "MA", "MAMA"),
    ("krokodil", "MI", "MIMI"),
]
buf = io.BytesIO()
with wave.open(buf, "wb") as tone:
    tone.setparams((1,2,24000,0,"NONE",""))
    tone.writeframes(b"".join(struct.pack("<h",int(3000*math.sin(i*.1))) for i in range(8000)))
clip = "data:audio/wav;base64," + base64.b64encode(buf.getvalue()).decode()

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.getenv("CHROMIUM_PATH"),args=["--no-sandbox"],
        proxy={"server":os.environ["CAMP_TEST_PROXY"]} if os.getenv("CAMP_TEST_PROXY") else None,
    )
    for width,height in [(744,1133),(1133,744)]:
        ctx = browser.new_context(viewport={"width":width,"height":height},has_touch=True,ignore_https_errors=True)
        if "--live" not in sys.argv:
            def serve(route):
                name=route.request.url.split(url)[1].split("?")[0] or "index.html"
                route.fulfill(body=(root/name).read_bytes(),content_type=mimetypes.guess_type(name)[0] or "application/octet-stream")
            ctx.route(url+"**",serve)
        page=ctx.new_page()
        page.set_default_timeout(10000)
        page.set_default_navigation_timeout(60000)
        errors=[]
        page.on("pageerror",lambda error:errors.append(str(error)))
        page.goto(url)
        expect(page.locator("#journeyStops .waiting")).to_have_count(6)
        expect(page.locator("#journeyStops button:disabled")).to_have_count(6)
        # Existing files without Mike's approval must keep a story grey.
        page.evaluate("""async clip=>{
            const clips=Object.fromEntries(jungleStories.flatMap(s=>storyRecordings(s)).concat(['ma','mi','la']).map(k=>[k,clip]));
            const family={...data,clips,mikeKeys:['ma','mi','la'],stickers:['Frosch'],testMarker:'keep'};
            const tx=db.transaction('app','readwrite');tx.objectStore('app').put(family,'family');
            await new Promise(resolve=>tx.oncomplete=resolve);
        }""",clip)
        page.reload()
        expect(page.locator("#journeyStops .waiting")).to_have_count(6)
        page.evaluate("""async ()=>{
            const tx=db.transaction('app','readwrite');const st=tx.objectStore('app');const r=st.get('family');
            r.onsuccess=()=>{const v=r.result;v.mikeKeys=Object.keys(v.clips);st.put(v,'family')};
            await new Promise(resolve=>tx.oncomplete=resolve);
            window.dispatchEvent(new Event('focus'));
        }""")
        expect(page.locator("#journeyStops .ready")).to_have_count(6)
        def choice(name, container="practiceChoices"):
            page.locator("#"+container).get_by_role("button",name=name,exact=True).click()
        def tool(name): choice(name,"practiceTools")
        for id,syllable,word in cases:
            page.locator("#station-"+id+" button").click()
            expect(page.locator("#practice")).to_have_class("story-mode")
            page.wait_for_function("(id)=>practiceData[id]?.active?.step===0",arg=id)
            for station in range(5):
                if station<3:
                    # Station 3 matches the syllable to a picture or a word.
                    right={"MA":"MALER","MI":"MIKRO","LA":"LAMA"}[syllable] if station==2 else syllable
                    if station==0:
                        choice("MI" if syllable=="MA" else "MA")
                        tool("? Hilfe")
                    choice(right)
                elif station==3:
                    choice(syllable[0]);choice(syllable[1])
                else:
                    choice(word)
                if station==2:
                    page.screenshot(path="/tmp/pfad-"+id+"-"+str(width)+".png")
                tool("➜ Weiter" if station<4 else "✓ Mein Tierfund")
                if station<4:
                    page.wait_for_function("([id,n])=>practiceData[id]?.active?.step===n",arg=[id,station+1])
                if station==1:
                    page.reload()
                    page.locator("#station-"+id+" button").click()
                    page.wait_for_function("(id)=>practiceData[id]?.active?.step===2",arg=id)
            expect(page.locator("#practiceChoices").get_by_role("button",name="↻ Nochmals",exact=True)).to_be_visible()
            tool("⌂ Für heute fertig")
            expect(page.locator("#station-"+id)).to_have_class("journey-stop ready discovered")
        page.locator("#bookLink").click()
        expect(page.locator("#bookText")).to_have_text("7 von 10 Tierfreunden entdeckt")
        expect(page.locator("#journeyFinds .discovered")).to_have_count(6)
        assert page.evaluate("readPost('family').then(v=>v.testMarker)")=="keep"
        assert page.evaluate("readPost('family').then(v=>v.stickers)")==["Frosch"]
        saved=page.evaluate("readPost('tierpfad:v1')")
        assert all(saved[id]["rounds"]==1 for id,_,_ in cases)
        assert page.evaluate("readPost('silbenpfad:v1')") is None
        page.locator("#homeLink").click()
        page.locator("#station-elefant button").click()
        page.wait_for_function("practiceData.elefant?.active?.step===0")
        assert page.evaluate("practiceData.elefant.rounds")==1
        page.locator("#homeLink").click()
        page.evaluate("""async ()=>{
            const tx=db.transaction('app','readwrite');const st=tx.objectStore('app');const r=st.get('family');
            r.onsuccess=()=>{const v=r.result;delete v.clips['tier-elefant-5'];st.put(v,'family')};
            await new Promise(resolve=>tx.oncomplete=resolve);
        }""")
        page.reload()
        expect(page.locator("#station-elefant button")).to_be_disabled()
        expect(page.locator("#journeyStops .ready")).to_have_count(5)
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
        assert not errors,errors
        print("PASS",width,height,"sechs Geschichten; Stimmfreigabe; Resume; Funde; Wiederholen; fehlender Schlussclip",flush=True)
        ctx.close()
    if os.getenv("CAMP_TEST_PASSWORD"):
        ctx = browser.new_context(viewport={"width":744,"height":1133},ignore_https_errors=True)
        if "--live" not in sys.argv:
            ctx.route(url+"**",serve)
        page = ctx.new_page()
        page.set_default_navigation_timeout(60000)
        page.goto(url+"eltern.html")
        page.fill("#user","mike")
        page.fill("#pw",os.environ["CAMP_TEST_PASSWORD"])
        page.locator("form button").click()
        expect(page.locator("#studio")).to_be_visible()
        expect(page.locator("#clip")).to_have_value("tier-elefant-0")
        page.select_option("#clip","tier-krokodil-0")
        for index in range(6):
            expect(page.locator("#clip")).to_have_value("tier-krokodil-"+str(index))
            expect(page.locator("#where")).to_contain_text("Krokodil")
            page.locator("#file").set_input_files({"name":"dummy.wav","mimeType":"audio/wav","buffer":buf.getvalue()})
            page.locator("#preview").click()
            page.locator("#use").click()
            expect(page.locator("#feedback")).to_contain_text("gespeichert")
        expect(page.locator("#readiness")).to_contain_text("Krokodil 7/7")
        page.goto(url)
        expect(page.locator("#station-krokodil button")).to_be_enabled()
        expect(page.locator("#journeyStops .waiting")).to_have_count(5)
        print("PASS Elternkarten; sechs zusammenhängende Aufnahmen; Tier wird farbig",flush=True)
        ctx.close()
    browser.close()
