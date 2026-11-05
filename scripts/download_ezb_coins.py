#!/usr/bin/env python3
"""
Skript zum Herunterladen der EZB Euro-Münz-Bilder.
Laedt die Nationalseiten aller Euro-Laender fuer alle 8 Münzwerte herunter.

Quelle: https://www.ecb.europa.eu/euro/coins/shared/img/coins/
URL-Pattern: {BASE_URL}/{country_code_lower}/{value}_cent_national.jpg
"""

import os
import requests

# Basis-URL fuer die Münzbilder der EZB
BASE_URL = "https://www.ecb.europa.eu/euro/coins/shared/img/coins"

# Euro-Laender (25 Laender: 20 Euro-Laender + 4 Kleinstaaten + Kroatien)
# Format: Laendercode -> Laendername (wie in js/data.js)
COIN_COUNTRIES = {
    'DE': 'Germany',
    'FR': 'France',
    'IT': 'Italy',
    'ES': 'Spain',
    'NL': 'Netherlands',
    'BE': 'Belgium',
    'AT': 'Austria',
    'PT': 'Portugal',
    'GR': 'Greece',
    'IE': 'Ireland',
    'FI': 'Finland',
    'LU': 'Luxembourg',
    'SK': 'Slovakia',
    'SI': 'Slovenia',
    'CY': 'Cyprus',
    'MT': 'Malta',
    'EE': 'Estonia',
    'LV': 'Latvia',
    'LT': 'Lithuania',
    'HR': 'Croatia',
    'BG': 'Bulgaria',
    # Kleinstaaten
    'AD': 'Andorra',
    'MC': 'Monaco',
    'SM': 'SanMarino',
    'VA': 'Vatican',
}

# Münzwerte in Cent
COIN_VALUES = [1, 2, 5, 10, 20, 50, 100, 200]

def download_image(url, save_path):
    """Laedt ein Bild herunter."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        response = requests.get(url, headers=headers, stream=True, timeout=30)
        response.raise_for_status()
        
        with open(save_path, 'wb') as f:
            for chunk in response.iter_content(1024):
                f.write(chunk)
        
        print(f"OK {save_path}")
        return True
    except Exception as e:
        print(f"FAIL {url}: {e}")
        return False

def main():
    print("Downloading EZB coin images...")
    
    # Erstelle Verzeichnisse
    os.makedirs("images/coins", exist_ok=True)
    for country_code in COIN_COUNTRIES:
        os.makedirs(f"images/coins/{country_code}", exist_ok=True)
    
    downloaded = 0
    
    # Lade Nationalseiten herunter
    # EZB URL-Pattern: /euro/coins/shared/img/coins/{country_code_lower}/{value}_cent_national.jpg
    for country_code, country_name in COIN_COUNTRIES.items():
        country_lower = country_code.lower()
        for value in COIN_VALUES:
            url = f"{BASE_URL}/{country_lower}/{value}_cent_national.jpg"
            save_path = f"images/coins/{country_code}/{value}cent_national.jpg"
            
            if download_image(url, save_path):
                downloaded += 1
    
    # Lade Gemeinschaftsseiten herunter (sind fuer alle Laender gleich)
    os.makedirs("images/coins/common", exist_ok=True)
    for value in COIN_VALUES:
        url = f"{BASE_URL}/common/{value}_cent_common.jpg"
        save_path = f"images/coins/common/{value}cent_common.jpg"
        if download_image(url, save_path):
            downloaded += 1
    
    print(f"\nDownloaded {downloaded} coin images total!")

if __name__ == "__main__":
    main()
