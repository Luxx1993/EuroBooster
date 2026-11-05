#!/usr/bin/env python3
"""
Erzeugt aus den Münz-Originalen in images/coins/ runde, freigestellte
Web-Bilder für die App in images/coin_web/ (WebP mit Transparenz).

Die Originale haben gemischte Hintergründe (weiß, schwarz, kariert aus
verlorener Transparenz) und sitzen teils nicht mittig. Deshalb sucht das
Skript den Umriss der Münze geometrisch: Kanten im verkleinerten Bild,
dann eine Hough-Suche nach dem Kreis, dessen Umfang am vollständigsten
auf Kanten liegt. Ausgeschnitten wird genau dieser Kreis; alles außerhalb
wird transparent.

  images/coins/<Land>/<Cent>cent_national.jpg -> images/coin_web/<Land>/<Cent>.webp
  images/coins/commemoratives/<Datei>.jpg     -> images/coin_web/commemoratives/<Datei>.webp

Aufruf: python3 scripts/build_coin_web.py   (braucht Pillow und numpy)
"""
import os
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = 'images/coins'
DST = 'images/coin_web'
SIZE = 256        # Kantenlänge der Ausgabe (Zweierpotenz für WebGL-Mipmaps)
WORK = 160        # Arbeitsgröße für die Kreissuche
QUALITY = 82


def find_circle(img):
    """Liefert (cx, cy, r) in Koordinaten des Originalbilds."""
    w, h = img.size
    scale = WORK / max(w, h)
    small = img.convert('L').resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    a = np.asarray(small, dtype=float)
    # Münzen, die bis an den Bildrand reichen, haben dort keine Kante. Ein
    # schmaler Rand in Hintergrundfarbe (Median der Ecken) macht sie sichtbar.
    pad = 6
    corners = np.array([a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]])
    a = np.pad(a, pad, mode='constant', constant_values=float(np.median(corners)))
    a = np.asarray(Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.GaussianBlur(1)), dtype=float)
    gx = np.zeros_like(a)
    gy = np.zeros_like(a)
    gx[:, 1:-1] = a[:, 2:] - a[:, :-2]
    gy[1:-1, :] = a[2:, :] - a[:-2, :]
    mag = np.hypot(gx, gy)
    ys, xs = np.nonzero(mag > np.percentile(mag, 85))
    sh, sw = a.shape
    m = min(sh, sw) - 2 * pad
    radii = np.arange(int(m * 0.28), int(m * 0.56) + 1)

    def evaluate(cx, cy):
        d = np.rint(np.hypot(xs - cx, ys - cy)).astype(int)
        votes = np.bincount(d, minlength=radii[-1] + 2)
        # Treffer je Radius, geglättet über ±1 Pixel, normiert auf den Umfang
        hits = votes[radii - 1] + votes[radii] + votes[radii + 1]
        cover = hits / (2 * np.pi * radii)
        top = cover.max()
        # Größten Kreis mit ausreichender Abdeckung nehmen: Außenrand statt
        # Innenkern einer Bimetallmünze, auch wenn der Rand schwächer ist
        i = int(np.nonzero(cover >= 0.6 * top)[0][-1])
        return cover[i], radii[i]

    def search(cxs, cys):
        best = None
        for cy in cys:
            for cx in cxs:
                cov, r = evaluate(cx, cy)
                key = cov * (1 + r / m)  # leichte Vorliebe für große Kreise
                if best is None or key > best[0]:
                    best = (key, cx, cy, r)
        return best

    # grob suchen, dann um den besten Mittelpunkt fein nachsuchen
    best = search(range(int(sw * 0.3), int(sw * 0.7) + 1, 4), range(int(sh * 0.3), int(sh * 0.7) + 1, 4))
    _, bx, by, _ = best
    best = search(range(bx - 4, bx + 5), range(by - 4, by + 5))
    _, cx, cy, r = best
    return (cx - pad) / scale, (cy - pad) / scale, r / scale


