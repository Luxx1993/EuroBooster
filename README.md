# EuroBooster – EUROPACK

**Kauf Geld, mit Geld.**

Ein Sammelspiel mit den neuen Euro-Banknoten: Ein Booster kostet 50 € und enthält fünf zufällige Scheine, mal 30 €, mal 250 € wert, im Schnitt 45,75 €. Statt Monstern sammelt man Beethoven, Marie Curie und Eisvögel. Dazu kommen die nie gedruckten Entwürfe der EZB als Prototyp-Karten und Münzen aus 25 Ländern. Seltene Seriennummern und Special Editions wie Holo oder Gold machen auch einen 5er zum Highlight. Doppelte tauscht man 1:1, weil es ja Geld ist.

Die Pointe: Ausgerechnet die Zentralbank, die für Preisstabilität sorgt, betreibt die erfolgreichste Lootbox Europas, und die Bank gewinnt immer.

> Satire-Prototyp mit Spielgeld – kein Produkt der EZB, kein echtes Geld, kein Glücksspielangebot.

Das vollständige Konzept steht in [`docs/konzept.md`](docs/konzept.md). Dieser Prototyp setzt die „Variante C – Digital“ als Browser-App um.

## Starten

Keine Installation, kein Build. `index.html` im Browser öffnen – oder lokal servieren, damit es auch auf dem Handy läuft:

```sh
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Der Spielstand liegt im `localStorage` des Browsers und lässt sich im Profil (Tipp auf das Guthaben) zurücksetzen.

## Was drin ist

| Bereich | Umsetzung |
| --- | --- |
| Shop | Schein-Booster (50 €, 5 Scheine + Prototyp-Karte) und Münz-Booster (3 €, 10 Münzen), offene Quoten pro Slot und Verteilung des Packwerts |
| Pack-Opening | Aufreißen per Wischen über die Oberkante (Doppeltipp oder Enter als Alternative), Vorahnungs-Licht in der Farbe des besten Scheins, gewöhnliche Slots einzeln, Trennkarte, Stufen-Reveal (Druckland → Druckerei → Stückelung), Hit-Effekte, Seriennummer tippt sich ein, Prototyp-Bonus |
| Übersicht | Aufgefächerte Scheine mit Hit in der Mitte, hochlaufender Packwert, „Bank gewinnt“ oder „Du schlägst die EZB“, Ins Album / Noch ein Pack / Teilen |
| Album | Echte Serie, Prototypen (9 Entwürfe × 6), Münzen (25 Länder × 8), Gedenkmünzen als Zeitleiste, Tresor für Special Editions; Set-Bonus bei voller Seite |
| Einzelansicht | Holo-Neigung per Maus oder Gerätesensor, Wenden per Wischen, Steckbrief mit Seriennummer, Druckerei, Edition, Exemplaren |
| Special Editions | Holo, Glitzer, Tinte, Gold, Alternativmotiv, Fehldruck, Zentralbank-Pack (God Pack) |
| Tausch | Doppelte 1:1 zum gleichen Nennwert mit simulierten Sammlern tauschen; bevorzugt kommt, was dir fehlt. Der eigene Schein fliegt über die obere Bildschirmkante hinaus, der neue kommt von oben herein |
| Wallet | Guthaben, Scheinstapel, Daily Drop, Haltelimit („Kartenbox ist voll“) |
| Einstellungen | Haptik, Ton, Bewegung reduzieren, Ausgabelimit pro Tag |

## Dateien

```
index.html          App-Gerüst
css/styles.css      Design: irisierender Verlauf, Bühne, Scheine, Münzen, Effekte
js/data.js          Katalog, Quoten, Editionen – hier wird feinjustiert
js/engine.js        Zufall und Pack-Logik ohne DOM, in Node testbar
js/app.js           Oberfläche, Opening-Ablauf, Album, Spielstand
test/engine.test.js Prüft die Zahlen aus dem Konzept
docs/konzept.md     Konzept und App-Spezifikation
```

## Quoten prüfen

```sh
node --test test/engine.test.js
```

Der Test rechnet die Verteilung exakt aus und prüft die Zahlen aus dem Konzept: Erwartungswert 45,75 €, Median 40 €, 39 % bei 30–35 €, 24 % ab 50 €, 0,5 % ab 200 €; beim Münz-Booster rund 2,62 € (87 %).

## Annahmen

- **Siegerdesign:** Die EZB entscheidet voraussichtlich im Dezember 2026. Bis dahin ist Entwurf C als Platzhalter gesetzt (`WINNER_DESIGN` in `js/data.js`).
- **Prototyp-Seltenheit:** Gleichverteilt, bis das Umfrageergebnis bekannt ist (`PROTOTYPE_WEIGHTS`).
- **Farben der Stückelungen:** Farbcodes der heutigen Serie.
- **Format:** Alle Scheine werden hochkant dargestellt, wie bei den Hochformat-Entwürfen D, G, I und J.
- **Bilder:** Keine Reproduktionen der EZB-Entwürfe – Platzhalter mit Motivname und Stückelungsfarbe.
- **Wirtschaft:** Der Nennwert der Inhalte wird dem Guthaben gutgeschrieben, das Exemplar landet im Album. So kostet ein Schein-Booster im Schnitt 4,25 €.
