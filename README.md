# EuroBooster – EUROPACK

**Kauf Geld, mit Geld.**

Ein Sammelspiel mit den neuen Euro-Banknoten: Ein Booster kostet 50 € und enthält fünf zufällige Scheine, mal 30 €, mal 250 € wert, im Schnitt 45,75 €. Statt Monstern sammelt man Beethoven, Marie Curie und Eisvögel. Digital gibt es keine Druckkosten, also sind alle zehn Entwürfe der EZB gültiges Geld – 60 verschiedene Scheine, dazu Münzen aus 25 Ländern. Seltene Seriennummern und Special Editions wie Holo oder Gold machen auch einen 5er zum Highlight. Doppelte tauscht man 1:1, weil es ja Geld ist.

Die Pointe: Ausgerechnet die Zentralbank, die für Preisstabilität sorgt, betreibt die erfolgreichste Lootbox Europas, und die Bank gewinnt immer.

> Satire-Prototyp mit Spielgeld – kein Produkt der EZB, kein echtes Geld, kein Glücksspielangebot.

Das vollständige Konzept steht in [`docs/konzept.md`](docs/konzept.md). Dieser Prototyp setzt die „Variante C – Digital“ als Browser-App um.

## Starten

Keine Installation, kein Build. `index.html` im Browser öffnen – oder lokal servieren, damit es auch auf dem Handy läuft:

```sh
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

**Online (GitHub Pages):** Nach jedem Merge auf `main` veröffentlicht der Workflow `.github/workflows/pages.yml` die App unter `https://luxx1993.github.io/EuroBooster/`. Einmalig nötig: in den Repo-Einstellungen unter *Settings → Pages → Build and deployment → Source* „GitHub Actions“ wählen. Bei Pull Requests laufen nur die Tests.

Der Spielstand liegt im `localStorage` des Browsers und lässt sich im Profil (Tipp auf das Guthaben) zurücksetzen.

## Was drin ist

| Bereich | Umsetzung |
| --- | --- |
| Shop | Schein-Booster (50 €, 5 Scheine) und Münz-Booster (3 €, 10 Münzen), offene Quoten pro Slot und Verteilung des Packwerts |
| Pack-Opening | Aufreißen per Wischen über die Oberkante (Doppeltipp oder Enter als Alternative), Vorahnungs-Licht in der Farbe des besten Scheins, gewöhnliche Slots einzeln, Trennkarte, Stufen-Reveal (Druckland → Druckerei → Entwurf), Hit-Effekte, Seriennummer tippt sich ein |
| Übersicht | Aufgefächerte Scheine mit Hit in der Mitte, hochlaufender Packwert, „Bank gewinnt“ oder „Du schlägst die EZB“, Ins Album / Noch ein Pack / Teilen |
| Münzen | Im Code gerenderte 3D-Münzen (WebGL): Metall je Wert (Kupfer, Nordisches Gold, Bimetall bei 1 € und 2 €), Dicke und geriffelter Rand, Relief aus dem Foto der Nationalseite, erzeugte Gemeinschaftsseite. Im Pack ein Münzwurf: von unten hereingeworfen, Landung auf der Zahl (für alle Länder gleich), dann Umdrehen auf die Bildseite – erst dann steht das Land fest. Im Album per Ziehen 360° drehbar, in der Einzelansicht folgen sie Finger oder Neigung, „Wenden“ zeigt die Rückseite. Im Hit-Slot echte 2-€-Gedenkmünzen (568 aus 22 Ländern, 2004–2026). Ohne WebGL erscheint eine gezeichnete Münze |
| Album | Scheine (10 Entwürfe × 6 Stückelungen = 60), Münzen (25 Länder × 8), Gedenkmünzen als Zeitleiste, Tresor für Special Editions; Set-Bonus bei voller Seite |
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
test/images.test.js Prüft, dass jede Karte ein Bild hat
images/designs/     EZB-Originale Banknoten (120 Bilder, nur im Repo, nicht online)
images/cards/       Banknoten-Kartenbilder im Hochformat, 400 × 760 px
images/coins/       Münz-Originale: Nationalseiten (25 Länder × 8 Werte) und 569 Gedenkmünzen, nur im Repo
images/coin_web/    Runde Relief-Vorlagen (256 px, WebP) für die 3D-Münzen, online
js/coin3d.js        Münzen in 3D: WebGL-Raytracing mit Metall, Rand, Relief und erzeugter Rückseite
js/coins.js         Verzeichnis der Gedenkmünzen (erzeugt)
scripts/            Download der Originale, Erzeugen der Kartenbilder
docs/konzept.md     Konzept und App-Spezifikation
```

## Quoten prüfen

```sh
node --test test/engine.test.js
```

Der Test rechnet die Verteilung exakt aus und prüft die Zahlen aus dem Konzept: Erwartungswert 45,75 €, Median 40 €, 39 % bei 30–35 €, 24 % ab 50 €, 0,5 % ab 200 €; beim Münz-Booster rund 2,62 € (87 %).

## Annahmen

- **Alle Entwürfe gültig:** Digital gibt es keine Druckkosten, deshalb sind alle zehn EZB-Entwürfe gültiges Geld – egal, welchen der EZB-Rat für die gedruckte Serie wählt. Jeder Schein im Pack bekommt einen zufälligen Entwurf.
- **Häufigkeit der Entwürfe:** Gleichverteilt (`DESIGN_WEIGHTS` in `js/data.js`); später z. B. nach dem Ergebnis der EZB-Umfrage gewichtbar.
- **Farben der Stückelungen:** Farbcodes der heutigen Serie.
- **Format:** Alle Scheine werden hochkant dargestellt, wie bei den Hochformat-Entwürfen D, G, I und J.
- **Bilder:** Die Karten zeigen die echten Gestaltungsvorschläge der EZB, verwendet im Rahmen redaktioneller Berichterstattung. `scripts/build_card_images.py` erzeugt aus den Originalen in `images/designs/` die Kartenbilder in `images/cards/`: Querformat-Entwürfe werden um 90° gedreht, alle auf 1:1,9 zugeschnitten. Online veröffentlicht werden nur die Kartenbilder. Fehlt ein Bild, zeigt die Karte den gezeichneten Platzhalter.
- **Wirtschaft:** Der Nennwert der Inhalte wird dem Guthaben gutgeschrieben, das Exemplar landet im Album. So kostet ein Schein-Booster im Schnitt 4,25 €.

## Bildnachweis

Banknotenmotive: © Europäische Zentralbank, [Gestaltungsvorschläge für die künftigen Euro-Banknoten](https://www.ecb.europa.eu/euro/banknotes/future_banknotes/html/design-proposals.de.html) (2026), Entwürfe A–J der jeweils genannten Gestalterinnen und Gestalter. Verwendet im Rahmen redaktioneller Berichterstattung; für die Karten auf Hochformat zugeschnitten und Querformat-Entwürfe gedreht. Die Entwürfe sind kein gesetzliches Zahlungsmittel.

Münzmotive: Nationalseiten und 2-€-Gedenkmünzen der 25 Euro-Prägeländer (21 Euro-Länder einschließlich Bulgarien seit 1. Januar 2026, dazu Andorra, Monaco, San Marino, Vatikanstadt); die Rechte an den Motiven liegen bei den Ausgabeländern. Bildquelle: Sammlung [lucephile/euro-coin-images](https://github.com/lucephile/euro-coin-images). Die App zeigt die Fotos nicht direkt: Sie dienen als Relief-Vorlage für im Code gerenderte 3D-Münzen. Verwendet im Rahmen redaktioneller Berichterstattung.