def find_by_fill(img):
    """Hintergrund von den Ecken aus füllen; der Rest ist die Münze.

    Liefert (cx, cy, r) oder None, wenn das nicht eindeutig klappt
    (z. B. bei kariertem Hintergrund, der sich nicht am Stück füllen lässt).
    """
    w, h = img.size
    scale = WORK / max(w, h)
    small = img.convert('RGB').resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    small = small.filter(ImageFilter.GaussianBlur(0.8))
    sw, sh = small.size
    pad = 6
    arr = np.asarray(small)
    corner = np.median(np.array([arr[0, 0], arr[0, -1], arr[-1, 0], arr[-1, -1]]), axis=0).astype(int)
    canvas = Image.new('RGB', (sw + 2 * pad, sh + 2 * pad), tuple(int(c) for c in corner))
    canvas.paste(small, (pad, pad))
    sentinel = (255, 0, 254)
    for xy in [(0, 0), (canvas.width - 1, 0), (0, canvas.height - 1), (canvas.width - 1, canvas.height - 1)]:
        if canvas.getpixel(xy) != sentinel:
            ImageDraw.floodfill(canvas, xy, sentinel, thresh=28)
    c = np.asarray(canvas)[pad:pad + sh, pad:pad + sw]
    bg = np.all(c == np.array(sentinel), axis=2)
    if bg.mean() < 0.12:          # kaum Hintergrund gefunden
        return None
    ys, xs = np.nonzero(~bg)
    if not len(xs):
        return None
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    bw, bh = x1 - x0, y1 - y0
    if abs(bw - bh) > 0.08 * max(bw, bh):   # nicht rund: lieber Kreissuche
        return None
    # Kreis um die Fläche: Fläche des Vordergrunds passt zu einer Scheibe?
    r = (bw + bh) / 4
    if not 0.8 < (~bg).sum() / (np.pi * r * r) < 1.15:
        return None
    return (x0 + x1) / 2 / scale, (y0 + y1) / 2 / scale, r / scale


def cut_round(img, cx, cy, r):
    r = r * 0.975  # schmaler Rand nach innen, damit kein Hintergrund durchblitzt
    box = (cx - r, cy - r, cx + r, cy + r)
    coin = img.convert('RGB').crop(tuple(round(v) for v in box)).resize((SIZE, SIZE), Image.LANCZOS)
    big = SIZE * 4
    mask = Image.new('L', (big, big), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, big - 1, big - 1), fill=255)
    coin.putalpha(mask.resize((SIZE, SIZE), Image.LANCZOS))
    return coin


def jobs():
    for d in sorted(os.listdir(SRC)):
        src_dir = os.path.join(SRC, d)
        if not os.path.isdir(src_dir):
            continue
        for f in sorted(os.listdir(src_dir)):
            if not f.endswith('.jpg'):
                continue
            if d == 'commemoratives':
                out = os.path.join(DST, d, f[:-4] + '.webp')
            elif f.endswith('cent_national.jpg'):
                out = os.path.join(DST, d, f.split('cent_')[0] + '.webp')
            else:
                continue
            yield os.path.join(src_dir, f), out


def convert(job):
    src, out = job
    with Image.open(src) as img:
        cx, cy, r = find_by_fill(img) or find_circle(img)
        # Kreis ragt deutlich aus dem Bild: dann füllt die Münze das Bild,
        # und der größte einbeschriebene Kreis ist die bessere Wahl
        w, h = img.size
        if min(cx - r, cy - r, w - cx - r, h - cy - r) < -0.04 * r:
            cx, cy, r = w / 2, h / 2, min(w, h) / 2
        coin = cut_round(img, cx, cy, r)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    coin.save(out, 'WEBP', quality=QUALITY, method=6)
    return os.path.getsize(out)


def main():
    only = sys.argv[1:]  # optional: nur diese Quelldateien
    todo = [j for j in jobs() if not only or j[0] in only]
    with Pool() as pool:
        sizes = pool.map(convert, todo, chunksize=8)
    print(f'{len(sizes)} Münzbilder, {sum(sizes) / 1048576:.1f} MB in {DST}/')


if __name__ == '__main__':
    main()
