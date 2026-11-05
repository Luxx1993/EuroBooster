# EZB Euro-Münzen

Dieses Dokument beschreibt die **Euro-Münzen** der 25 Länder, die Euro-Münzen prägen.

## Euro-Länder

### Eurozone (20 Länder)
- **DE** - Deutschland
- **AT** - Österreich
- **BE** - Belgien
- **CY** - Zypern
- **EE** - Estland
- **FI** - Finnland
- **FR** - Frankreich
- **GR** - Griechenland
- **IE** - Irland
- **IT** - Italien
- **HR** - Kroatien
- **LV** - Lettland
- **LT** - Litauen
- **LU** - Luxemburg
- **MT** - Malta
- **NL** - Niederlande
- **PT** - Portugal
- **SK** - Slowakei
- **SI** - Slowenien
- **ES** - Spanien

### Kleinstaaten mit Euro-Prägerecht (4 Länder)
- **AD** - Andorra
- **MC** - Monaco
- **SM** - San Marino
- **VA** - Vatikanstadt


## Münzwerte

Alle Länder prägen Münzen in diesen 8 Werten:
- 1 Cent
- 2 Cent
- 5 Cent
- 10 Cent
- 20 Cent
- 50 Cent
- 1 € (100 Cent)
- 2 € (200 Cent)

## Bildstruktur

Die Münzbilder sind in folgender Struktur organisiert:

```
images/coins/
├── DE/
│   ├── 1cent_national.jpg
│   ├── 2cent_national.jpg
│   ├── 5cent_national.jpg
│   ├── 10cent_national.jpg
│   ├── 20cent_national.jpg
│   ├── 50cent_national.jpg
│   ├── 100cent_national.jpg
│   └── 200cent_national.jpg
├── FR/
│   ├── 1cent_national.jpg
│   └── ...
├── ...
├── VA/
│   └── ...
└── common/
    ├── 1cent_common.jpg
    ├── 2cent_common.jpg
    ├── 5cent_common.jpg
    ├── 10cent_common.jpg
    ├── 20cent_common.jpg
    ├── 50cent_common.jpg
    ├── 100cent_common.jpg
    └── 200cent_common.jpg
```

Die **Nationalseiten** zeigen landesspezifische Motive, während die **Gemeinschaftsseiten** für alle Länder gleich sind und europäische Motive zeigen.

## Kartenbilder

Für die App werden die Münzbilder in Hochformat (400 × 760 px) konvertiert und in `images/coin_cards/` gespeichert:

```
images/coin_cards/
├── DE/
│   ├── 1cent_national.jpg
│   ├── 2cent_national.jpg
│   └── ...
├── FR/
│   └── ...
└── ...
```

## Skripte

### `scripts/download_ezb_coins.py`
Python-Skript zum Herunterladen aller EZB-Münz-Bilder.

**Verwendung:**
```bash
python3 scripts/download_ezb_coins.py
```

Das Skript lädt alle Nationalseiten und Gemeinschaftsseiten von der EZB-Website herunter.

### `scripts/build_coin_images.py`
Python-Skript zum Erzeugen der Kartenbilder im Hochformat.

**Verwendung:**
```bash
python3 scripts/build_coin_images.py
```

Das Skript konvertiert die Originalbilder in das Format 400 × 760 px für die App.

## Bildquellen

Die Bilder der Euro-Münzen stammen von der offiziellen EZB-Website:
- [EZB - Euro-Münzen](https://www.ecb.europa.eu/euro/coins/html/index.de.html)
- [EZB - Münzbilder](https://www.ecb.europa.eu/euro/coins/shared/img/coins/)

## Nutzungsbedingungen

Die Bilder der Euro-Münzen unterliegen den Nutzungsbedingungen der EZB:

✅ **Erlaubt:**
- Verwendung zu Informations-, redaktionellen und Berichterstattungszwecken
- Verwendung in nicht-kommerziellen Projekten

❌ **Nicht erlaubt:**
- Kommerzielle Nutzung
- Verwendung zu Werbe- oder Merchandisingzwecken
- Jegliche Veränderung der Bilder
- Irreführende Darstellung
- Verwendung, die eine Billigung durch die EZB oder das Eurosystem nahelegt

📝 **Pflicht:**
- Kennzeichnung als "Euro-Münze"
- Angabe der EZB als Quelle

## Integration in die App

In `js/data.js` sind die Münzbilder über `COIN_CARD_IMAGES` referenziert:

```javascript
const COIN_CARD_IMAGES = 'images/coin_cards';
```

Die App kann die Bilder wie folgt verwenden:
```javascript
const imgPath = `${D.COIN_CARD_IMAGES}/${countryCode}/${value}cent_national.jpg`;
```

---

*Stand: November 2026*
