// Prüft die Quoten gegen die Zahlen in docs/konzept.md.
// Ausführen: node test/engine.test.js
'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');

require('../js/data.js');
require('../js/engine.js');
const D = globalThis.EB_DATA;
const EB = globalThis.EB;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} != ${b} ± ${tol}`);

test('Slot-Quoten summieren sich zu 100 %', () => {
  for (const b of [D.NOTE_BOOSTER, D.COIN_BOOSTER]) {
    for (const slot of b.slots) {
      near(slot.odds.reduce((s, [, p]) => s + p, 0), 1, 1e-9, b.name);
    }
  }
});

test('Schein-Booster: Erwartungswert 45,75 €, Median 40 €', () => {
  near(EB.expectedValue(D.NOTE_BOOSTER), 45.75, 1e-9, 'EV');
  assert.equal(EB.median(D.NOTE_BOOSTER), 40);
});

test('Schein-Booster: Wahrscheinlichkeiten aus der Tabelle', () => {
  const dist = EB.valueDistribution(D.NOTE_BOOSTER);
  const p3035 = dist.filter(([v]) => v >= 30 && v <= 35).reduce((s, [, p]) => s + p, 0);
  near(p3035, 0.39, 0.005, '30–35 €');
  near(EB.probAtLeast(D.NOTE_BOOSTER, 50), 0.24, 0.005, '≥ 50 €');
  near(EB.probAtLeast(D.NOTE_BOOSTER, 75), 0.083, 0.0005, '≥ 75 €');
  near(EB.probAtLeast(D.NOTE_BOOSTER, 100), 0.030, 0.0005, '≥ 100 €');
  near(EB.probAtLeast(D.NOTE_BOOSTER, 200), 0.005, 1e-9, '≥ 200 €');
  assert.equal(dist[0][0], 30, 'Minimum 30 €');
  assert.equal(dist[dist.length - 1][0], 250, 'Maximum 250 €');
});

test('Münz-Booster: Nennwert im Schnitt etwa 2,62 € (≈ 87 %)', () => {
  const ev = EB.expectedValue(D.COIN_BOOSTER) / 100;
  near(ev, 2.62, 0.01, 'EV');
  near(ev / D.COIN_BOOSTER.price, 0.87, 0.01, 'Quote');
});

test('Simulation stimmt mit exakter Rechnung überein', () => {
  const rng = EB.seeded(42);
  const n = 50000;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += EB.openNotePack(rng).value;
  near(sum / n, 45.75, 0.4, 'simulierter EV');
});

test('Pack-Aufbau: 5 Scheine + Prototyp, 10 Münzen', () => {
  const rng = EB.seeded(7);
  const p = EB.openNotePack(rng);
  assert.equal(p.items.length, 5);
  assert.ok(p.items[4].hit);
  assert.equal(p.bonus.kind, 'proto');
  assert.notEqual(p.bonus.design, D.WINNER_DESIGN);
  const c = EB.openCoinPack(rng);
  assert.equal(c.items.length, 10);
  assert.ok([100, 200].includes(c.items[9].cents));
});

test('Seriennummern werden erkannt', () => {
  assert.equal(EB.classifySerial('7777777777'), 'Schnapszahl');
  assert.equal(EB.classifySerial('3456789012'), 'Leiter');
  assert.equal(EB.classifySerial('9876543210'), 'Leiter');
  assert.equal(EB.classifySerial('1234554321'), 'Palindrom');
  assert.equal(EB.classifySerial('1234777777'), 'Glückssträhne');
  assert.equal(EB.classifySerial('1029384756'), null);
});

test('Editionen: rund 11,2 % Special Editions je Schein', () => {
  const rng = EB.seeded(1);
  const n = 200000;
  let hits = 0;
  for (let i = 0; i < n; i++) if (EB.rollEdition(rng)) hits++;
  near(hits / n, 0.112, 0.003, 'Anteil');
});

test('Tausch: immer 1:1 zum gleichen Nennwert', () => {
  const rng = EB.seeded(3);
  for (let i = 0; i < 300; i++) {
    const p = EB.openNotePack(rng);
    const c = EB.openCoinPack(rng);
    for (const it of [...p.items, p.bonus, ...c.items]) {
      const o = EB.makeTradeOffer(rng, it, new Set());
      assert.equal(o.kind, it.kind);
      if (it.kind === 'note') assert.equal(o.denom, it.denom);
      if (it.kind === 'coin') assert.equal(o.cents, it.cents);
      if (it.kind !== 'note') assert.notEqual(o.id, it.id, 'Prototypen und Münzen: anderes Stück');
    }
  }
});

test('Tausch: bevorzugt fehlende Stücke', () => {
  const rng = EB.seeded(9);
  const coin = { kind: 'coin', id: EB.coinId('DE', 100), cents: 100, country: 'DE' };
  const owned = new Set(D.COIN_COUNTRIES.filter((c) => c.code !== 'VA').map((c) => EB.coinId(c.code, 100)));
  for (let i = 0; i < 20; i++) assert.equal(EB.makeTradeOffer(rng, coin, owned).country, 'VA');
});
