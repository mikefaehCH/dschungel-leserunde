# Emilias Dschungelcamp

Die Lichtung führt zum Tukan (Anfangssilben, Buchstaben und Lesewörter), zum Frosch (Silben klatschen und Wörter bauen), zum Affen (MA wiederfinden und legen) und zum Jaguar (MI nachfahren, erkennen und legen). Entdeckungen bleiben im lokalen Forscherbuch.

Im [Elternbereich](eltern.html) zeigt das Stimmenstudio die priorisierten Karten pro Abenteuer. Im Kinderbereich spielen Aufnahmen aus Mikes Zugang und von Mike bestätigte frühere Aufnahmen. Bereits gespeicherte Clips lassen sich probehören und bestätigen. Stimmenpakete der ersten Version bleiben importierbar. Aufnahmen und Fortschritt liegen im lokalen Browser.

## Das Geheimnis am Fluss

Das Flussbild auf der Lichtung öffnet drei kurze Besuche. Emilia verbindet M und A, wählt ihren Begleiter und folgt einem Wort bis zum Fundstück. Das Forscherbuch merkt sich den nächsten Besuch. Nach dem Abschluss kann sie ihr Titelbild wählen, jemandem das Rätsel stellen, zwölf weitere Forscherbriefe öffnen oder das Lagerfeuer-Kino anschauen. Fünf verschiedene Tagesmarken legen das Wasserfallbild frei.

Die Flussexpedition ist auch vor der ersten Aufnahme spielbar. Zum Einstieg kann Mike im Studio zuerst MA als zusammenhängende Silbe aufnehmen. Die Familienprofile speichern ihre Aufnahmen getrennt. Für Tests erzeugte Töne bleiben im jeweiligen Testbrowser.

## Silbenpfad

Auf der Lichtung öffnet die Blattmarke MA, MI und LA. Jeder Weg enthält drei Zuordnungen, eine Buchstabenfolge und eine Wortaufgabe. Angefangene Wege lassen sich fortsetzen. Im Forscherbuch öffnet «Meine Silbenfunde» die Sammlung mit abgeschlossenen Runden und dem aktuellen Schritt. Wiederholungen erhalten frühere Funde.

Für den Hörmodus reichen die drei zusammenhängend gesprochenen Silben MA, MI und LA. Im Elternbereich gibt es dafür eine eigene Kartengruppe. Ohne Aufnahme zeigt die Zuordnungsaufgabe die Zielsilbe. Die gespeicherten Beobachtungen unterscheiden den ersten Versuch, weitere Versuche und Hilfe.

## Geprüftes Sprachpaket

Die 34 Clips aus Mikes freigegebenem Drive-Paket sind als verschlüsseltes Paket eingebunden. Beim Anmelden als Mike im Elternbereich werden sie auf diesem Gerät aktiviert. Lange äussere Pausen wurden gekürzt und die Pegel mit begrenzter Verstärkung angepasst. Die Lautanfänge haben einen Sicherheitsabstand. Die Sprechgeschwindigkeit bleibt erhalten.

Fehlende Clips und die zugehörigen Originaldateien aus dem Drive-Paket werden durch die geprüfte Fassung ergänzt beziehungsweise ersetzt. Spätere eigene Aufnahmen und Fortschritte werden beim Zusammenführen berücksichtigt. Die Stimmen liegen danach lokal im selben Browser wie der Kinderbereich. Für ein weiteres Gerät ist einmal die Anmeldung als Mike nötig.

## Browserprüfung

Der Test öffnet zwei frische Browserkontexte im iPad-mini-Format. Er prüft die vier Missionen, den Speicher, die Anmeldung, eine simulierte Mikrofonaufnahme, den Austausch von Clips und den Import eines alten Pakets. Jeder Kontext verwendet ausschliesslich Testdaten.

Python mit Playwright und Chromium vorausgesetzt. Das Passwort für den lokalen Test als Umgebungsvariable CAMP_TEST_PASSWORD bereitstellen. Optional lassen sich CHROMIUM_PATH und CAMP_TEST_PROXY setzen.

```sh
python tests/camp_browser.py
python tests/camp_browser.py --live
```

## Dschungelpost

Auf der Lichtung erscheint jeden lokalen Kalendertag ein kurzer Brief. Die ersten 30 Tagesaufgaben beginnen am 23. November 2026. Danach verschiebt sich die Reihenfolge pro Block um sieben Plätze, der Tierbote wechselt und die Antwortpositionen variieren. Eine gelöste Aufgabe lässt sich beliebig wiederholen. Pro Datum gibt es eine Tiermarke im lokalen Forscherbuch. Das Album zeigt die Gesamtzahl und die sechs jüngsten Marken.

### Die ersten 30 Tage

| Datum | Tier | Aufgabe |
|---|---|---|
| 23.11. | Affe | MA wiederfinden |
| 24.11. | Frosch | BA·NA·NE in Silben klatschen |
| 25.11. | Jaguar | MI aus Buchstaben legen |
| 26.11. | Tukan | Den Anfang von MAMA finden |
| 27.11. | Frosch | Die letzte Silbe von RE·GEN finden |
| 28.11. | Jaguar | MI wiederfinden |
| 29.11. | Affe | MA aus Buchstaben legen |
| 30.11. | Tukan | Den Anfang von MIMI finden |
| 01.12. | Frosch | RE·GEN in Silben klatschen |
| 02.12. | Affe | Die letzte Silbe von MA·MA finden |
| 03.12. | Tukan | RE wiederfinden |
| 04.12. | Jaguar | LA aus Buchstaben legen |
| 05.12. | Affe | Den Anfang von MALER finden |
| 06.12. | Frosch | Die letzte Silbe von BA·NA·NE finden |
| 07.12. | Tukan | MI·MI in Silben klatschen |
| 08.12. | Jaguar | NA wiederfinden |
| 09.12. | Frosch | RE aus Buchstaben legen |
| 10.12. | Tukan | Den Anfang von MIRA finden |
| 11.12. | Affe | Die letzte Silbe von MI·MI finden |
| 12.12. | Jaguar | FROSCH in Silben klatschen |
| 13.12. | Affe | MO wiederfinden |
| 14.12. | Tukan | MO aus Buchstaben legen |
| 15.12. | Frosch | Den Anfang von REGEN finden |
| 16.12. | Jaguar | Die letzte Silbe von MA·LER finden |
| 17.12. | Affe | MA·MA in Silben klatschen |
| 18.12. | Frosch | NE wiederfinden |
| 19.12. | Jaguar | NA aus Buchstaben legen |
| 20.12. | Affe | Den Anfang von BANANE finden |
| 21.12. | Tukan | Die letzte Silbe von MI·RA finden |
| 22.12. | Frosch | MA·LER in Silben klatschen |

Der Silbenpfad hat eine eigene Browserprüfung. Mit CAMP_TEST_PASSWORD prüft sie zusätzlich die LA-Aufnahmekarte und deren Verwendung im Camp.

```sh
python tests/silbenpfad.py
```

```sh
python tests/voice_bundle.py
```
