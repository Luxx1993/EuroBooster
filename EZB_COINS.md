# Euro-Münzen in EUROPACK

Die Münzen im Münz-Booster stammen aus 25 Prägeländern: den 21 Ländern des Euroraums und den vier Kleinstaaten mit eigenem Prägerecht. Bulgarien gehört seit dem 1. Januar 2026 zum Euroraum; der Lew war nur bis Ende Januar 2026 parallel gültig.

## Länder

**Euroraum (21):** Belgien (BE), Bulgarien (BG), Deutschland (DE), Estland (EE), Finnland (FI), Frankreich (FR), Griechenland (GR), Irland (IE), Italien (IT), Kroatien (HR), Lettland (LV), Litauen (LT), Luxemburg (LU), Malta (MT), Niederlande (NL), Österreich (AT), Portugal (PT), Slowakei (SK), Slowenien (SI), Spanien (ES), Zypern (CY)

**Kleinstaaten mit Prägerecht (4):** Andorra (AD), Monaco (MC), San Marino (SM), Vatikanstadt (VA)

Jedes Land prägt acht Werte: 1, 2, 5, 10, 20 und 50 Cent, 1 € und 2 €. Dazu kommen 2-€-Gedenkmünzen.

## Darstellung in der App

Die Fotos werden nicht direkt gezeigt. `js/coin3d.js` rendert jede Münze im Code als 3D-Scheibe (WebGL-Raytracing):

- **Metall** nach Wert: Kupfer (1–5 Cent), Nordisches Gold (10–50 Cent), Bimetall bei 1 € (Kern silbern, Ring golden) und 2 € (Kern golden, Ring silbern)
- **Dicke und Rand**, geriffelt bei 10 Cent, 50 Cent und 2 €
- **Relief** aus dem Foto der Nationalseite: Helligkeitsunterschiede werden zu Erhebungen, Licht und Spiegelungen wandern darüber
- **Gemeinschaftsseite** im Code gezeichnet (Wert, „EURO“/„EURO CENT“, zwölf Sterne, Linien)
- **Animation:** Einwurf mit Drehung im Pack, leichtes Wiegen, Neigung nach Finger oder Gerätesensor in der Einzelansicht, „Wenden“

Ohne WebGL erscheint eine gezeichnete Münze mit Flagge und Wert.

## Dateien

```
images/coins/<Land>/<Cent>cent_national.jpg     Originale der Nationalseiten (nur im Repo)
images/coins/commemoratives/<Jahr>_<land>-<Nr>.jpg  Originale der Gedenkmünzen (nur im Repo)
images/coin_web/<Land>/<Cent>.webp               runde Relief-Vorlagen, 256 px (online)
images/coin_web/commemoratives/<…>.webp           dito für Gedenkmünzen
js/coins.js                                      Verzeichnis der Gedenkmünzen (erzeugt)
```

## Skripte

1. `python3 scripts/download_ezb_coins.py` – lädt die Originale aus der Sammlung [lucephile/euro-coin-images](https://github.com/lucephile/euro-coin-images) und wandelt sie in JPEG um.
2. `python3 scripts/build_coin_web.py` – sucht in jedem Foto den Umriss der Münze (Hintergrund von den Ecken aus füllen, sonst Kreissuche), schneidet sie rund aus und speichert sie als WebP mit transparentem Hintergrund. Die Originale haben gemischte Hintergründe (weiß, schwarz, kariert) und sitzen teils nicht mittig.
3. `python3 scripts/build_coin_index.py` – schreibt `js/coins.js` mit allen Gedenkmünzen bis zum laufenden Jahr.

## Bekannte Lücken

- Gedenkmünzen der Niederlande, San Marinos und Bulgariens fehlen: Das Download-Skript schnitt Ländernamen mit Bindestrich ab („pays-bas“, „saint-marin“), und Bulgarien war nicht zugeordnet. Beides ist im Skript behoben; die Bilder kommen beim nächsten Download dazu.
- Echte Fotos der Gemeinschaftsseiten gibt es nicht; die Rückseite wird im Code gezeichnet.

## Bildnachweis

Motive der Nationalseiten und Gedenkmünzen: die jeweiligen Ausgabeländer. Bildquelle: Sammlung [lucephile/euro-coin-images](https://github.com/lucephile/euro-coin-images). Verwendet im Rahmen redaktioneller Berichterstattung, als Relief-Vorlage für im Code gerenderte Münzen.

*Stand: November 2026*
