#!/usr/bin/env python3
"""
Erzeugt aus den EZB-Münz-Originalen in images/coins/ kleine Kartenbilder
im Hochformat für die App (images/coin_cards/<Land>/<Wert>_<Seite>.jpg).

- Alle Bilder werden auf das einheitliche Seitenverhältnis 1:1,9 zugeschnitten
- Die Münzen werden zentriert und passend skaliert

Aufruf: python3 scripts/build_coin_images.py   (braucht Pillow)
"""
import os
from PIL import Image, ImageOps

SRC = 'images/coins'
DST = 'images/coin_cards'
SIZE = (400, 760)  # Breite x Höhe, 1:1,9
QUALITY = 80

def main():
    count = 0
    total = 0
    
    # Erstelle Zielverzeichnisse
    for country_dir in sorted(os.listdir(SRC)):
        if not os.path.isdir(os.path.join(SRC, country_dir)):
            continue
        os.makedirs(os.path.join(DST, country_dir), exist_ok=True)
        
        for name in sorted(os.listdir(os.path.join(SRC, country_dir))):
            if not name.endswith('.jpg'):
                continue
            
            # Extrahiere Wert und Seite aus dem Dateinamen
            # Format: {value}cent_{side}.jpg
            parts = name[:-4].split('cent_')
            if len(parts) != 2:
                print(f"WARNING: Skipping {name} - unexpected format")
                continue
            
            value = parts[0]
            side = parts[1]
            
            with Image.open(os.path.join(SRC, country_dir, name)) as im:
                im = ImageOps.exif_transpose(im).convert('RGB')
                # Münzen sind typischerweise quadratisch oder hochformat
                # Wir zuschneiden auf 1:1,9
                im = ImageOps.fit(im, SIZE, method=Image.LANCZOS, centering=(0.5, 0.5))
                out = os.path.join(DST, country_dir, f'{value}cent_{side}.jpg')
                im.save(out, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
            
            count += 1
            total += os.path.getsize(out)
    
    print(f'{count} coin card images, {total / 1048576:.1f} MB in {DST}/')

if __name__ == '__main__':
    main()
