# Emilias Dschungelcamp

Die Lichtung führt zum Tukan (Anfangssilben, Buchstaben und Lesewörter), zum Frosch (Silben klatschen und Wörter bauen), zum Affen (MA wiederfinden und legen) und zum Jaguar (MI nachfahren, erkennen und legen). Entdeckungen bleiben im lokalen Forscherbuch.

Im [Elternbereich](eltern.html) zeigt das Stimmenstudio die priorisierten Karten pro Abenteuer. Im Kinderbereich spielen Aufnahmen aus Mikes Zugang und von Mike bestätigte frühere Aufnahmen. Bereits gespeicherte Clips lassen sich probehören und bestätigen. Stimmenpakete der ersten Version bleiben importierbar. Aufnahmen und Fortschritt liegen im lokalen Browser.

## Browserprüfung

Der Test öffnet zwei frische Browserkontexte im iPad-mini-Format. Er prüft die vier Missionen, den Speicher, die Anmeldung, eine simulierte Mikrofonaufnahme, den Austausch von Clips und den Import eines alten Pakets. Jeder Kontext verwendet ausschliesslich Testdaten.

Python mit Playwright und Chromium vorausgesetzt. Das Passwort für den lokalen Test als Umgebungsvariable CAMP_TEST_PASSWORD bereitstellen. Optional lassen sich CHROMIUM_PATH und CAMP_TEST_PROXY setzen.

```sh
python tests/camp_browser.py
python tests/camp_browser.py --live
```
