# Anleitung: Euro-Münzbilder herunterladen und integrieren

## Übersicht

Dieses Projekt verwendet echte Euro-Münzbilder von der Europäischen Zentralbank (EZB). 
Die Banknoten-Bilder sind bereits integriert. Für die Münzen müssen die Bilder noch heruntergeladen werden.

## Schritt 1: Münzbilder herunterladen

Führe das Download-Skript aus:

```bash
cd /workspace/github__Luxx1993__EuroBooster
python3 scripts/download_ezb_coins.py
```

Dieses Skript:
- Erstellt das Verzeichnis `images/coins/`
- Lädt alle Nationalseiten der 25 Euro-Prägeländer herunter
- Lädt die Gemeinschaftsseiten für alle 8 Münzwerte herunter
- Speichert die Bilder in der Struktur: `images/coins/{LAND}/{WERT}cent_{SEITE}.jpg`

**Hinweis:** Falls einige Bilder nicht heruntergeladen werden können, könnte die EZB die URLs geändert haben. In diesem Fall bitte die URLs im Skript anpassen.

## Schritt 2: Münz-Kartenbilder erzeugen

Führe das Build-Skript aus, um die Kartenbilder im Hochformat zu erstellen:

```bash
python3 scripts/build_coin_images.py
```

Dieses Skript:
- Konvertiert alle Münzbilder in das Format 400 × 760 px (Hochformat)
- Speichert die Bilder in `images/coin_cards/`
- Behält die Verzeichnisstruktur bei

**Voraussetzung:** Python-Paket `Pillow` muss installiert sein:
```bash
pip install Pillow
```

## Schritt 3: Tests ausführen

Prüfe, ob alle Bilder korrekt integriert sind:

```bash
node --test test/images.test.js
```

Dieser Test prüft:
- ✅ Alle Banknoten-Kartenbilder existieren
- ✅ Alle Münz-Kartenbilder existieren
- ✅ Alle Bilder sind klein genug für mobile Geräte (< 150 KB)

## Alternative: Manuell Bilder herunterladen

Falls das Download-Skript nicht funktioniert, können die Bilder manuell von der EZB-Website heruntergeladen werden:

1. Gehe zu: https://www.ecb.europa.eu/euro/coins/shared/img/coins/
2. Lade alle Bilder herunter
3. Organisiere sie in der Struktur:
   ```
   images/coins/
   ├── DE/
   │   ├── 1cent_national.jpg
   │   ├── 2cent_national.jpg
   │   └── ...
   ├── FR/
   │   └── ...
   └── common/
       ├── 1cent_common.jpg
       └── ...
   ```

## Dateistruktur

Nach dem Herunterladen und Verarbeiten sollten folgende Verzeichnisse existieren:

```
images/
├── designs/          # EZB Banknoten-Designs (bereits vorhanden)
│   ├── design_A/
│   │   ├── 5euro_front.jpg
│   │   └── ...
│   └── design_J/
│       └── ...
├── cards/            # Banknoten-Kartenbilder (bereits vorhanden)
│   ├── A/
│   │   ├── 5_front.jpg
│   │   └── ...
│   └── J/
│       └── ...
├── coins/            # EZB Münz-Originale (nach Schritt 1)
│   ├── DE/
│   │   ├── 1cent_national.jpg
│   │   └── ...
│   └── common/
│       └── ...
└── coin_cards/       # Münz-Kartenbilder (nach Schritt 2)
    ├── DE/
    │   ├── 1cent_national.jpg
    │   └── ...
    └── ...
```

## Integration in die App

Die Münzbilder sind in der App bereits integriert:

- **Datenstruktur:** `js/data.js` enthält `COIN_CARD_IMAGES = 'images/coin_cards'`
- **Tests:** `test/images.test.js` prüft die Existenz aller Münzbilder
- **Dokumentation:** `EZB_COINS.md` beschreibt die Münzen im Detail

## Bildquellen

- **Banknoten:** https://www.ecb.europa.eu/euro/banknotes/future_banknotes/html/design-proposals.de.html
- **Münzen:** https://www.ecb.europa.eu/euro/coins/html/index.de.html

## Nutzungsbedingungen

Die Bilder unterliegen den EZB-Nutzungsbedingungen:
- ✅ Erlaubt: Informations-, redaktionelle und Berichterstattungszwecke
- ✅ Erlaubt: Nicht-kommerzielle Nutzung
- ❌ Nicht erlaubt: Kommerzielle Nutzung oder Veränderung der Bilder
- 📝 Pflicht: Kennzeichnung als "Euro-Münze" und Angabe der EZB als Quelle

---

**Stand:** November 2026
