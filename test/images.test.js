// Prüft, dass es zu jedem Schein im Katalog ein Kartenbild gibt.
'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

require('../js/data.js');
const D = globalThis.EB_DATA;
const root = path.join(__dirname, '..');

test('Jeder Entwurf hat Vorder- und Rückseite für alle sechs Stückelungen', () => {
  const missing = [];
  for (const d of D.DESIGNS) {
    for (const denom of D.DENOMS) {
      for (const side of ['front', 'back']) {
        const f = path.join(root, D.CARD_IMAGES, d.id, `${denom}_${side}.jpg`);
        if (!fs.existsSync(f)) missing.push(path.relative(root, f));
      }
    }
  }
  assert.deepEqual(missing, []);
});

test('Kartenbilder sind klein genug fürs Handy (< 150 KB)', () => {
  const dir = path.join(root, D.CARD_IMAGES);
  for (const d of fs.readdirSync(dir)) {
    for (const f of fs.readdirSync(path.join(dir, d))) {
      const kb = fs.statSync(path.join(dir, d, f)).size / 1024;
      assert.ok(kb < 150, `${d}/${f}: ${kb.toFixed(0)} KB`);
    }
  }
});

test('Jede Münze hat ein Nationalseiten-Bild', () => {
  const missing = [];
  for (const country of D.COIN_COUNTRIES) {
    for (const value of D.COIN_VALUES) {
      const f = path.join(root, D.COIN_CARD_IMAGES, country.code, `${value}cent_national.jpg`);
      if (!fs.existsSync(f)) missing.push(path.relative(root, f));
    }
  }
  assert.deepEqual(missing, []);
});

test('Münz-Kartenbilder sind klein genug für Handy (< 150 KB)', () => {
  const dir = path.join(root, D.COIN_CARD_IMAGES);
  if (!fs.existsSync(dir)) return; // Skip if directory doesn't exist
  for (const d of fs.readdirSync(dir)) {
    for (const f of fs.readdirSync(path.join(dir, d))) {
      const kb = fs.statSync(path.join(dir, d, f)).size / 1024;
      assert.ok(kb < 150, `${d}/${f}: ${kb.toFixed(0)} KB`);
    }
  }
});
