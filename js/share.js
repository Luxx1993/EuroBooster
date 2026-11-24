/*
 * EUROPACK – Bild zum Teilen eines geöffneten Packs.
 *
 * Normaler Pack: alle Scheine aufgefächert bzw. alle zehn Münzen.
 * Besondere Funde (Special Edition, seltene Seriennummer, Gedenkmünze,
 * seltenes Land): die besten bis zu drei groß, mit Effekt und Beschriftung.
 * Dazu Packwert, Urteil („Bank gewinnt“) und der Link zur Seite.
 *
 * window.EBShare.build(result, helpers) -> Promise<{ blob, text, special }>
 * window.EBShare.pageUrl()              -> Link zur Seite
 */
(function () {
  'use strict';
  const D = window.EB_DATA;
  const W = 1080;
  const H = 1350;
  const FONT = '"Space Grotesk", system-ui, sans-serif';
  const BODY = 'Inter, system-ui, sans-serif';

  // Je seltener, desto höher; bestimmt, welche Karte groß gezeigt wird
  const ED_RANK = { fehldruck: 6, gold: 5, alt: 5, tinte: 4, glitzer: 3, holo: 2 };
  function specialScore(it) {
    if (it.kind === 'coin') return it.commemorative ? 3 : it.rareCountry ? 2.5 : 0;
    let s = it.edition ? (ED_RANK[it.edition] || 1) : 0;
    if (it.rareSerial) s = Math.max(s, 3.5);
    return s;
  }

  function specialLabel(it, editionName) {
    if (it.kind === 'coin') return it.commemorative ? `Gedenkmünze ${it.commemorative}` : 'Seltenes Land';
    const parts = [];
    if (it.edition) parts.push(`${editionName(it.edition)}-Edition`);
    if (it.rareSerial) parts.push(`Seriennummer: ${it.rareSerial}`);
    return parts.join(' · ');
  }

  function pageUrl() {
    const l = window.location;
    if (/^https?:$/.test(l.protocol) && !/^(localhost|127\.|0\.0\.0\.0)/.test(l.hostname)) {
      return l.origin + l.pathname.replace(/index\.html$/, '');
    }
    return D.SITE_URL;
  }

  // ---------------------------------------------------------------------------
  // Zeichenhilfen
  // ---------------------------------------------------------------------------
  function loadImage(src) {
    return new Promise((res, rej) => {
      const i = new Image();
      i.decoding = 'async';
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Bild fehlt: ' + src));
      i.src = src;
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Pixelweise Effekte; schlägt bei „verschmutztem“ Canvas (file://) still fehl
  function pixels(c, fn) {
    try {
      const x = c.getContext('2d');
      const d = x.getImageData(0, 0, c.width, c.height);
      const a = d.data;
      for (let i = 0; i < a.length; i += 4) fn(a, i);
      x.putImageData(d, 0, 0);
    } catch (e) { /* Effekt entfällt */ }
  }

  // Deterministischer Zufall für Glitzer, damit das Bild stabil bleibt
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function noteSrc(it) {
    let d = it.denom;
    if (it.edition === 'alt') d = D.DENOMS[(D.DENOMS.indexOf(d) + 3) % 6];
    return `${D.CARD_IMAGES}/${it.design}/${d}_front.jpg`;
  }

  // Ein Schein mit Edition, Rahmen in Stückelungsfarbe und Edition-Plakette
  async function renderNote(it, w, editionName, withBadge = true) {
    const h = Math.round(w * 1.9);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const r = Math.round(w * 0.06);
    const color = D.DENOM_COLORS[it.denom];
    x.save();
    roundRect(x, 0, 0, w, h, r);
    x.clip();
    try {
      x.drawImage(await loadImage(noteSrc(it)), 0, 0, w, h);
    } catch (e) {
      x.fillStyle = color; x.fillRect(0, 0, w, h);
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `700 ${Math.round(w * 0.32)}px ${FONT}`;
      x.fillText(String(it.denom), w / 2, h / 2);
    }
    const ed = it.edition;
    if (ed === 'tinte') {
      pixels(c, (a, i) => {
        const g = Math.max(0, Math.min(255, (a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11 - 128) * 1.3 + 128));
        a[i] = a[i + 1] = a[i + 2] = g;
      });
    }
    if (ed === 'gold') {
      pixels(c, (a, i) => {
        const g = (a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) / 255;
        a[i] = Math.min(255, 95 + g * 185); a[i + 1] = Math.min(255, 66 + g * 158); a[i + 2] = Math.min(255, 12 + g * 82);
      });
    }
    if (ed === 'fehldruck') {
      const t = document.createElement('canvas');
      t.width = w; t.height = h;
      const tx = t.getContext('2d');
      tx.drawImage(c, 0, 0);
      tx.globalCompositeOperation = 'source-atop';
      tx.fillStyle = 'rgba(233, 92, 192, 0.55)';
      tx.fillRect(0, 0, w, h);
      x.globalAlpha = 0.5;
      x.globalCompositeOperation = 'multiply';
      x.drawImage(t, w * 0.035, -h * 0.012);
      x.globalAlpha = 1;
      x.globalCompositeOperation = 'source-over';
    }
    if (ed === 'holo' || ed === 'gold') {
      // Regenbogen- bzw. Goldglanz und ein heller Lichtstreifen
      const g = x.createLinearGradient(0, 0, w, h);
      const stops = ed === 'holo'
        ? ['#ff5e5e', '#ffb84d', '#f7f36b', '#5ef08a', '#4dc8ff', '#8b6bff', '#ff6bd6']
        : ['#fff1b8', '#d4a933', '#fff6d0', '#b98a1c', '#fff1b8'];
      stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
      x.globalAlpha = ed === 'holo' ? 0.45 : 0.3;
      x.globalCompositeOperation = 'overlay';
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = 'source-over';
      const sheen = x.createLinearGradient(0, h * 0.25, w, h * 0.55);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      x.globalAlpha = 0.6;
      x.fillStyle = sheen; x.fillRect(0, 0, w, h);
      x.globalAlpha = 1;
    }
    if (ed === 'glitzer') {
      const rand = rng(it.denom * 977 + it.design.charCodeAt(0));
      x.fillStyle = '#fff';
      x.shadowColor = '#fff6c8'; x.shadowBlur = w * 0.03;
      for (let k = 0; k < 70; k++) {
        const px = rand() * w, py = rand() * h, s = w * (0.006 + rand() * 0.014);
        x.beginPath();
        x.moveTo(px, py - s * 2); x.lineTo(px + s * 0.5, py - s * 0.5); x.lineTo(px + s * 2, py);
        x.lineTo(px + s * 0.5, py + s * 0.5); x.lineTo(px, py + s * 2); x.lineTo(px - s * 0.5, py + s * 0.5);
        x.lineTo(px - s * 2, py); x.lineTo(px - s * 0.5, py - s * 0.5); x.closePath(); x.fill();
      }
      x.shadowBlur = 0;
    }
    x.restore();
    // Rahmen in Stückelungsfarbe
    x.lineWidth = Math.max(4, w * 0.022);
    x.strokeStyle = color;
    roundRect(x, x.lineWidth / 2, x.lineWidth / 2, w - x.lineWidth, h - x.lineWidth, r);
    x.stroke();
    if (ed && withBadge) pill(x, editionName(ed), w - w * 0.06, h - w * 0.07, Math.round(w * 0.075), '#0B1020', '#fff', 'right');
    return c;
  }

  async function renderCoin(it, size, coinImage) {
    const src = coinImage(it);
    if (src && window.Coin3D && window.Coin3D.supported) {
      try {
        return await window.Coin3D.renderStill({ src, cents: it.cents }, size, { rx: 0.3, ry: -0.28, lx: -0.45, ly: 0.6 });
      } catch (e) { /* gezeichnete Münze */ }
    }
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(size * 0.35, size * 0.3, size * 0.05, size / 2, size / 2, size / 2);
    g.addColorStop(0, '#fff3c4'); g.addColorStop(1, it.cents <= 5 ? '#a8603a' : '#b98a1c');
    x.fillStyle = g;
    x.beginPath(); x.arc(size / 2, size / 2, size * 0.47, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#2b1d05'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `700 ${Math.round(size * 0.22)}px ${FONT}`;
    x.fillText(it.cents < 100 ? `${it.cents} ct` : `${it.cents / 100} €`, size / 2, size / 2);
    return c;
  }

  function pill(x, text, px, py, fs, bg, fg, align) {
    x.font = `700 ${fs}px ${FONT}`;
    const tw = x.measureText(text).width;
    const padX = fs * 0.6, hh = fs * 1.6;
    const left = align === 'right' ? px - tw - padX * 2 : align === 'center' ? px - tw / 2 - padX : px;
    x.fillStyle = bg;
    roundRect(x, left, py - hh / 2, tw + padX * 2, hh, hh / 2);
    x.fill();
    x.fillStyle = fg; x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText(text, left + padX, py + fs * 0.04);
  }

  // Bild drehen und mit Schatten oder Glühen platzieren (Mittelpunkt cx, cy)
  function place(x, img, cx, cy, deg, glow) {
    x.save();
    x.translate(cx, cy);
    x.rotate((deg * Math.PI) / 180);
    x.shadowColor = glow || 'rgba(0,0,0,0.45)';
    x.shadowBlur = glow ? 60 : 30;
    x.shadowOffsetY = glow ? 0 : 14;
    x.drawImage(img, -img.width / 2, -img.height / 2);
    x.restore();
  }

  function background(x) {
    const base = x.createLinearGradient(0, 0, W, H);
    base.addColorStop(0, '#3B3FD9'); base.addColorStop(0.5, '#5A4FE0'); base.addColorStop(1, '#7A5BD8');
    x.fillStyle = base; x.fillRect(0, 0, W, H);
    const mint = x.createRadialGradient(W, 0, 0, W, 0, W * 0.9);
    mint.addColorStop(0, 'rgba(111,227,195,0.9)'); mint.addColorStop(1, 'rgba(111,227,195,0)');
    x.fillStyle = mint; x.fillRect(0, 0, W, H);
    const mag = x.createRadialGradient(W, H, 0, W, H, W);
    mag.addColorStop(0, 'rgba(233,92,192,0.95)'); mag.addColorStop(1, 'rgba(233,92,192,0)');
    x.fillStyle = mag; x.fillRect(0, 0, W, H);
    // dunkle Bühne hinter den Karten
    const stage = x.createRadialGradient(W / 2, 650, 50, W / 2, 650, 640);
    stage.addColorStop(0, 'rgba(11,16,32,0.55)'); stage.addColorStop(1, 'rgba(11,16,32,0)');
    x.fillStyle = stage; x.fillRect(0, 0, W, H);
  }

  function header(x, outline, filled) {
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.font = `700 34px ${FONT}`;
    x.fillStyle = 'rgba(255,255,255,0.9)';
    x.fillText('€  E U R O P A C K', W / 2, 70);
    x.font = `700 92px ${FONT}`;
    x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,0.85)';
    x.strokeText(outline, W / 2, 182, W - 80);
    x.fillStyle = '#fff';
    x.fillText(filled, W / 2, 272, W - 80);
  }

  // Querformat-Entwürfe liegen in der App gedreht im Hochformat. Fürs
  // Teilen-Bild werden besondere Scheine wieder aufrecht gezeigt, damit Text
  // und Porträt lesbar sind (Kartenbilder sind 90° gegen den Uhrzeiger gedreht).
  const LANDSCAPE = new Set(['A', 'B', 'C', 'E', 'F', 'H']);
  function upright(card, design) {
    if (!LANDSCAPE.has(design)) return card;
    const c = document.createElement('canvas');
    c.width = card.height; c.height = card.width;
    const x = c.getContext('2d');
    x.translate(c.width, 0);
    x.rotate(Math.PI / 2);          // 90° im Uhrzeigersinn zurückdrehen
    x.drawImage(card, 0, 0);
    return c;
  }

  // Bild skaliert mit Glühen bzw. Schatten zeichnen (Mittelpunkt cx, cy)
  function drawScaled(x, img, cx, cy, dw, dh, glow) {
    x.save();
    x.shadowColor = glow || 'rgba(0,0,0,0.45)';
    x.shadowBlur = glow ? 60 : 30;
    x.shadowOffsetY = glow ? 0 : 14;
    x.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
    x.restore();
  }

  // Textblock unter den Karten: Packwert (Mint), Edition (Gelb), Name (Weiß)
  const TEXT = {
    value: { size: 96, font: FONT, weight: 700, color: '#6FE3C3', after: 20 },
    label: { size: 44, font: FONT, weight: 700, color: '#FFC53D', after: 14 },
    desc: { size: 30, font: BODY, weight: 500, color: '#FFFFFF', after: 0 },
  };
  function textLines(result, specials, h) {
    const lines = [{ kind: 'value', text: h.fmt(result.value) }];
    if (specials.length) {
      const labels = [...new Set(specials.map((it) => specialLabel(it, h.editionName)))];
      lines.push({ kind: 'label', text: labels.join(' · ') });
      lines.push({ kind: 'desc', text: specials.map((it) => h.shortName(it)).join('   |   ') });
    }
    return lines;
  }
  const lineHeight = (k) => Math.round(TEXT[k].size * 1.12);
  function textHeight(lines) {
    return lines.reduce((sum, l, i) => sum + lineHeight(l.kind) + (i < lines.length - 1 ? TEXT[l.kind].after : 0), 0);
  }
  function drawText(x, lines, top) {
    let y = top;
    x.textAlign = 'center';
    x.textBaseline = 'top';
    lines.forEach((l) => {
      const t = TEXT[l.kind];
      x.font = `${t.weight} ${t.size}px ${t.font}`;
      x.fillStyle = t.color;
      x.fillText(l.text, W / 2, y, W - 100);   // schmaler statt überlappend
      y += lineHeight(l.kind) + t.after;
    });
  }

  const BUTTON_FS = 30;
  const BUTTON_H = Math.round(BUTTON_FS * 1.6);
  function drawButton(x, url, cy) {
    pill(x, 'Selbst öffnen: ' + url.replace(/^https?:\/\//, '').replace(/\/$/, ''), W / 2, cy, BUTTON_FS, 'rgba(11,16,32,0.75)', '#fff', 'center');
  }

  // Unter der Überschrift: Karten, Textblock und Link-Button mit gleichen
  // Abständen (oben, dazwischen, unten). Liefert die y-Positionen.
  const AREA_TOP = 300;
  const AREA_BOTTOM = H - 30;
  function stack(blockH, textH) {
    const free = AREA_BOTTOM - AREA_TOP - blockH - textH - BUTTON_H;
    const gap = Math.max(24, free / 4);
    const blockTop = AREA_TOP + gap;
    const textTop = blockTop + blockH + gap;
    const buttonCy = textTop + textH + gap + BUTTON_H / 2;
    return { gap, blockTop, textTop, buttonCy };
  }

  // Wert sortiert, bester in die Mitte (wie die Übersicht in der App)
  function fanOrder(items, value) {
    const top = items.reduce((a, b) => (value(b) > value(a) ? b : a));
    const rest = items.filter((i) => i !== top).sort((a, b) => value(a) - value(b));
    const order = [];
    rest.forEach((it, i) => (i % 2 ? order.push(it) : order.unshift(it)));
    order.splice(Math.floor(order.length / 2), 0, top);
    return { order, top };
  }

  // ---------------------------------------------------------------------------
  // Bild bauen
  // ---------------------------------------------------------------------------
  async function build(result, h) {
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) { /* egal */ } }
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    background(x);
    const coin = result.type === 'muenze';
    const url = pageUrl();
    const specials = result.godPack ? [] : result.items
      .filter((it) => specialScore(it) > 0)
      .sort((a, b) => specialScore(b) - specialScore(a) || h.itemValue(b) - h.itemValue(a))
      .slice(0, 3);

    if (result.godPack) header(x, 'ZENTRALBANK', 'PACK!');
    else if (specials.length) header(x, 'PACK GEÖFFNET', specials.length > 1 ? 'SELTENE FUNDE' : 'SELTENER FUND');
    else header(x, 'PACK', 'GEÖFFNET');

    const lines = textLines(result, specials, h);
    const textH = textHeight(lines);
    const maxBlock = AREA_BOTTOM - AREA_TOP - textH - BUTTON_H - 4 * 36;

    if (specials.length) {
      // Groß und aufrecht: die besonderen Karten bzw. Münzen. Plakette oben
      // rechts außerhalb der Karte, Beschriftung im Textblock darunter.
      const cards = await Promise.all(specials.map(async (it) => (coin
        ? renderCoin(it, 600, h.coinImage)
        : upright(await renderNote(it, 600, h.editionName, false), it.design))));
      const badges = specials.map((it) => (it.kind === 'note' && it.edition ? h.editionName(it.edition) : null));
      const badgeH = badges.some(Boolean) ? BUTTON_H + 14 : 0;
      const gap = 40;
      const maxH = maxBlock - badgeH;
      // Reihe oder Spalte – was die Karten größer zeigt
      const rowScale = Math.min((W - 120 - gap * (cards.length - 1)) / cards.reduce((s2, c2) => s2 + c2.width, 0),
        maxH / Math.max(...cards.map((c2) => c2.height)));
      const colScale = Math.min((W - 160) / Math.max(...cards.map((c2) => c2.width)),
        (maxH - gap * (cards.length - 1)) / cards.reduce((s2, c2) => s2 + c2.height, 0));
      const asRow = cards.length === 1 || rowScale >= colScale;
      const k = Math.min(asRow ? rowScale : colScale, coin ? 0.95 : 1.6);
      const sizes = cards.map((c2) => ({ w: c2.width * k, h: c2.height * k }));
      const blockH = badgeH + (asRow
        ? Math.max(...sizes.map((z) => z.h))
        : sizes.reduce((s2, z) => s2 + z.h, 0) + gap * (cards.length - 1));
      const pos = stack(blockH, textH);
      const cardsTop = pos.blockTop + badgeH;
      const rowW = sizes.reduce((s2, z) => s2 + z.w, 0) + gap * (cards.length - 1);
      let cursorX = W / 2 - rowW / 2;
      let cursorY = cardsTop;
      cards.forEach((card, i) => {
        const z = sizes[i];
        const cx = asRow ? cursorX + z.w / 2 : W / 2;
        const cy = asRow ? cardsTop + (blockH - badgeH) / 2 : cursorY + z.h / 2;
        drawScaled(x, card, cx, cy, z.w, z.h, h.glowOf(specials[i]) || 'rgba(255,255,255,0.55)');
        if (badges[i]) {
          // oben rechts, außerhalb der Karte
          pill(x, badges[i], cx + z.w / 2, cy - z.h / 2 - 14 - BUTTON_H / 2, BUTTON_FS, '#0B1020', '#fff', 'right');
        }
        cursorX += z.w + gap;
        cursorY += z.h + gap;
      });
      drawText(x, lines, pos.textTop);
      drawButton(x, url, pos.buttonCy);
    } else if (coin) {
      // Alle zehn Münzen, zwei Reihen
      const size = 196, gapX = 12, gapY = 36;
      const blockH = size * 2 + gapY;
      const pos = stack(blockH, textH);
      const imgs = await Promise.all(result.items.map((it) => renderCoin(it, size, h.coinImage)));
      const { order } = fanOrder(result.items, h.itemValue);
      order.forEach((it, i) => {
        const img = imgs[result.items.indexOf(it)];
        const row = i < 5 ? 0 : 1, col = i % 5;
        place(x, img, W / 2 + (col - 2) * (size + gapX), pos.blockTop + size / 2 + row * (size + gapY), 0);
      });
      drawText(x, lines, pos.textTop);
      drawButton(x, url, pos.buttonCy);
    } else {
      // Alle Scheine aufgefächert, der beste groß in der Mitte
      const { order, top } = fanOrder(result.items, h.itemValue);
      const imgs = await Promise.all(order.map((it) => renderNote(it, it === top ? 250 : 196, h.editionName)));
      const blockH = Math.round(250 * 1.9) + 40;   // größter Schein plus Fächer
      const pos = stack(blockH, textH);
      const mid = pos.blockTop + blockH / 2;
      const n = order.length;
      order.forEach((it, i) => {
        if (it === top) return;
        const kk = i - (n - 1) / 2;
        place(x, imgs[i], W / 2 + kk * 182, mid + 20 + Math.abs(kk) * 22, kk * 6);
      });
      place(x, imgs[order.indexOf(top)], W / 2, mid - 10, 0, h.glowOf(top));
      drawText(x, lines, pos.textTop);
      drawButton(x, url, pos.buttonCy);
    }

    let blob = null;
    try {
      blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9));
    } catch (e) { blob = null; }  // z. B. lokal über file:// geöffnet

    const best = specials[0];
    const lead = result.godPack ? 'Zentralbank-Pack bei EUROPACK!'
      : best ? `Seltener Fund bei EUROPACK: ${specialLabel(best, h.editionName)} – ${h.shortName(best)}.`
      : 'Mein EUROPACK ist offen.';
    const verdict = result.price === 0 ? 'Bonus-Pack!'
      : result.value > result.price ? 'Ich schlage die EZB!'
      : result.value === result.price ? 'Unentschieden mit der EZB.'
      : 'Die Bank gewinnt.';
    const text = `${lead} ${h.fmt(result.value)} Packwert für ${h.fmt(result.price)}. ${verdict}\nSelbst öffnen: ${url}`;
    return { blob, text, url, special: !!best || !!result.godPack, canvas: c };
  }

  window.EBShare = { build, pageUrl, specialScore };
})();
