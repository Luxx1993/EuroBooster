/*
 * EUROPACK – Browser-Prototyp. Vanilla JS, keine Abhängigkeiten.
 * Spielstand liegt im localStorage des Browsers.
 */
(function () {
  'use strict';
  const D = window.EB_DATA;
  const EB = window.EB;

  // ---------------------------------------------------------------------------
  // Hilfsfunktionen
  // ---------------------------------------------------------------------------
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const fmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  const fmt0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 });
  const eur = (n) => (Number.isInteger(n) ? fmt0 : fmt).format(n);
  const pct = (p) => (p * 100).toLocaleString('de-DE', { maximumFractionDigits: p < 0.01 ? 2 : 1 }) + ' %';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const flag = (cc) => cc.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const coinLabel = (cents) => (cents < 100 ? cents + ' ct' : cents / 100 + ' €');
  const itemValue = (it) => (it.kind === 'coin' ? it.cents / 100 : it.kind === 'note' ? it.denom : 0);
  const editionName = (id) => (D.EDITIONS.find((e) => e.id === id) || {}).name;
  const designById = (id) => D.DESIGNS.find((d) => d.id === id);
  const countryName = (cc) => (D.COIN_COUNTRIES.find((c) => c.code === cc) || {}).name || cc;

  // ---------------------------------------------------------------------------
  // Spielstand
  // ---------------------------------------------------------------------------
  const STORE_KEY = 'europack-v1';
  function fresh() {
    return {
      balance: D.STARTING_BALANCE,
      items: [],
      unopened: [],
      stats: { packs: 0, spent: 0, received: 0, bankWins: 0, best: null },
      lastDaily: null,
      spentToday: { date: today(), amount: 0 },
      setBonuses: [],
      settings: {
        haptics: true,
        sound: true,
        reduceMotion: window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches,
        limit: 250,
      },
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return Object.assign(fresh(), s, { settings: Object.assign(fresh().settings, s.settings) });
    } catch (e) {
      return null;
    }
  }
  let S = load() || fresh();
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* privat/gesperrt: Spiel läuft trotzdem */ }
  }
  const BALANCE_CAP = 3000; // „Haltelimit“ des digitalen Euro

  function ownedCount(id) {
    let n = 0;
    for (const it of S.items) if (it.id === id) n++;
    return n;
  }

  // ---------------------------------------------------------------------------
  // Ton und Haptik
  // ---------------------------------------------------------------------------
  let audio = null;
  function ac() {
    if (!S.settings.sound) return null;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      return audio;
    } catch (e) { return null; }
  }
  function tone(freq, dur = 0.12, type = 'sine', vol = 0.15, delay = 0) {
    const a = ac(); if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator(); const g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur = 0.25, vol = 0.2, delay = 0) {
    const a = ac(); if (!a) return;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource(); const g = a.createGain(); const f = a.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1200;
    g.gain.value = vol; src.buffer = buf;
    src.connect(f).connect(g).connect(a.destination); src.start(a.currentTime + delay);
  }
  const sfx = {
    tear() { noise(0.35, 0.25); },
    flip() { tone(660, 0.08, 'triangle', 0.08); },
    tick() { tone(180, 0.05, 'square', 0.05); },
    drum() { for (let i = 0; i < 8; i++) noise(0.04, 0.12, i * 0.06); },
    hit(level) {
      const base = [523, 659, 784, 1047];
      base.slice(0, 2 + level).forEach((f, i) => tone(f, 0.35, 'triangle', 0.12, i * 0.09));
    },
    coin() { tone(1568, 0.12, 'sine', 0.1); tone(2093, 0.25, 'sine', 0.08, 0.06); },
  };
  function haptic(level) {
    if (!S.settings.haptics || !navigator.vibrate) return;
    navigator.vibrate(level === 3 ? [30, 40, 70] : level === 2 ? 25 : 10);
  }

  // ---------------------------------------------------------------------------
  // Rendering: Schein, Münze, Pack
  // ---------------------------------------------------------------------------
  function noteHTML(it, opts = {}) {
    const d = it.denom;
    const motifs = D.MOTIFS[it.theme];
    let motif = opts.back ? motifs[d].back : motifs[d].front;
    if (it.edition === 'alt' && !opts.back) {
      // Alternativmotiv: das Motiv eines Nachbarscheins desselben Themas
      const i = D.DENOMS.indexOf(d);
      motif = motifs[D.DENOMS[(i + 3) % 6]].front;
    }
    const design = designById(it.design);
    const cls = ['note', 'theme-' + it.theme, it.edition ? 'ed-' + it.edition : '', opts.back ? 'back' : '', opts.extra || ''].join(' ');
    const edLabel = it.edition ? `<span class="ed-label">${esc(editionName(it.edition))}</span>` : '';
    return `<div class="${cls}" style="--c:${D.DENOM_COLORS[d]}">
      <div class="n-denom">${d}<small> €</small></div>
      <div class="n-stars" aria-hidden="true">★ ★ ★ ★ ★</div>
      <div class="n-serial">${opts.hideSerial ? '' : esc(it.serial || '')}</div>
      <div class="n-portrait" aria-hidden="true"></div>
      ${it.isReal ? '<div class="n-holo-strip" aria-hidden="true"></div>' : ''}
      <div class="n-motif">${esc(motif)}</div>
      <div class="n-meta">Entwurf ${esc(it.design)} · ${esc(design ? design.designer : '')}</div>
      <div class="n-big" aria-hidden="true">${d}</div>
      ${it.kind === 'proto' ? '<div class="n-stamp">PROTOTYP</div>' : ''}
      ${edLabel}
    </div>`;
  }

  function coinClass(c) {
    if (c <= 5) return 'copper';
    if (c <= 50) return 'nordic';
    return c === 100 ? 'bimetal-1' : 'bimetal-2';
  }
  function coinHTML(it) {
    const cls = ['coin', coinClass(it.cents), it.commemorative ? 'gedenk' : '', it.rareCountry ? 'rare-country' : ''].join(' ');
    return `<div class="${cls}" title="${esc(coinLabel(it.cents) + ' · ' + it.countryName + (it.commemorative ? ' · Gedenkmünze ' + it.commemorative : ''))}">
      <div><div class="c-flag">${flag(it.country)}</div><div class="c-val">${coinLabel(it.cents)}</div><div class="c-cc">${it.commemorative || it.country}</div></div>
    </div>`;
  }

  function itemHTML(it, opts) { return it.kind === 'coin' ? coinHTML(it) : noteHTML(it, opts); }

  function packHTML(type, god) {
    const coin = type === 'muenze';
    return `<div class="pack ${coin ? 'coin-pack' : ''} ${god ? 'god' : ''}">
      <div class="p-crimp top"></div>
      <div><div class="p-euro">€</div><div class="p-name">EUROPACK</div>
      <div class="p-sub">${coin ? '10 Münzen' : '5 Scheine + Prototyp'}</div></div>
      <div class="p-crimp bottom"></div>
    </div>`;
  }

  function rarityOf(it) {
    if (it.kind === 'coin') {
      if (it.commemorative) return { glow: '#A35BFF', level: 2 };
      if (it.rareCountry) return { glow: '#FFC53D', level: 3 };
      if (it.hit) return { glow: '#4D7CFF', level: 1 };
      return { glow: null, level: 0 };
    }
    const r = D.RARITY[it.denom];
    const level = { common: 0, rare: 1, epic: 2, legendary: 3, rainbow: 4 }[r.id];
    return { glow: r.glow, level, name: r.name };
  }

  // ---------------------------------------------------------------------------
  // Toast und Modal
  // ---------------------------------------------------------------------------
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2800);
  }
  function openModal(html, onMount) {
    $('#modalCard').innerHTML = html;
    $('#modal').hidden = false;
    if (onMount) onMount($('#modalCard'));
    const close = $('#modalCard [data-close]');
    if (close) close.focus();
  }
  function closeModal() {
    $('#modal').hidden = true; $('#modalCard').innerHTML = '';
    window.removeEventListener('deviceorientation', onOrient);
  }
  $('#modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  let currentTab = 'wallet';
  function showTab(tab) {
    currentTab = tab;
    $$('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.view').forEach((v) => (v.hidden = v.dataset.view !== tab));
    render();
    window.scrollTo(0, 0);
  }
  $$('.tabbar button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  function render() {
    document.body.classList.toggle('reduce-motion', !!S.settings.reduceMotion);
    $('#balanceValue').textContent = fmt.format(S.balance);
    const badge = $('#openBadge');
    badge.hidden = S.unopened.length === 0;
    badge.textContent = S.unopened.length;
    if (currentTab === 'wallet') renderWallet();
    if (currentTab === 'shop') renderShop();
    if (currentTab === 'open') renderUnopened();
    if (currentTab === 'album') renderAlbum();
    if (currentTab === 'trade') renderTrade();
  }

  // ---------------------------------------------------------------------------
  // Wallet
  // ---------------------------------------------------------------------------
  function renderWallet() {
    $('#walletBalance').textContent = fmt.format(S.balance);
    const notes = S.items.filter((i) => i.kind !== 'coin')
      .sort((a, b) => (b.edition ? 1 : 0) - (a.edition ? 1 : 0) || b.denom - a.denom).slice(0, 4).reverse();
    const stack = $('#noteStack');
    if (!notes.length) {
      stack.innerHTML = '<div class="empty">Noch keine Scheine. Im Shop gibt es Booster – Geld für Geld.</div>';
    } else {
      stack.innerHTML = notes.map((n) => noteHTML(n)).join('');
      $$('.note', stack).forEach((el, i) => {
        const off = notes.length - 1 - i;
        const k = i - (notes.length - 1) / 2;
        el.style.transform = `translateX(calc(-50% + ${k * 44}px)) rotate(${k * 7}deg) translateY(${Math.abs(k) * 6}px)`;
        el.style.zIndex = 10 - off;
        el.style.cursor = 'pointer';
      });
      $$('.note', stack).forEach((n, i) => n.addEventListener('click', () => openDetail(notes[i].id)));
    }
    const p = $('#dailyPanel');
    const claimed = S.lastDaily === today();
    p.innerHTML = `<div><strong>Daily Drop</strong><div class="muted" style="font-size:13px">${claimed ? 'Heute schon abgeholt. Morgen wieder.' : 'Ein Gratis-Pack mit 0,01 € bis 0,05 €.'}</div></div>
      <button class="btn ${claimed ? '' : 'primary'}" data-action="daily" ${claimed ? 'disabled' : ''}>${claimed ? 'Abgeholt' : 'Abholen'}</button>`;
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const act = a.dataset.action;
    if (act === 'pay' || act === 'send') toast('Bezahlen kommt mit dem digitalen Euro. Bis dahin gilt: Kauf Geld – mit Geld.');
    if (act === 'topup') {
      if (S.balance + 100 > BALANCE_CAP) return toast('Kartenbox ist voll – Haltelimit für digitale Euro erreicht.');
      S.balance += 100; save(); render(); toast('+100 € Spielgeld. Die EZB druckt gerne nach.');
    }
    if (act === 'daily') claimDaily();
    if (act === 'buy') buy(a.dataset.type);
    if (act === 'open-pack') openPack(a.dataset.uid);
  });

  function claimDaily() {
    if (S.lastDaily === today()) return;
    const cents = [1, 2, 5][Math.floor(Math.random() * 3)];
    const c = EB.pickWeighted(Math.random, D.COIN_COUNTRIES.map((x) => [x, x.weight]));
    const coin = { kind: 'coin', id: EB.coinId(c.code, cents), cents, country: c.code, countryName: c.name, rareCountry: !!c.rare, commemorative: null, edition: null };
    S.items.push(Object.assign(coin, { uid: uid(), foundAt: Date.now(), source: 'daily' }));
    S.balance = Math.round((S.balance + cents / 100) * 100) / 100;
    S.lastDaily = today();
    save(); render();
    sfx.coin(); haptic(1);
    toast(`Daily Drop: ${coinLabel(cents)} aus ${c.name}. Konjunkturpaket ausgeliefert.`);
  }

  // ---------------------------------------------------------------------------
  // Shop
  // ---------------------------------------------------------------------------
  function oddsTable(b, coin) {
    const label = (v) => (coin ? coinLabel(v) : v + ' €');
    const rows = [];
    let i = 0;
    while (i < b.slots.length) {
      let j = i;
      while (j + 1 < b.slots.length && JSON.stringify(b.slots[j + 1].odds) === JSON.stringify(b.slots[i].odds) && b.slots[j + 1].label === b.slots[i].label) j++;
      rows.push(`<tr><td>${i === j ? 'Slot ' + (i + 1) : 'Slots ' + (i + 1) + '–' + (j + 1)}<br><span class="muted">${esc(b.slots[i].label)}</span></td>
        <td>${b.slots[i].odds.map(([v, p]) => `${label(v)} (${pct(p)})`).join(', ')}</td></tr>`);
      i = j + 1;
    }
    return `<table class="odds-table"><thead><tr><th>Slot</th><th>Mögliche Inhalte</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
  }

  function distBars() {
    const b = D.NOTE_BOOSTER;
    const dist = EB.valueDistribution(b);
    const range = (lo, hi) => dist.filter(([v]) => v >= lo && v <= hi).reduce((s, [, p]) => s + p, 0);
    const groups = [
      ['30–35 € · Enttäuschung', range(30, 35)],
      ['40–45 €', range(36, 49)],
      ['50–70 € · Gewonnen', range(50, 74)],
      ['75–95 € · Guter Pull', range(75, 99)],
      ['100–195 € · Hit', range(100, 199)],
      ['200–250 € · Jackpot', range(200, 250)],
    ];
    const max = Math.max(...groups.map((g) => g[1]));
    return `<div class="dist-bars">${groups.map(([l, p]) => `<div class="dist-bar"><span>${l}</span><span class="bar"><i style="width:${(p / max) * 100}%"></i></span><span class="tabular" style="text-align:right">${pct(p)}</span></div>`).join('')}</div>`;
  }

  function renderShop() {
    const nb = D.NOTE_BOOSTER, cb = D.COIN_BOOSTER;
    const evN = EB.expectedValue(nb), evC = EB.expectedValue(cb) / 100;
    $('#shopGrid').innerHTML = `
      <article class="booster-card">
        <div style="font-size:15px">${packHTML('schein')}</div>
        <div>
          <h3>Schein-Booster</h3>
          <div class="price tabular">${eur(nb.price)}</div>
          <ul><li>5 Scheine, Hit-Slot ganz hinten</li><li>+ 1 Prototyp-Karte (nie gedruckt)</li><li>Im Schnitt ${fmt.format(evN)} Nennwert · Median ${eur(EB.median(nb))}</li></ul>
          <button class="btn primary" data-action="buy" data-type="schein">Kaufen und öffnen</button>
        </div>
        <details><summary>Offene Quoten pro Slot</summary>${oddsTable(nb, false)}
          <p class="muted" style="margin:8px 0 0">Packwert-Verteilung (Slots unabhängig gezogen):</p>${distBars()}
          <p class="muted" style="margin-top:8px">Special Edition je Schein: ${D.EDITIONS.map((e) => `${e.name} ${pct(e.chance)}`).join(', ')}. Zentralbank-Pack: ${pct(D.GOD_PACK_CHANCE)} je Pack.</p>
        </details>
      </article>
      <article class="booster-card">
        <div style="font-size:15px">${packHTML('muenze')}</div>
        <div>
          <h3>Münz-Booster</h3>
          <div class="price tabular">${eur(cb.price)}</div>
          <ul><li>10 Münzen aus 25 Ländern</li><li>Hit-Slot: 1 € oder 2 € aus seltenem Land oder als Gedenkmünze</li><li>Im Schnitt ${fmt.format(evC)} Nennwert (${pct(evC / cb.price)})</li></ul>
          <button class="btn primary" data-action="buy" data-type="muenze">Kaufen und öffnen</button>
        </div>
        <details><summary>Offene Quoten pro Slot</summary>${oddsTable(cb, true)}
          <p class="muted" style="margin-top:8px">Der eigentliche Wert steckt in der Herkunft: Andorra, San Marino, Monaco und der Vatikan sind die Holo-Pulls.</p>
        </details>
      </article>
      <div class="panel"><p><strong>„Zwei Prozent bleiben unser Ziel. Die restlichen 8,5 Prozent nennen wir Spielspaß.“</strong></p>
      <p class="muted" style="font-size:13px">Ausgabelimit heute: ${eur(S.spentToday.date === today() ? S.spentToday.amount : 0)} von ${eur(S.settings.limit)} · Nennwert der Inhalte wird deinem Guthaben gutgeschrieben, das Exemplar landet im Album.</p></div>`;
  }

  function buy(type) {
    const b = type === 'muenze' ? D.COIN_BOOSTER : D.NOTE_BOOSTER;
    if (S.spentToday.date !== today()) S.spentToday = { date: today(), amount: 0 };
    if (S.spentToday.amount + b.price > S.settings.limit) return toast(`Ausgabelimit von ${eur(S.settings.limit)} pro Tag erreicht. Änderbar in den Einstellungen.`);
    if (S.balance < b.price) return toast('Guthaben reicht nicht. In der Wallet gibt es Spielgeld.');
    S.balance = Math.round((S.balance - b.price) * 100) / 100;
    S.spentToday.amount += b.price;
    S.stats.spent += b.price;
    const pack = { uid: uid(), type, boughtAt: Date.now() };
    S.unopened.push(pack);
    save(); render();
    openPack(pack.uid);
  }

  function renderUnopened() {
    const list = $('#unopenedList');
    if (!S.unopened.length) {
      list.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Keine ungeöffneten Packs.<br><br><button class="btn primary" onclick="document.querySelector('[data-tab=shop]').click()">Zum Shop</button></div>`;
      return;
    }
    list.innerHTML = S.unopened.map((p) => `<button data-action="open-pack" data-uid="${p.uid}" aria-label="${p.type === 'muenze' ? 'Münz-Booster' : 'Schein-Booster'} öffnen">
      ${packHTML(p.type, false)}<div class="caption">${p.free ? 'Bonus-Pack' : p.type === 'muenze' ? 'Münz-Booster' : 'Schein-Booster'}</div></button>`).join('');
  }

  // ---------------------------------------------------------------------------
  // Netzwerk-Linien im Bühnenhintergrund
  // ---------------------------------------------------------------------------
  const net = { raf: 0, nodes: [] };
  function startNetwork() {
    const cv = $('#networkCanvas');
    const ctx = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function size() { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
    size();
    net.nodes = Array.from({ length: 34 }, () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, vx: (Math.random() - 0.5) * 0.3 * dpr, vy: (Math.random() - 0.5) * 0.3 * dpr }));
    const step = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      const n = net.nodes; const maxD = 140 * dpr;
      for (const p of n) {
        if (!S.settings.reduceMotion) { p.x += p.vx; p.y += p.vy; }
        if (p.x < 0 || p.x > cv.width) p.vx *= -1;
        if (p.y < 0 || p.y > cv.height) p.vy *= -1;
      }
      for (let i = 0; i < n.length; i++) {
        for (let j = i + 1; j < n.length; j++) {
          const dx = n[i].x - n[j].x, dy = n[i].y - n[j].y, d = Math.hypot(dx, dy);
          if (d < maxD) {
            ctx.strokeStyle = `rgba(111,227,195,${(1 - d / maxD) * 0.35})`;
            ctx.lineWidth = dpr; ctx.beginPath(); ctx.moveTo(n[i].x, n[i].y); ctx.lineTo(n[j].x, n[j].y); ctx.stroke();
          }
        }
        ctx.fillStyle = 'rgba(233,92,192,.6)'; ctx.beginPath(); ctx.arc(n[i].x, n[i].y, 1.6 * dpr, 0, 7); ctx.fill();
      }
      net.raf = requestAnimationFrame(step);
    };
    cancelAnimationFrame(net.raf); step();
  }
  function stopNetwork() { cancelAnimationFrame(net.raf); }

  // ---------------------------------------------------------------------------
  // Effekt-Baukasten
  // ---------------------------------------------------------------------------
  const fxEl = $('#fx');
  function clearFx() { fxEl.innerHTML = ''; }
  function rays(color) {
    const r = document.createElement('div'); r.className = 'rays';
    r.style.setProperty('--ray', color === 'rainbow' ? '#fff' : color);
    fxEl.appendChild(r);
  }
  function particles(color, count = 40, origin = [50, 45]) {
    if (S.settings.reduceMotion) return;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div'); p.className = 'particle';
      const a = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 260;
      p.style.left = origin[0] + '%'; p.style.top = origin[1] + '%';
      p.style.setProperty('--x', Math.cos(a) * dist + 'px');
      p.style.setProperty('--y', Math.sin(a) * dist + 'px');
      p.style.setProperty('--d', 0.8 + Math.random() * 0.9 + 's');
      const c = color === 'rainbow' ? `hsl(${Math.random() * 360},90%,65%)` : color;
      p.style.background = c; p.style.boxShadow = `0 0 10px ${c}`;
      if (Math.random() < 0.3) { p.style.width = p.style.height = '4px'; }
      fxEl.appendChild(p);
      setTimeout(() => p.remove(), 2000);
    }
  }
  function confetti() {
    if (S.settings.reduceMotion) return;
    for (let i = 0; i < 60; i++) {
      const c = document.createElement('div'); c.className = 'confetti';
      c.textContent = Math.random() < 0.6 ? '€' : '●';
      c.style.left = Math.random() * 100 + '%';
      c.style.fontSize = 14 + Math.random() * 22 + 'px';
      c.style.color = `hsl(${Math.random() * 360},90%,65%)`;
      c.style.setProperty('--d', 2.2 + Math.random() * 2.2 + 's');
      c.style.setProperty('--x', (Math.random() - 0.5) * 200 + 'px');
      c.style.setProperty('--r', (Math.random() - 0.5) * 900 + 'deg');
      c.style.animationDelay = Math.random() * 0.8 + 's';
      fxEl.appendChild(c);
      setTimeout(() => c.remove(), 5500);
    }
  }
  function flash() { const f = document.createElement('div'); f.className = 'flash'; fxEl.appendChild(f); setTimeout(() => f.remove(), 700); }
  function shake() {
    if (S.settings.reduceMotion) return;
    const c = $('#stageCenter'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
  }

  // ---------------------------------------------------------------------------
  // Pack-Opening
  // ---------------------------------------------------------------------------
  const stage = $('#stage');
  const center = $('#stageCenter');
  const tray = $('#stageTray');
  const hint = $('#stageHint');
  const counter = $('#stageCounter');
  let run = 0;
  let skipFn = null;
  let lastResult = null;

  function wait(ms, canSkip = true) {
    const myRun = run;
    if (S.settings.reduceMotion) ms = Math.min(ms, 450);
    return new Promise((res) => {
      const done = () => { clearTimeout(t); abortFns.delete(done); if (skipFn === done) skipFn = null; res(myRun === run); };
      const t = setTimeout(done, ms);
      skipFn = canSkip ? done : null;
      if (!canSkip) abortFns.add(done);
    });
  }
  const abortFns = new Set();
  stage.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    if (skipFn) skipFn();
  });

  $('#stageClose').addEventListener('click', closeStage);
  function closeStage() {
    run++;
    if (skipFn) skipFn();
    abortFns.forEach((f) => f()); abortFns.clear();
    stage.hidden = true; stage.classList.remove('god');
    stopNetwork(); clearFx();
    document.body.style.overflow = '';
    render();
  }

  function setHint(t) { hint.textContent = t || ''; }
  function setCounter(v, label = 'Packwert') { counter.textContent = v == null ? '' : `${label} ${fmt.format(v)}`; }

  function openPack(packUid) {
    const pack = S.unopened.find((p) => p.uid === packUid);
    if (!pack) return;
    run++;
    const myRun = run;
    stage.hidden = false; document.body.style.overflow = 'hidden';
    tray.innerHTML = ''; clearFx(); setCounter(null);
    $('#stageDim').classList.remove('on');
    startNetwork();
    center.innerHTML = `<div class="stage-pack" id="stagePack">
      <div class="foreshadow" id="foreshadow"></div>
      ${packHTML(pack.type, false)}
      <div class="pack-top"></div>
      <div class="tear-line" id="tearLine"></div>
      <div class="tear-zone" id="tearZone" role="button" tabindex="0" aria-label="Pack aufreißen"></div>
    </div>`;
    setHint('Über die Oberkante wischen zum Aufreißen');
    const zone = $('#tearZone'), line = $('#tearLine'), packEl = $('#stagePack');
    let startX = null, torn = false;
    const tear = () => {
      if (torn || myRun !== run) return;
      torn = true;
      line.style.width = '100%';
      packEl.classList.add('torn');
      sfx.tear(); haptic(2);
      runOpening(pack, myRun);
    };
    zone.addEventListener('pointerdown', (e) => { startX = e.clientX; zone.setPointerCapture(e.pointerId); });
    zone.addEventListener('pointermove', (e) => {
      if (startX == null) return;
      const w = packEl.offsetWidth;
      const dx = Math.abs(e.clientX - startX);
      line.style.width = Math.min(100, (dx / w) * 100) + '%';
      if (dx > w * 0.6) tear();
    });
    zone.addEventListener('pointerup', () => { startX = null; if (!torn) line.style.width = '0'; });
    zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tear(); } });
    // Wer nicht wischen kann: zweimal auf das Pack tippen
    packEl.addEventListener('dblclick', tear);
  }

  function commitPack(pack, result) {
    S.unopened = S.unopened.filter((p) => p.uid !== pack.uid);
    const all = result.items.concat(result.bonus ? [result.bonus] : []);
    for (const it of all) {
      it.isNew = ownedCount(it.id) === 0;
      it.dupCount = ownedCount(it.id);
      S.items.push(Object.assign({}, it, { uid: uid(), foundAt: Date.now(), source: pack.type }));
    }
    S.balance = Math.round((S.balance + result.value) * 100) / 100;
    S.stats.packs++;
    S.stats.received = Math.round((S.stats.received + result.value) * 100) / 100;
    if (result.value < result.price) S.stats.bankWins++;
    const hit = result.items.reduce((a, b) => (itemValue(b) > itemValue(a) ? b : a));
    if (!S.stats.best || itemValue(hit) > S.stats.best.value) {
      S.stats.best = { value: itemValue(hit), label: describe(hit), at: Date.now() };
    }
    const bonuses = checkSetBonuses();
    save();
    return bonuses;
  }

  function describe(it) {
    if (it.kind === 'coin') return `${coinLabel(it.cents)} ${it.countryName}${it.commemorative ? ' (Gedenkmünze ' + it.commemorative + ')' : ''}`;
    const m = D.MOTIFS[it.theme][it.denom].front;
    return `${it.denom} € ${m}${it.edition ? ' · ' + editionName(it.edition) : ''}${it.kind === 'proto' ? ' (Prototyp ' + it.design + ')' : ''}`;
  }

  async function runOpening(pack, myRun) {
    const result = pack.type === 'muenze' ? EB.openCoinPack() : EB.openNotePack();
    if (pack.free) result.price = 0;
    const bonuses = commitPack(pack, result);
    lastResult = { result, pack };
    if (result.godPack) { stage.classList.add('god'); sfx.hit(3); }
    const coin = result.type === 'muenze';
    const items = result.items;
    const hit = items[items.length - 1];
    const best = items.reduce((a, b) => (rarityOf(b).level > rarityOf(a).level ? b : a));
    const ok = () => myRun === run;

    // Vorahnung: Licht in der Farbe des besten Inhalts
    const fs = $('#foreshadow');
    const bestGlow = rarityOf(best).glow;
    if (bestGlow) {
      fs.style.background = bestGlow === 'rainbow' ? 'var(--rainbow)' : bestGlow;
      fs.classList.add('on');
      haptic(rarityOf(best).level >= 3 ? 3 : 1);
    }
    setHint(result.godPack ? 'ZENTRALBANK-PACK – nur Special Editions!' : bestGlow ? 'Da leuchtet etwas …' : 'Kein Licht. Kein Hit. Vielleicht.');
    if (!(await wait(1400)) || !ok()) return;

    // Gewöhnliche Slots
    let running = 0;
    setCounter(0);
    setHint('Tippen zum Überspringen');
    for (let i = 0; i < items.length - 1; i++) {
      if (!ok()) return;
      await showCard(items[i], coin ? 450 : 1000, myRun);
      if (!ok()) return;
      running += itemValue(items[i]);
      setCounter(running);
      sendToTray(items[i]);
    }

    // Trennkarte
    center.innerHTML = '';
    const hr = rarityOf(hit);
    const divColor = hr.glow === 'rainbow' ? 'var(--rainbow)' : hr.glow || '#5a6078';
    center.innerHTML = `<div class="divider-card" style="background:${divColor};color:${hr.glow === '#FFC53D' || hr.glow === 'rainbow' ? '#0B1020' : '#fff'}">HIT-SLOT</div>`;
    $('#stageDim').classList.add('on');
    setHint('');
    haptic(1);
    if (!(await wait(1300)) || !ok()) return;

    // Stufen-Reveal: erst Land, dann Druckerei/Jahr, dann Farbe
    const lock = !coin && hit.denom >= 50; // Hit-Reveal ab 50 € nicht überspringbar
    setHint(lock ? '' : 'Tippen zum Überspringen');
    center.innerHTML = '<div class="steps" id="steps"></div>';
    const steps = $('#steps');
    const addStep = (html) => { steps.insertAdjacentHTML('beforeend', `<div class="step">${html}</div>`); sfx.drum(); haptic(1); };
    if (coin) {
      addStep(`<div class="big">${flag(hit.country)}</div><div class="lbl">${esc(hit.countryName)}</div>`);
      if (!(await wait(1100, !lock)) || !ok()) return;
      addStep(`<div class="code">${hit.commemorative ? 'GEDENK ' + hit.commemorative : 'UMLAUF'}</div><div class="lbl">Prägung</div>`);
      if (!(await wait(1100, !lock)) || !ok()) return;
    } else {
      addStep(`<div class="big">${flag(hit.country)}</div><div class="lbl">Druckland</div>`);
      if (!(await wait(1100, !lock)) || !ok()) return;
      addStep(`<div class="code">${esc(hit.printer)}</div><div class="lbl">Druckerei ${esc(hit.printerName)}</div>`);
      if (!(await wait(1100, !lock)) || !ok()) return;
      addStep(`<div class="swatch" style="background:${D.DENOM_COLORS[hit.denom]};color:${D.DENOM_COLORS[hit.denom]}"></div><div class="lbl">Stückelung</div>`);
      if (!(await wait(1200, !lock)) || !ok()) return;
    }

    // Hit
    await showCard(hit, 0, myRun, true);
    if (!ok()) return;
    running += itemValue(hit);
    setCounter(running);
    const lvl = hr.level;
    if (lvl >= 1) { rays(hr.glow); particles(hr.glow, 20 + lvl * 15); }
    if (lvl >= 2) shake();
    if (lvl >= 3) flash();
    if (!coin && hit.denom === 200) { confetti(); sfx.coin(); }
    sfx.hit(Math.min(lvl, 2)); haptic(lvl >= 3 ? 3 : lvl >= 1 ? 2 : 1);

    // Seriennummer tippt sich ein
    if (!coin) {
      const label = center.querySelector('.reveal-label');
      label.insertAdjacentHTML('beforeend', '<div class="serial-type" id="serialType"></div>');
      const st = $('#serialType');
      for (let i = 1; i <= hit.serial.length; i++) {
        if (!ok()) return;
        st.innerHTML = esc(hit.serial.slice(0, i)) + '<span class="caret">&nbsp;</span>';
        sfx.tick();
        if (!S.settings.reduceMotion) await wait(70, false);
      }
      st.textContent = hit.serial;
      if (hit.rareSerial) {
        st.insertAdjacentHTML('afterend', `<span class="badge serial">${esc(hit.rareSerial)}!</span>`);
        particles('#FFC53D', 40, [50, 60]); sfx.hit(2); haptic(3);
      }
      if (!(await wait(lvl >= 2 ? 2200 : 1400, !lock)) || !ok()) return;
    } else if (!(await wait(lvl >= 2 ? 2000 : 1300)) || !ok()) return;

    sendToTray(hit);
    $('#stageDim').classList.remove('on');
    clearFx();

    // Prototyp-Bonus
    if (result.bonus) {
      setHint('Tippen zum Überspringen');
      await showCard(result.bonus, 1800, myRun, false, 'Diesen Schein gibt es nie wirklich');
      if (!ok()) return;
      sendToTray(result.bonus);
    }

    showSummary(result, bonuses);
  }

  function badgesFor(it) {
    const b = [];
    if (it.isNew) b.push('<span class="badge new">NEU!</span>');
    else b.push(`<span class="badge dup">Doppelt ×${it.dupCount + 1}</span>`);
    if (it.edition) b.push(`<span class="badge ed">${esc(editionName(it.edition))}</span>`);
    if (it.rareSerial) b.push(`<span class="badge serial">${esc(it.rareSerial)}</span>`);
    if (it.kind === 'proto') b.push('<span class="badge proto">Prototyp</span>');
    if (it.commemorative) b.push('<span class="badge ed">Gedenkmünze</span>');
    if (it.rareCountry) b.push('<span class="badge serial">Seltenes Land</span>');
    return b.join('');
  }

  async function showCard(it, holdMs, myRun, isHit = false, subtitle = '') {
    const coin = it.kind === 'coin';
    const r = rarityOf(it);
    const glow = r.glow ? `<div class="glow ${r.glow === 'rainbow' ? 'rainbow' : ''}" style="${r.glow === 'rainbow' ? '' : 'background:' + r.glow}"></div>` : '';
    const title = coin ? `${coinLabel(it.cents)} · ${esc(it.countryName)}` : `${it.denom} € · ${esc(D.MOTIFS[it.theme][it.denom].front)}`;
    const sub = subtitle || (coin ? (it.commemorative ? 'Gedenkmünze ' + it.commemorative : 'Umlaufmünze') : it.kind === 'proto' ? `Prototyp · Entwurf ${it.design}` : `${r.name}${it.edition ? ' · ' + editionName(it.edition) : ''}`);
    center.innerHTML = `<div class="reveal ${coin ? 'coin-reveal' : ''}">
        <div class="flipper face-down">${glow}<div class="face">${itemHTML(it, { extra: it.edition === 'tinte' ? 'print-in' : '' })}</div><div class="card-back">€</div></div>
        <div class="reveal-label" style="opacity:0;transition:opacity .3s"><div class="r-title">${title}</div><div class="r-sub">${esc(sub)}</div><div>${badgesFor(it)}</div></div>
      </div>`;
    const fl = center.querySelector('.flipper');
    const label = center.querySelector('.reveal-label');
    // Verdeckt mit Glühen, dann umdrehen
    await new Promise((res) => setTimeout(res, isHit ? 350 : S.settings.reduceMotion ? 50 : 260));
    if (myRun !== run) return;
    fl.classList.remove('face-down');
    sfx.flip(); haptic(it.edition || r.level >= 1 ? 2 : 1);
    if (it.edition) {
      particles(it.edition === 'gold' ? '#FFC53D' : '#E95CC0', 24);
      if (it.edition === 'gold') { flash(); sfx.coin(); }
    }
    if (coin && (it.rareCountry || it.commemorative)) sfx.coin();
    await new Promise((res) => setTimeout(res, 250));
    label.style.opacity = 1;
    if (holdMs) await wait(holdMs);
  }

  function sendToTray(it) {
    const d = document.createElement('div');
    d.innerHTML = itemHTML(it, { hideSerial: true });
    tray.appendChild(d.firstElementChild);
    center.innerHTML = '';
  }

  // ---------------------------------------------------------------------------
  // Übersicht nach dem Opening
  // ---------------------------------------------------------------------------
  function showSummary(result, bonuses) {
    tray.innerHTML = ''; setHint(''); clearFx();
    const all = result.items.concat(result.bonus ? [result.bonus] : []);
    // nach Wert sortieren, Hit in die Mitte
    const sorted = all.slice().sort((a, b) => itemValue(a) - itemValue(b) || (a.kind === 'proto') - (b.kind === 'proto'));
    const top = result.items.reduce((a, b) => (itemValue(b) > itemValue(a) ? b : a));
    const rest = sorted.filter((x) => x !== top);
    const order = [];
    rest.forEach((x, i) => (i % 2 ? order.push(x) : order.unshift(x)));
    order.splice(Math.floor(order.length / 2), 0, top);
    const coin = result.type === 'muenze';
    const n = order.length;
    const spread = coin ? 8 : 9;
    const fanItems = order.map((it, i) => {
      const k = i - (n - 1) / 2;
      const isTop = it === top;
      const shift = k * (coin ? 26 : 34);
      return `<div class="fan-item ${coin ? 'coinish' : ''} ${isTop ? 'hit' : ''}" style="transform:translateX(calc(-50% + ${shift}px)) rotate(${k * spread}deg) translateY(${Math.abs(k) * 8}px)">
        <div class="fan-badges">${it.isNew ? '<span class="badge new">NEU!</span>' : ''}${it.rareSerial ? '<span class="badge serial">Nummer</span>' : ''}${it.kind === 'proto' ? '<span class="badge proto">Prototyp</span>' : ''}${it.edition ? '<span class="badge ed">' + esc(editionName(it.edition)) + '</span>' : ''}</div>
        ${itemHTML(it, { hideSerial: true })}</div>`;
    }).join('');
    const v = result.value, p = result.price;
    const verdict = p === 0 ? `<span class="win">Bonus-Pack: ${fmt.format(v)} geschenkt</span>`
      : v > p ? `<span class="win">${fmt.format(v)} – Du schlägst die EZB</span>`
      : v === p ? `<span>${fmt.format(v)} – Unentschieden mit der EZB</span>`
      : `<span class="lose">${fmt.format(v)} von ${fmt.format(p)} – Bank gewinnt</span>`;
    center.innerHTML = `<div class="summary">
      <div class="hero-outline" style="font-size:clamp(28px,9vw,44px);align-items:center;margin:0">
        <span>PACK</span><span class="filled">GEÖFFNET</span></div>
      <div class="fan">${fanItems}</div>
      <div class="verdict">${verdict}</div>
      ${bonuses.length ? `<div class="badge new" style="font-size:13px">Set komplett: ${bonuses.map(esc).join(', ')} – Bonus-Pack erhalten!</div>` : ''}
      <div class="button-row">
        <button class="btn primary" id="toAlbum">Ins Album</button>
        <button class="btn hot" id="again">Noch ein Pack</button>
        <button class="btn" id="share">Teilen</button>
      </div></div>`;
    // Zähler läuft hoch
    let shown = 0;
    const t0 = performance.now();
    const dur = S.settings.reduceMotion ? 1 : 900;
    const tick = (t) => {
      shown = v * Math.min(1, (t - t0) / dur);
      setCounter(Math.round(shown * 100) / 100);
      if (t - t0 < dur && !stage.hidden) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    $('#toAlbum').onclick = () => {
      closeStage();
      openAlbumAt(top);
    };
    $('#again').onclick = () => {
      const type = result.type;
      const free = S.unopened.find((x) => x.type === type);
      if (free) return openPack(free.uid);
      closeStage(); buy(type);
    };
    $('#share').onclick = () => share(result);
  }

  async function share(result) {
    const top = result.items.reduce((a, b) => (itemValue(b) > itemValue(a) ? b : a));
    const text = `Mein EUROPACK: ${fmt.format(result.value)} Packwert für ${fmt.format(result.price)}. Bester Pull: ${describe(top)}. ${result.value > result.price ? 'Ich schlage die EZB!' : 'Die Bank gewinnt.'}`;
    try {
      if (navigator.share) await navigator.share({ title: 'EUROPACK', text });
      else { await navigator.clipboard.writeText(text); toast('In die Zwischenablage kopiert.'); }
    } catch (e) { /* abgebrochen */ }
  }

  // ---------------------------------------------------------------------------
  // Sammelalbum
  // ---------------------------------------------------------------------------
  const ALBUM_TABS = [
    ['echt', 'Echte Serie'],
    ['proto', 'Prototypen'],
    ['muenzen', 'Münzen'],
    ['gedenk', 'Gedenkmünzen'],
    ['tresor', 'Tresor'],
  ];
  let albumTab = 'echt';
  let highlightId = null;

  function albumPages() {
    const winner = designById(D.WINNER_DESIGN);
    const pages = [{ key: 'echt', id: 'echt', title: `Siegerdesign ${winner.id}`, ids: D.DENOMS.map((d) => EB.noteId(winner.id, d)) }];
    D.DESIGNS.filter((d) => d.id !== D.WINNER_DESIGN).forEach((d) => pages.push({ key: 'proto', id: 'proto-' + d.id, title: `Entwurf ${d.id}`, ids: D.DENOMS.map((x) => EB.noteId(d.id, x)) }));
    D.COIN_COUNTRIES.forEach((c) => pages.push({ key: 'muenzen', id: 'coin-' + c.code, title: c.name, ids: D.COIN_VALUES.map((v) => EB.coinId(c.code, v)) }));
    return pages;
  }

  function checkSetBonuses() {
    const owned = new Set(S.items.map((i) => i.id));
    const done = [];
    for (const p of albumPages()) {
      if (S.setBonuses.includes(p.id)) continue;
      if (p.ids.every((id) => owned.has(id))) {
        S.setBonuses.push(p.id);
        S.unopened.push({ uid: uid(), type: p.key === 'muenzen' ? 'muenze' : 'schein', boughtAt: Date.now(), free: true });
        done.push(p.title);
      }
    }
    return done;
  }

  function progressHTML(label, have, total) {
    return `<div class="progress"><div class="label"><span>${esc(label)}</span><span class="tabular">${have}/${total}</span></div><div class="track"><i style="width:${total ? (have / total) * 100 : 0}%"></i></div></div>`;
  }

  function renderAlbum() {
    $('#albumTabs').innerHTML = ALBUM_TABS.map(([k, l]) => `<button role="tab" aria-selected="${k === albumTab}" data-album="${k}">${l}</button>`).join('');
    $$('#albumTabs button').forEach((b) => b.addEventListener('click', () => { albumTab = b.dataset.album; highlightId = null; renderAlbum(); }));
    const sel = $('#albumTabs [aria-selected="true"]');
    if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const owned = new Map();
    for (const it of S.items) owned.set(it.id, (owned.get(it.id) || 0) + 1);
    const firstOf = (id) => S.items.find((i) => i.id === id);
    const body = $('#albumBody');
    const pages = albumPages().filter((p) => p.key === albumTab);

    if (albumTab === 'echt' || albumTab === 'proto') {
      const total = pages.reduce((s, p) => s + p.ids.length, 0);
      const have = pages.reduce((s, p) => s + p.ids.filter((id) => owned.has(id)).length, 0);
      const winnerNote = albumTab === 'echt' ? `<p class="muted" style="font-size:13px;margin:0 0 8px">Annahme: Entwurf ${D.WINNER_DESIGN} gewinnt. Die EZB entscheidet voraussichtlich im Dezember 2026.</p>` : '';
      body.innerHTML = winnerNote + progressHTML(albumTab === 'echt' ? 'Echte Serie' : 'Prototypen', have, total) + pages.map((p) => {
        const d = designById(p.id.replace('proto-', '').replace('echt', D.WINNER_DESIGN));
        const complete = p.ids.every((id) => owned.has(id));
        return `<div class="album-page"><h3>${esc(p.title)} ${complete ? '<span class="badge new">Set komplett</span>' : ''}</h3>
          <div class="sub">${esc(d.designer)} · ${d.theme === 'kultur' ? 'Europäische Kultur' : 'Flüsse und Vögel'} · ${esc(d.style)}</div>
          <div class="sleeves">${p.ids.map((id, i) => {
            const denom = D.DENOMS[i];
            if (!owned.has(id)) return `<div class="sleeve empty"><div class="ghost">${denom} €<br>${esc(D.MOTIFS[d.theme][denom].front)}</div></div>`;
            const best = S.items.filter((x) => x.id === id).sort((a, b) => (b.edition ? 1 : 0) - (a.edition ? 1 : 0))[0];
            return `<button class="sleeve ${highlightId === id ? 'highlight' : ''}" data-detail="${id}" aria-label="${denom} € ansehen">${owned.get(id) > 1 ? `<span class="count">×${owned.get(id)}</span>` : ''}${noteHTML(best, { hideSerial: true })}</button>`;
          }).join('')}</div></div>`;
      }).join('');
    } else if (albumTab === 'muenzen') {
      const total = pages.length * 8;
      const have = pages.reduce((s, p) => s + p.ids.filter((id) => owned.has(id)).length, 0);
      body.innerHTML = progressHTML('Umlaufmünzen', have, total) + pages.map((p) => {
        const cc = p.id.replace('coin-', '');
        const n = p.ids.filter((id) => owned.has(id)).length;
        return `<div class="album-page country-page"><h3><span>${flag(cc)} ${esc(p.title)}</span><span class="tabular muted" style="font-size:14px">${n}/8</span></h3>
          <div class="coin-grid">${p.ids.map((id, i) => {
            const v = D.COIN_VALUES[i];
            if (!owned.has(id)) return `<div class="coin-slot"><div class="hole">${coinLabel(v)}</div></div>`;
            return `<button class="coin-slot ${highlightId === id ? 'highlight' : ''}" data-detail="${id}" aria-label="${coinLabel(v)} ${esc(p.title)}" style="position:relative">${owned.get(id) > 1 ? `<span class="count" style="position:absolute;top:-4px;right:-4px;z-index:2;background:var(--magenta);border-radius:999px;padding:0 5px;font-weight:700">×${owned.get(id)}</span>` : ''}${coinHTML(firstOf(id))}</button>`;
          }).join('')}</div></div>`;
      }).join('');
    } else if (albumTab === 'gedenk') {
      const gs = S.items.filter((i) => i.commemorative);
      const byYear = {};
      gs.forEach((g) => { (byYear[g.commemorative] = byYear[g.commemorative] || new Map()).set(g.id, g); });
      const years = Object.keys(byYear).sort();
      body.innerHTML = `<div class="album-page"><h3>Zeitleiste</h3><div class="sub">Jedes Land darf zusätzlich Gedenkmotive ausgeben. Wischen zum Blättern.</div>
        ${years.length ? `<div class="timeline">${years.flatMap((y) => [...byYear[y].values()].map((g) => `<button class="coin-slot" data-detail="${g.id}" style="background:none;border:0"><div style="width:80px;margin:0 auto">${coinHTML(g)}</div><div style="margin-top:6px"><strong>${y}</strong><br>${esc(g.countryName)}</div></button>`)).join('')}</div>`
          : '<div class="empty-state">Noch keine Gedenkmünze. Sie kommen nur im Hit-Slot des Münz-Boosters.</div>'}</div>`;
    } else if (albumTab === 'tresor') {
      const specials = S.items.filter((i) => i.edition || i.rareSerial);
      body.innerHTML = `<div class="album-page vault"><h3>Tresor</h3><div class="sub">Special Editions und seltene Seriennummern, auf Samt.</div>
        ${specials.length ? `<div class="sleeves">${specials.map((it) => `<button class="sleeve" data-detail="${it.id}" data-uid="${it.uid}">${itemHTML(it, { hideSerial: !it.rareSerial })}</button>`).join('')}</div>`
          : '<div class="empty-state">Der Tresor ist leer. Rund jeder neunte Schein ist eine Special Edition.</div>'}</div>`;
    }
    $$('[data-detail]', body).forEach((b) => b.addEventListener('click', () => openDetail(b.dataset.detail, b.dataset.uid)));
    if (highlightId) {
      const el = body.querySelector(`[data-detail="${highlightId}"]`);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: S.settings.reduceMotion ? 'auto' : 'smooth', block: 'center' }), 60);
    }
  }

  function openAlbumAt(it) {
    albumTab = it.kind === 'coin' ? (it.commemorative ? 'gedenk' : 'muenzen') : it.kind === 'proto' ? 'proto' : 'echt';
    highlightId = it.id;
    showTab('album');
  }

  // Einzelansicht mit Holo-Neigung
  let tiltEl = null;
  function onOrient(e) {
    if (!tiltEl || e.gamma == null) return;
    const rx = Math.max(-20, Math.min(20, (e.beta - 40) / 2));
    const ry = Math.max(-20, Math.min(20, e.gamma / 2));
    applyTilt(rx, ry);
  }
  function applyTilt(rx, ry) {
    if (!tiltEl) return;
    tiltEl.style.transform = `rotateX(${-rx}deg) rotateY(${ry}deg)`;
    tiltEl.style.setProperty('--gx', 50 + ry * 2.2 + '%');
    tiltEl.style.setProperty('--gy', 50 + rx * 2.2 + '%');
    const inner = tiltEl.querySelector('.note, .coin');
    if (inner) inner.style.filter = (inner.classList.contains('ed-tinte') ? 'grayscale(1) contrast(1.25) ' : '') + `hue-rotate(${ry * 1.5}deg)`;
  }

  function openDetail(id, exUid) {
    const list = S.items.filter((i) => i.id === id);
    if (!list.length) return;
    let idx = Math.max(0, exUid ? list.findIndex((x) => x.uid === exUid) : list.findIndex((x) => x.edition));
    let back = false;
    const draw = () => {
      const it = list[idx];
      const coin = it.kind === 'coin';
      const design = !coin && designById(it.design);
      const facts = coin ? [
        ['Wert', coinLabel(it.cents)], ['Land', `${flag(it.country)} ${it.countryName}`],
        ['Prägung', it.commemorative ? 'Gedenkmünze ' + it.commemorative : 'Umlaufmünze'],
      ] : [
        ['Motiv', D.MOTIFS[it.theme][it.denom].front], ['Rückseite', D.MOTIFS[it.theme][it.denom].back],
        ['Entwurf', `${design.id} · ${design.designer}`], ['Thema', it.theme === 'kultur' ? 'Europäische Kultur' : 'Flüsse und Vögel'],
        ['Seriennummer', `<span class="mono">${esc(it.serial)}</span>${it.rareSerial ? ' <span class="badge serial">' + esc(it.rareSerial) + '</span>' : ''}`],
        ...(it.kind === 'note' ? [['Druckerei', `${esc(it.printer)} · ${esc(it.printerName)} ${flag(it.country)}`]] : [['Status', 'Nie gedruckt – nur Sammelkarte']]),
        ['Edition', it.edition ? editionName(it.edition) : 'Standard'],
      ];
      facts.push(['Exemplare', `${list.length}${list.length > 1 ? ` (zeige ${idx + 1})` : ''}`], ['Gefunden', new Date(it.foundAt).toLocaleString('de-DE')]);
      const title = coin ? `${coinLabel(it.cents)} · ${it.countryName}` : `${it.denom} € · ${D.MOTIFS[it.theme][it.denom].front}`;
      openModal(`<h2>${esc(title)}</h2>
        <div class="detail-stage" id="detailStage"><div class="tilt ${coin ? 'coin-tilt' : ''}" id="tilt">${coin ? coinHTML(it) : noteHTML(it, { back })}<div class="glare"></div></div></div>
        <dl class="facts">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${k === 'Seriennummer' || k === 'Land' || k === 'Druckerei' ? v : esc(v)}</dd>`).join('')}</dl>
        <div class="button-row">
          ${coin ? '' : '<button class="btn" id="flipBtn">Wenden</button>'}
          ${list.length > 1 ? '<button class="btn" id="nextEx">Nächstes Exemplar</button><button class="btn hot" id="tradeEx">Tauschen</button>' : ''}
          <button class="btn primary" data-close>Schließen</button>
        </div>`, (card) => {
        tiltEl = $('#tilt', card);
        const ds = $('#detailStage', card);
        ds.addEventListener('pointermove', (e) => {
          const r = ds.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
          applyTilt(y * 30, x * 30);
        });
        ds.addEventListener('pointerleave', () => applyTilt(0, 0));
        let sx = null;
        ds.addEventListener('pointerdown', (e) => (sx = e.clientX));
        ds.addEventListener('pointerup', (e) => { if (!coin && sx != null && Math.abs(e.clientX - sx) > 60) { back = !back; draw(); } sx = null; });
        window.addEventListener('deviceorientation', onOrient);
        const fb = $('#flipBtn', card); if (fb) fb.onclick = () => { back = !back; draw(); };
        const nx = $('#nextEx', card); if (nx) nx.onclick = () => { idx = (idx + 1) % list.length; back = false; draw(); };
        const tx = $('#tradeEx', card); if (tx) tx.onclick = () => openTradeOffer(id);
      });
    };
    draw();
  }

  // ---------------------------------------------------------------------------
  // Tausch
  // ---------------------------------------------------------------------------
  function renderTrade() {
    const counts = new Map();
    for (const it of S.items) counts.set(it.id, (counts.get(it.id) || []).concat(it));
    const dups = [...counts.values()].filter((l) => l.length > 1).sort((a, b) => b.length - a.length);
    $('#tradeList').innerHTML = dups.length ? `<div class="album-page"><h3>Deine Doppelten</h3><div class="sub">${dups.reduce((s, l) => s + l.length - 1, 0)} Exemplare zum Tauschen</div>
      <div class="sleeves">${dups.map((l) => `<button class="sleeve" data-trade="${l[0].id}" aria-label="Tauschen: ${esc(describe(l[0]))}"><span class="count">×${l.length}</span>${l[0].kind === 'coin' ? `<div style="width:80%;margin:0 auto">${coinHTML(l[0])}</div>` : noteHTML(l[0], { hideSerial: true })}</button>`).join('')}</div></div>`
      : '<div class="empty-state">Noch keine Doppelten. Weiter öffnen – rein geldpolitisch betrachtet.</div>';
    $$('#tradeList [data-trade]').forEach((b) => b.addEventListener('click', () => openTradeOffer(b.dataset.trade)));
  }

  // Simulierte Tauschpartner, bis es echte andere Nutzer gibt
  const PARTNERS = [
    'Ana aus Lissabon', 'Jonas aus Tallinn', 'Giulia aus Bologna', 'Mateo aus Valencia',
    'Eva aus Ljubljana', 'Lena aus Graz', 'Niamh aus Cork', 'Tomás aus Bratislava',
  ];

  // Welches Exemplar geht weg? Das unspektakulärste, damit Special Editions bleiben.
  function exemplarToGive(id) {
    const list = S.items.filter((i) => i.id === id);
    const plain = list.filter((i) => !i.edition && !i.rareSerial);
    return (plain.length ? plain : list).slice(-1)[0];
  }

  function openTradeOffer(id) {
    if (ownedCount(id) < 2) return toast('Getauscht werden nur Doppelte.');
    const given = exemplarToGive(id);
    const owned = new Set(S.items.map((i) => i.id));
    const partner = PARTNERS[Math.floor(Math.random() * PARTNERS.length)];
    const offer = EB.makeTradeOffer(Math.random, given, owned);
    const card = (it) => `<div class="card">${itemHTML(it, { hideSerial: true })}</div>`;
    openModal(`<h2>Tausch 1:1</h2>
      <div class="trade-offer">
        <div class="side"><div class="who">Du gibst</div>${card(given)}<div>${esc(describe(given))}</div></div>
        <div class="swap" aria-hidden="true">⇄</div>
        <div class="side"><div class="who">${esc(partner)} gibt</div>${card(offer)}<div>${esc(describe(offer))}</div>
          ${owned.has(offer.id) ? '' : '<span class="badge new">NEU für dich</span>'}</div>
      </div>
      <p class="muted" style="font-size:13px;margin:0 0 6px">Gleicher Nennwert, weil es ja Geld ist. Du gibst ein Doppeltes ab und behältst mindestens ein Exemplar.</p>
      <div class="button-row">
        <button class="btn" id="otherOffer">Anderes Angebot</button>
        <button class="btn primary" id="doTrade">Tauschen</button>
      </div>
      <div class="button-row" style="margin-top:0"><button class="btn" data-close>Abbrechen</button></div>`, (m) => {
      $('#otherOffer', m).onclick = () => openTradeOffer(id);
      $('#doTrade', m).onclick = () => { closeModal(); runTrade(given, offer, partner); };
    });
  }

  function commitTrade(given, received, partner) {
    S.items = S.items.filter((i) => i.uid !== given.uid);
    const rec = Object.assign({}, received, { uid: uid(), foundAt: Date.now(), source: 'tausch', partner });
    rec.isNew = ownedCount(rec.id) === 0;
    S.items.push(rec);
    S.stats.trades = (S.stats.trades || 0) + 1;
    save();
    return rec;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, S.settings.reduceMotion ? Math.min(ms, 350) : ms));

  async function runTrade(given, offer, partner) {
    const rec = commitTrade(given, offer, partner);
    const ts = $('#tradeStage'), slot = $('#tradeSlot'), cap = $('#tradeCaption'), actions = $('#tradeActions');
    const coinish = (it) => it.kind === 'coin';
    const show = (it, cls) => {
      slot.classList.toggle('coinish', coinish(it));
      slot.innerHTML = `<div class="glow"></div><div class="${cls}">${itemHTML(it)}</div>`;
    };
    ts.hidden = false; actions.hidden = true;
    document.body.style.overflow = 'hidden';
    $('#tradeHead').innerHTML = `Tausch mit ${esc(partner)}<span class="muted">1:1 – weil es ja Geld ist</span>`;

    // 1. Eigener Schein liegt kurz da, dann geht er über die obere Kante raus
    show(given, '');
    cap.innerHTML = `<div class="t-title">Du gibst</div><div class="t-sub">${esc(describe(given))}</div>`;
    await sleep(900);
    slot.lastElementChild.classList.add('trade-out');
    noise(0.5, 0.12); haptic(1);
    await sleep(1000);

    // 2. Neuer Schein kommt von oben rein
    cap.innerHTML = '';
    show(rec, 'trade-in');
    noise(0.4, 0.08);
    await sleep(950);
    slot.querySelector('.glow').classList.add('on');
    sfx.coin(); haptic(2);
    cap.innerHTML = `<div class="t-title">Du bekommst</div><div class="t-sub">${esc(describe(rec))}</div>
      <div>${rec.isNew ? '<span class="badge new">NEU!</span>' : ''}${rec.edition ? `<span class="badge ed">${esc(editionName(rec.edition))}</span>` : ''}${rec.rareSerial ? `<span class="badge serial">${esc(rec.rareSerial)}</span>` : ''}</div>`;
    actions.hidden = false;
    $('#tradeDone').focus();
    $('#tradeDone').onclick = () => closeTrade();
    $('#tradeToAlbum').onclick = () => { closeTrade(); openAlbumAt(rec); };
  }

  function closeTrade() {
    $('#tradeStage').hidden = true;
    $('#tradeSlot').innerHTML = '';
    document.body.style.overflow = '';
    render();
  }

  // ---------------------------------------------------------------------------
  // Profil und Einstellungen
  // ---------------------------------------------------------------------------
  $('#balanceChip').addEventListener('click', openProfile);
  function openProfile() {
    const st = S.stats;
    const quote = st.packs ? st.bankWins / st.packs : 0;
    const uniq = new Set(S.items.map((i) => i.id)).size;
    openModal(`<h2>Profil</h2>
      <div class="stat-grid">
        <div class="stat"><div class="v">${st.packs}</div><div class="k">Packs geöffnet</div></div>
        <div class="stat"><div class="v">${pct(quote)}</div><div class="k">„Bank gewinnt“-Quote</div></div>
        <div class="stat"><div class="v">${fmt.format(st.spent)}</div><div class="k">Ausgegeben</div></div>
        <div class="stat"><div class="v">${fmt.format(st.received)}</div><div class="k">Nennwert erhalten</div></div>
        <div class="stat" style="grid-column:1/-1"><div class="v" style="font-size:16px">${st.best ? esc(st.best.label) : '–'}</div><div class="k">Bester Pull</div></div>
        <div class="stat"><div class="v">${uniq}</div><div class="k">Verschiedene Stücke</div></div>
        <div class="stat"><div class="v">${S.items.length}</div><div class="k">Exemplare gesamt</div></div>
        <div class="stat"><div class="v">${st.trades || 0}</div><div class="k">Tausche</div></div>
      </div>
      <h3 style="font-family:var(--font-head);margin:0 0 4px">Einstellungen</h3>
      <div class="settings">
        <label>Haptik<input type="checkbox" data-set="haptics" ${S.settings.haptics ? 'checked' : ''}></label>
        <label>Ton<input type="checkbox" data-set="sound" ${S.settings.sound ? 'checked' : ''}></label>
        <label>Bewegung reduzieren<input type="checkbox" data-set="reduceMotion" ${S.settings.reduceMotion ? 'checked' : ''}></label>
        <label>Ausgabelimit pro Tag (€)<input type="number" min="0" step="10" data-set="limit" value="${S.settings.limit}"></label>
      </div>
      <p class="muted" style="font-size:12px;margin-top:12px">Satire-Prototyp. Kein Produkt der EZB, kein echtes Geld, kein Glücksspielangebot. Motive als Platzhalter mit Motivname und Stückelungsfarbe.</p>
      <div class="button-row"><button class="btn" id="resetBtn">Spielstand zurücksetzen</button><button class="btn primary" data-close>Fertig</button></div>`, (card) => {
      $$('[data-set]', card).forEach((inp) => inp.addEventListener('change', () => {
        const k = inp.dataset.set;
        S.settings[k] = inp.type === 'checkbox' ? inp.checked : Math.max(0, Number(inp.value) || 0);
        save(); render();
      }));
      $('#resetBtn', card).onclick = () => {
        if (!confirm('Wirklich alles zurücksetzen? Sammlung und Guthaben gehen verloren.')) return;
        S = fresh(); save(); closeModal(); render(); toast('Neuer Spielstand. Die EZB vergisst nie – wir schon.');
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  window.EUROPACK = { state: () => S, openPack, buy, closeStage, showTab };
  render();
})();
