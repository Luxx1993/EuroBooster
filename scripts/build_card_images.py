#!/usr/bin/env python3
"""
Erzeugt aus den EZB-Originalen in images/designs/ kleine Kartenbilder im
Hochformat für die App (images/cards/<Entwurf>/<Wert>_<Seite>.jpg).

- Querformat-Entwürfe werden um 90° gegen den Uhrzeigersinn gedreht
  (Text läuft dann von unten nach oben, wie ein Buchrücken).
- Hochformat-Entwürfe (D-Vorderseite, G, I, J) werden nur nach ihrem
  EXIF-Drehflag ausgerichtet; das Flag fällt danach weg.
- Alle Karten bekommen das einheitliche Seitenverhältnis 1:1,9
  (die Originale liegen je nach Stückelung zwischen 1:1,82 und 1:1,99).

Aufruf: python3 scripts/build_card_images.py   (braucht Pillow)
"""
import os
from PIL import Image, ImageOps

SRC = 'images/designs'
DST = 'images/cards'
SIZE = (400, 760)  # Breite x Höhe, 1:1,9
QUALITY = 80


def main():
    count = 0
    total = 0
    for design_dir in sorted(os.listdir(SRC)):
        if not design_dir.startswith('design_'):
            continue
        design = design_dir.split('_', 1)[1]
        os.makedirs(os.path.join(DST, design), exist_ok=True)
        for name in sorted(os.listdir(os.path.join(SRC, design_dir))):
            if not name.endswith('.jpg'):
                continue
            denom, side = name[:-4].split('euro_')
            with Image.open(os.path.join(SRC, design_dir, name)) as im:
                im = ImageOps.exif_transpose(im).convert('RGB')
                if im.width > im.height:
                    im = im.rotate(90, expand=True)
                im = ImageOps.fit(im, SIZE, method=Image.LANCZOS)
                out = os.path.join(DST, design, f'{denom}_{side}.jpg')
                im.save(out, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
            count += 1
            total += os.path.getsize(out)
    print(f'{count} Kartenbilder, {total / 1048576:.1f} MB in {DST}/')


if __name__ == '__main__':
    main()
