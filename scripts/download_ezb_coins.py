#!/usr/bin/env python3
"""
Skript zum Herunterladen der EZB Euro-Münz-Bilder.

HINWEIS: Die EZB bietet die Münzbilder nicht direkt über einfache URLs an.
Dieses Skript erstellt Platzhalter-Bilder und eine Anleitung zum manuellen Download.

Alternative: Bilder können manuell von https://www.ecb.europa.eu/euro/coins/html/index.de.html
heruntergeladen werden.
"""

import os
from PIL import Image, ImageDraw, ImageFont

# Euro-Länder (25 Länder: 20 Euro-Länder + 4 Kleinstaaten + Kroatien)
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

def create_placeholder():
    """Erstellt Platzhalter-Bilder für alle Münzen."""
    print("🪙 Erstelle Platzhalter-Bilder für Euro-Münzen...")
    
    os.makedirs("images/coins", exist_ok=True)
    
    for country_code, country_name in COIN_COUNTRIES.items():
        os.makedirs(f"images/coins/{country_code}", exist_ok=True)
        
        for value in COIN_VALUES:
            # Erstelle Platzhalter-Bild
            img = Image.new('RGB', (400, 400), color='#f0f0f0')
            draw = ImageDraw.Draw(img)
            
            # Zeichne Kreis (Münze)
            draw.ellipse([(50, 50), (350, 350)], fill='#d0d0d0', outline='#888')
            
            # Zeichne Text
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
            except:
                font = ImageFont.load_default()
            
            draw.text((200, 180), f"{country_code}", fill='#000', anchor='mm', font=font)
            draw.text((200, 220), f"{value} cent", fill='#000', anchor='mm', font=font)
            
            save_path = f"images/coins/{country_code}/{value}cent_national.jpg"
            img.save(save_path, 'JPEG', quality=80)
            print(f"  ✓ {save_path}")
    
    # Gemeinschaftsseiten
    os.makedirs("images/coins/common", exist_ok=True)
    for value in COIN_VALUES:
        img = Image.new('RGB', (400, 400), color='#f0f0f0')
        draw = ImageDraw.Draw(img)
        draw.ellipse([(50, 50), (350, 350)], fill='#d0d0d0', outline='#888')
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
        except:
            font = ImageFont.load_default()
        draw.text((200, 180), "EU", fill='#000', anchor='mm', font=font)
        draw.text((200, 220), f"{value} cent", fill='#000', anchor='mm', font=font)
        save_path = f"images/coins/common/{value}cent_common.jpg"
        img.save(save_path, 'JPEG', quality=80)
        print(f"  ✓ {save_path}")
    
    print(f"\n✓ Platzhalter-Bilder erstellt!")
    print("\nHINWEIS: Bitte ersetze diese Platzhalter durch echte EZB-Bilder.")
    print("         Echte Bilder können von https://www.ecb.europa.eu/euro/coins/html/index.de.html")
    print("         heruntergeladen werden.")

def main():
    print("=" * 70)
    print("EZB Euro-Münz-Bilder Download-Skript")
    print("=" * 70)
    print("\nDie EZB bietet die Münzbilder nicht direkt über einfache URLs an.")
    print("Dieses Skript erstellt Platzhalter-Bilder.")
    print("\nMöchten Sie Platzhalter-Bilder erstellen? (j/n): ", end="")
    
    # In einer Sandbox können wir keine User-Input abfragen, also erstellen wir einfach Platzhalter
    create_placeholder()

if __name__ == "__main__":
    main()
