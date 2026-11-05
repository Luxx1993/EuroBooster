#!/usr/bin/env python3
"""
Skript zum Herunterladen der Euro-Münz-Bilder (Nationalseiten und Gedenkmünzen).
Die Bilder stammen aus einem GitHub-Repository mit Euro-Münzbildern, nicht von der EZB.

Quelle: https://github.com/lucephile/euro-coin-images
"""

import os
import shutil
import requests
import subprocess

# GitHub-Repository mit Euro-Münzbildern
REPO_URL = "https://github.com/lucephile/euro-coin-images.git"
TEMP_DIR = "/tmp/euro-coin-images"

# Zuordnung der Ländercodes
# GitHub-Repo verwendet französische Namen, wir brauchen ISO-Codes
COUNTRY_MAPPING = {
    'allemagne': 'DE',
    'andorre': 'AD',
    'autriche': 'AT',
    'belgique': 'BE',
    'bulgarie': 'BG',  # seit 1. Januar 2026 im Euroraum
    'chypre': 'CY',
    'croatie': 'HR',
    'espagne': 'ES',
    'estonie': 'EE',
    'finlande': 'FI',
    'france': 'FR',
    'grece': 'GR',
    'irlande': 'IE',
    'italie': 'IT',
    'lettonie': 'LV',
    'lituanie': 'LT',
    'luxembourg': 'LU',
    'malte': 'MT',
    'monaco': 'MC',
    'pays-bas': 'NL',
    'portugal': 'PT',
    'slovaquie': 'SK',
    'slovenie': 'SI',
    'vatican': 'VA',
    'saint-marin': 'SM',
}

# Münzwerte in Cent
COIN_VALUES = [1, 2, 5, 10, 20, 50, 100, 200]

def clone_repo():
    """Klont das GitHub-Repository."""
    print("🪙 Klone Euro-Münz-Bilder-Repository...")
    if os.path.exists(TEMP_DIR):
        print(f"  Repository bereits geklont in {TEMP_DIR}")
        return True
    
    try:
        result = subprocess.run(
            ['git', 'clone', REPO_URL, TEMP_DIR],
            capture_output=True,
            text=True,
            timeout=120
        )
        if result.returncode == 0:
            print(f"  ✓ Repository geklont")
            return True
        else:
            print(f"  ✗ Fehler beim Klonen: {result.stderr}")
            return False
    except Exception as e:
        print(f"  ✗ Fehler: {e}")
        return False

def copy_coin_images():
    """Kopiert die Münzbilder in die richtige Struktur."""
    print("\n🪙 Kopiere Münzbilder...")
    
    os.makedirs("images/coins", exist_ok=True)
    
    # Kopiere Standard-Münzen (sets/)
    sets_dir = os.path.join(TEMP_DIR, "sets")
    if os.path.exists(sets_dir):
        for github_country in os.listdir(sets_dir):
            if github_country in COUNTRY_MAPPING:
                iso_country = COUNTRY_MAPPING[github_country]
                country_dir = os.path.join(sets_dir, github_country)
                
                # Erstelle Zielverzeichnis
                os.makedirs(f"images/coins/{iso_country}", exist_ok=True)
                
                # Durchsuche alle Serien
                for series_dir in os.listdir(country_dir):
                    series_path = os.path.join(country_dir, series_dir)
                    if os.path.isdir(series_path):
                        for filename in os.listdir(series_path):
                            if filename.endswith('.webp'):
                                # Extrahiere Wert aus dem Dateinamen
                                value_str = filename[:-5]  # Entferne .webp
                                
                                # Konvertiere Wert in Cent
                                if value_str.endswith('c'):
                                    value = int(value_str[:-1])
                                elif value_str.endswith('e'):
                                    value = int(value_str[:-1]) * 100
                                else:
                                    continue
                                
                                # Kopiere das Bild
                                src = os.path.join(series_path, filename)
                                dst = f"images/coins/{iso_country}/{value}cent_national.webp"
                                
                                shutil.copy2(src, dst)
                                print(f"  ✓ {dst}")
    
    # Kopiere Gedenkmünzen (commemoratives/)
    commemoratives_dir = os.path.join(TEMP_DIR, "commemoratives")
    if os.path.exists(commemoratives_dir):
        os.makedirs("images/coins/commemoratives", exist_ok=True)
        for year_dir in os.listdir(commemoratives_dir):
            year_path = os.path.join(commemoratives_dir, year_dir)
            if os.path.isdir(year_path):
                for filename in os.listdir(year_path):
                    if filename.endswith('.webp'):
                        # Land aus dem Dateinamen „<land>-<nr>.webp“; Ländernamen
                        # können selbst Bindestriche enthalten (pays-bas, saint-marin)
                        github_country = filename[:-5].rsplit('-', 1)[0]
                        if True:
                            if github_country in COUNTRY_MAPPING:
                                iso_country = COUNTRY_MAPPING[github_country]
                                src = os.path.join(year_path, filename)
                                dst = f"images/coins/commemoratives/{year_dir}_{filename}"
                                shutil.copy2(src, dst)
                                print(f"  ✓ {dst}")
    
    print(f"\n✓ Bilder kopiert!")

def convert_to_jpeg():
    """Konvertiert WebP-Bilder in JPEG."""
    print("\n🪙 Konvertiere WebP nach JPEG...")
    
    try:
        from PIL import Image
        
        count = 0
        for root, dirs, files in os.walk("images/coins"):
            for filename in files:
                if filename.endswith('.webp'):
                    src = os.path.join(root, filename)
                    dst = src.replace('.webp', '.jpg')
                    
                    with Image.open(src) as img:
                        img.convert('RGB').save(dst, 'JPEG', quality=85)
                    
                    os.remove(src)
                    count += 1
                    print(f"  ✓ {dst}")
        
        print(f"\n✓ {count} Bilder konvertiert!")
        return True
    except ImportError:
        print("  ✗ Pillow nicht installiert. Installiere mit: pip install Pillow")
        return False

def main():
    print("=" * 70)
    print("EZB Euro-Münz-Bilder Download-Skript")
    print("=" * 70)
    
    if not clone_repo():
        print("\n✗ Konnte Repository nicht klonen")
        return
    
    copy_coin_images()
    convert_to_jpeg()
    
    print("\n" + "=" * 70)
    print("Fertig! Alle Münzbilder wurden heruntergeladen.")
    print("=" * 70)

if __name__ == "__main__":
    main()
