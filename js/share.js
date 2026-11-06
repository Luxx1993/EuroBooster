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
  async function renderNote(it, w, editionName) {
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
    if (ed) pill(x, editionName(ed), w - w * 0.06, h - w * 0.07, Math.round(w * 0.075), '#0B1020', '#fff', 'right');
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

  function footer(x, result, url, fmt) {
    const v = result.value, p = result.price;
    const verdict = p === 0 ? `Bonus-Pack: ${fmt(v)} geschenkt`
      : v > p ? `${fmt(v)} – Du schlägst die EZB`
      : v === p ? `${fmt(v)} – Unentschieden mit der EZB`
      : `${fmt(v)} von ${fmt(p)} – Bank gewinnt`;
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.font = `700 50px ${FONT}`;
    x.fillStyle = v > p || p === 0 ? '#6FE3C3' : '#FFFFFF';
    x.fillText(verdict, W / 2, 1192);
    pill(x, 'Selbst öffnen: ' + url.replace(/^https?:\/\//, '').replace(/\/$/, ''), W / 2, 1272, 30, 'rgba(11,16,32,0.75)', '#fff', 'center');
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

    if (specials.length) {
      // Groß: die besonderen Karten bzw. Münzen, mit Beschriftung
      const n = specials.length;
      const cw = coin ? (n === 1 ? 560 : n === 2 ? 400 : 300) : (n === 1 ? 400 : n === 2 ? 330 : 270);
      const imgs = await Promise.all(specials.map((it) => (coin ? renderCoin(it, cw, h.coinImage) : renderNote(it, cw, h.editionName))));
      const gap = 40;
      const total = n * cw + (n - 1) * gap;
      const top = coin ? (n === 1 ? 330 : 430) : 310;
      imgs.forEach((img, i) => {
        const cx = W / 2 - total / 2 + cw / 2 + i * (cw + gap);
        const rarity = h.glowOf(specials[i]);
        place(x, img, cx, top + img.height / 2, n === 1 ? 0 : (i - (n - 1) / 2) * 3, rarity || 'rgba(255,255,255,0.55)');
        const capY = top + img.height + (coin ? 20 : 54);
        x.textAlign = 'center'; x.textBaseline = 'alphabetic';
        x.fillStyle = '#FFC53D';
        const maxW = n === 1 ? W - 120 : cw + gap - 12;
        x.font = `700 ${n === 1 ? 44 : 28}px ${FONT}`;
        x.fillText(specialLabel(specials[i], h.editionName), cx, capY, maxW);
        x.fillStyle = '#fff';
        x.font = `500 ${n === 1 ? 30 : 24}px ${BODY}`;
        const it = specials[i];
        const desc = n === 1 ? h.shortName(it)
          : it.kind === 'coin' ? h.shortName(it) : `${it.denom} € · Entwurf ${it.design}`;
        x.fillText(desc, cx, capY + (n === 1 ? 46 : 34), maxW);
      });
    } else if (coin) {
      // Alle zehn Münzen, zwei Reihen
      const size = 196, gapX = 12, gapY = 36;
      const imgs = await Promise.all(result.items.map((it) => renderCoin(it, size, h.coinImage)));
      const { order } = fanOrder(result.items, h.itemValue);
      order.forEach((it, i) => {
        const img = imgs[result.items.indexOf(it)];
        const row = i < 5 ? 0 : 1, col = i % 5;
        const cx = W / 2 + (col - 2) * (size + gapX);
        const cy = 540 + row * (size + gapY);
        place(x, img, cx, cy, 0);
      });
    } else {
      // Alle Scheine aufgefächert, der beste groß in der Mitte
      const { order, top } = fanOrder(result.items, h.itemValue);
      const imgs = await Promise.all(order.map((it) => renderNote(it, it === top ? 250 : 196, h.editionName)));
      const n = order.length;
      order.forEach((it, i) => {
        if (it === top) return;
        const k = i - (n - 1) / 2;
        place(x, imgs[i], W / 2 + k * 182, 640 + Math.abs(k) * 26, k * 6);
      });
      const ti = order.indexOf(top);
      place(x, imgs[ti], W / 2, 610, 0, h.glowOf(top));
    }

    footer(x, result, url, h.fmt);

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
