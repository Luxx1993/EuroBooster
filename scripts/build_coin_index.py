#!/usr/bin/env python3
"""
Erzeugt js/coins.js: das Verzeichnis der Gedenkmünzen-Bilder in
images/coins/commemoratives/ (Dateinamen „<jahr>_<land>-<nr>.jpg“ mit
französischen Ländernamen, siehe scripts/download_ezb_coins.py).

Münzen mit einem Jahr nach dem laufenden werden ausgelassen – das sind
angekündigte Motive, die es noch nicht gibt.

Aufruf: python3 scripts/build_coin_index.py
"""
import datetime
import json
import os
import re

SRC = 'images/coins/commemoratives'
OUT = 'js/coins.js'

COUNTRIES = {
    'allemagne': 'DE', 'andorre': 'AD', 'autriche': 'AT', 'belgique': 'BE',
    'bulgarie': 'BG', 'chypre': 'CY', 'croatie': 'HR', 'espagne': 'ES',
    'estonie': 'EE', 'finlande': 'FI', 'france': 'FR', 'grece': 'GR',
    'irlande': 'IE', 'italie': 'IT', 'lettonie': 'LV', 'lituanie': 'LT',
    'luxembourg': 'LU', 'malte': 'MT', 'monaco': 'MC', 'pays-bas': 'NL',
    'portugal': 'PT', 'saint-marin': 'SM', 'slovaquie': 'SK', 'slovenie': 'SI',
    'vatican': 'VA',
}
NAME = re.compile(r'^(\d{4})_([a-z-]+)-(\d+)\.jpg$')


def main():
    this_year = datetime.date.today().year
    entries, skipped = [], []
    for f in sorted(os.listdir(SRC)):
        m = NAME.match(f)
        if not m or m.group(2) not in COUNTRIES:
            skipped.append(f)
            continue
        year = int(m.group(1))
        if year > this_year:
            skipped.append(f)
            continue
        entries.append([COUNTRIES[m.group(2)], year, int(m.group(3)), f])
    entries.sort(key=lambda e: (e[1], e[0], e[2]))
    body = ',\n'.join('    ' + json.dumps(e, ensure_ascii=False) for e in entries)
    js = f"""// Automatisch erzeugt von scripts/build_coin_index.py – nicht von Hand ändern.
// Gedenkmünzen: [Land, Jahr, Nummer, Datei in images/coins/commemoratives/]
(function (root) {{
  'use strict';
  root.EB_COINS = {{
    commemoratives: [
{body},
    ],
  }};
}})(typeof window !== 'undefined' ? window : globalThis);
"""
    with open(OUT, 'w', encoding='utf-8') as fh:
        fh.write(js)
    countries = sorted({e[0] for e in entries})
    print(f'{len(entries)} Gedenkmünzen aus {len(countries)} Ländern in {OUT}')
    if skipped:
        print(f'{len(skipped)} übersprungen (Jahr > {this_year} oder unbekannt):', ', '.join(skipped[:10]))


if __name__ == '__main__':
    main()
