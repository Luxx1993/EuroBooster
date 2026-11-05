#!/usr/bin/env python3
"""
Skript zum Herunterladen der EZB Euro-Banknoten-Design-Bilder.
Verwendet direkte URLs von der EZB-Website.
"""

import os
import requests

# Basis-URL für die Bilder
BASE_URL = "https://www.ecb.europa.eu/euro/banknotes/future_banknotes/shared/img"

# Design-Informationen
DESIGNS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
DENOMINATIONS = ['5', '10', '20', '50', '100', '200']
SIDES = ['front', 'back']

def download_image(url, save_path):
    """Lädt ein Bild herunter."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        response = requests.get(url, headers=headers, stream=True, timeout=30)
        response.raise_for_status()
        
        with open(save_path, 'wb') as f:
            for chunk in response.iter_content(1024):
                f.write(chunk)
        
        print(f"✅ {save_path}")
        return True
    except Exception as e:
        print(f"❌ {url}: {e}")
        return False

def main():
    print("📥 Lade EZB Design-Bilder herunter...")
    
    # Erstelle Verzeichnisse
    os.makedirs("images/designs", exist_ok=True)
    for design in DESIGNS:
        os.makedirs(f"images/designs/design_{design.upper()}", exist_ok=True)
    
    downloaded = 0
    
    # Versuche alle möglichen Kombinationen
    for design in DESIGNS:
        for denom in DENOMINATIONS:
            for side in SIDES:
                url = f"{BASE_URL}/banknote-design-proposal-{design}-{denom}-{side}.jpg"
                save_path = f"images/designs/design_{design.upper()}/{denom}euro_{side}.jpg"
                
                if download_image(url, save_path):
                    downloaded += 1
    
    print(f"\n✅ {downloaded} Bilder heruntergeladen!")

if __name__ == "__main__":
    main()
