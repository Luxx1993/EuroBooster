/*
 * EUROPACK – Zufall und Pack-Logik. Keine DOM-Zugriffe, damit sie in Node
 * testbar bleibt. Reihenfolge laut Konzept: Slot würfeln, dann Edition,
 * dann Seriennummer; seltene Nummern werden beim Erzeugen erkannt.
 */
(function (root) {
  'use strict';
  const D = root.EB_DATA;

  function pickWeighted(rng, pairs) {
    // pairs: [[value, weight], ...]
    let total = 0;
    for (const [, w] of pairs) total += w;
    let r = rng() * total;
    for (const [v, w] of pairs) {
      r -= w;
      if (r < 0) return v;
    }
    return pairs[pairs.length - 1][0];
  }

  function randInt(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  }

  // ---------------------------------------------------------------------------
  // Seriennummern
  // ---------------------------------------------------------------------------
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function makeDigits(rng) {
    if (rng() < D.SPECIAL_SERIAL_CHANCE) {
      const kind = randInt(rng, 0, 3);
      if (kind === 0) return String(randInt(rng, 1, 9)).repeat(10); // Schnapszahl
      if (kind === 1) {
        const start = randInt(rng, 0, 9);
        let s = '';
        for (let i = 0; i < 10; i++) s += (start + i) % 10;
        return s; // Leiter
      }
      if (kind === 2) {
        let half = '';
        for (let i = 0; i < 5; i++) half += randInt(rng, 0, 9);
        return half + half.split('').reverse().join(''); // Palindrom
      }
      return String(randInt(rng, 1000, 9999)) + '777777'; // Glückssträhne
    }
    let s = '';
    for (let i = 0; i < 10; i++) s += randInt(rng, 0, 9);
    return s;
  }

  function classifySerial(digits) {
    if (/^(\d)\1+$/.test(digits)) return 'Schnapszahl';
    const asc = '01234567890123456789';
    const desc = '98765432109876543210';
    if (asc.includes(digits) || desc.includes(digits)) return 'Leiter';
    if (digits === digits.split('').reverse().join('')) return 'Palindrom';
    if (/(\d)\1{5,}/.test(digits)) return 'Glückssträhne';
    return null;
  }

  function makeSerial(rng, printerCode) {
    const digits = makeDigits(rng);
    const serial = printerCode + LETTERS[randInt(rng, 0, 25)] + digits;
    return { serial, rareSerial: classifySerial(digits) };
  }

  // ---------------------------------------------------------------------------
  // Editionen
  // ---------------------------------------------------------------------------
  function rollEdition(rng, force) {
    if (force) {
      return pickWeighted(rng, D.EDITIONS.map((e) => [e.id, e.chance]));
    }
    let r = rng();
    for (const e of D.EDITIONS) {
      r -= e.chance;
      if (r < 0) return e.id;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Schein-Booster
  // ---------------------------------------------------------------------------
  function makeNote(rng, denom, godPack) {
    const printer = pickWeighted(rng, D.PRINTERS.map((p) => [p, p.weight]));
    const design = D.DESIGNS.find((d) => d.id === D.WINNER_DESIGN);
    const { serial, rareSerial } = makeSerial(rng, printer.code);
    return {
      kind: 'note',
      id: noteId(D.WINNER_DESIGN, denom),
      denom,
      design: design.id,
      theme: design.theme,
      motif: D.MOTIFS[design.theme][denom],
      edition: rollEdition(rng, godPack),
      serial,
      rareSerial,
      printer: printer.code,
      printerName: printer.name,
      country: printer.country,
      isReal: true,
    };
  }

  function makePrototype(rng, godPack, fixed) {
    const protos = D.DESIGNS.filter((d) => d.id !== D.WINNER_DESIGN);
    const design = fixed ? D.DESIGNS.find((d) => d.id === fixed.design)
      : pickWeighted(rng, protos.map((d) => [d, D.PROTOTYPE_WEIGHTS[d.id] || 1]));
    const denom = fixed ? fixed.denom : D.DENOMS[randInt(rng, 0, D.DENOMS.length - 1)];
    return {
      kind: 'proto',
      id: noteId(design.id, denom),
      denom,
      design: design.id,
      theme: design.theme,
      motif: D.MOTIFS[design.theme][denom],
      edition: rollEdition(rng, godPack),
      serial: 'PROTO-' + design.id + '-' + String(randInt(rng, 0, 99999)).padStart(5, '0'),
      rareSerial: null,
      isReal: false,
    };
  }

  function openNotePack(rng) {
    rng = rng || Math.random;
    const godPack = rng() < D.GOD_PACK_CHANCE;
    const items = D.NOTE_BOOSTER.slots.map((slot, i) => {
      const note = makeNote(rng, pickWeighted(rng, slot.odds), godPack);
      note.slot = i + 1;
      note.hit = i === D.NOTE_BOOSTER.slots.length - 1;
      return note;
    });
    const bonus = D.NOTE_BOOSTER.prototypeBonus ? makePrototype(rng, godPack) : null;
    const value = items.reduce((s, n) => s + n.denom, 0);
    return { type: 'schein', price: D.NOTE_BOOSTER.price, items, bonus, value, godPack };
  }

  // ---------------------------------------------------------------------------
  // Münz-Booster (Werte in Cent)
  // ---------------------------------------------------------------------------
  function makeCoin(rng, cents, hit) {
    let country;
    let commemorative = null;
    if (hit && cents === 200 && rng() < D.COMMEMORATIVE_CHANCE) {
      // Gedenkmünzen gibt es nur als 2 €, aus jedem Land
      country = pickWeighted(rng, D.COIN_COUNTRIES.map((c) => [c, c.weight]));
      commemorative = randInt(rng, D.COMMEMORATIVE_YEARS[0], D.COMMEMORATIVE_YEARS[1]);
    } else if (hit) {
      const pool = D.COIN_COUNTRIES.filter((c) => D.HIT_COUNTRIES.includes(c.code));
      country = pickWeighted(rng, pool.map((c) => [c, c.weight]));
    } else {
      country = pickWeighted(rng, D.COIN_COUNTRIES.map((c) => [c, c.weight]));
    }
    return {
      kind: 'coin',
      id: commemorative ? gedenkId(country.code, commemorative) : coinId(country.code, cents),
      cents,
      country: country.code,
      countryName: country.name,
      rareCountry: !!country.rare,
      commemorative,
      edition: null,
      hit: !!hit,
    };
  }

  function openCoinPack(rng) {
    rng = rng || Math.random;
    const items = D.COIN_BOOSTER.slots.map((slot, i) => {
      const coin = makeCoin(rng, pickWeighted(rng, slot.odds), slot.hit);
      coin.slot = i + 1;
      return coin;
    });
    const value = items.reduce((s, c) => s + c.cents, 0) / 100;
    return { type: 'muenze', price: D.COIN_BOOSTER.price, items, bonus: null, value, godPack: false };
  }

  // ---------------------------------------------------------------------------
  // Tausch: 1:1 zum gleichen Nennwert – weil es ja Geld ist.
  // Bevorzugt wird angeboten, was dem Nutzer noch fehlt.
  // ---------------------------------------------------------------------------
  function makeTradeOffer(rng, item, ownedIds) {
    rng = rng || Math.random;
    const owned = ownedIds || new Set();
    const pick = (arr) => arr[randInt(rng, 0, arr.length - 1)];
    if (item.kind === 'note') {
      // Gleiche Stückelung, andere Druckerei und Seriennummer, vielleicht eine Edition
      return makeNote(rng, item.denom, false);
    }
    if (item.kind === 'proto') {
      const all = [];
      for (const d of D.DESIGNS) {
        if (d.id === D.WINNER_DESIGN) continue;
        for (const denom of D.DENOMS) all.push({ design: d.id, denom });
      }
      const others = all.filter((x) => noteId(x.design, x.denom) !== item.id);
      const missing = others.filter((x) => !owned.has(noteId(x.design, x.denom)));
      return makePrototype(rng, false, pick(missing.length ? missing : others));
    }
    // Münzen: gleicher Wert aus einem anderen Land
    const pool = D.COIN_COUNTRIES.filter((c) => c.code !== item.country);
    if (item.commemorative) {
      const year = randInt(rng, D.COMMEMORATIVE_YEARS[0], D.COMMEMORATIVE_YEARS[1]);
      const missing = pool.filter((c) => !owned.has(gedenkId(c.code, year)));
      const c = pickWeighted(rng, (missing.length ? missing : pool).map((x) => [x, x.weight]));
      return { kind: 'coin', id: gedenkId(c.code, year), cents: 200, country: c.code, countryName: c.name, rareCountry: !!c.rare, commemorative: year, edition: null };
    }
    const missing = pool.filter((c) => !owned.has(coinId(c.code, item.cents)));
    const c = pickWeighted(rng, (missing.length ? missing : pool).map((x) => [x, x.weight]));
    return { kind: 'coin', id: coinId(c.code, item.cents), cents: item.cents, country: c.code, countryName: c.name, rareCountry: !!c.rare, commemorative: null, edition: null };
  }

  // ---------------------------------------------------------------------------
  // IDs und Katalog
  // ---------------------------------------------------------------------------
  function noteId(design, denom) { return 'N-' + design + '-' + denom; }
  function coinId(country, cents) { return 'C-' + country + '-' + cents; }
  function gedenkId(country, year) { return 'G-' + country + '-' + year; }

  // ---------------------------------------------------------------------------
  // Exakte Verteilung des Packwerts (Slots unabhängig)
  // ---------------------------------------------------------------------------
  function valueDistribution(booster) {
    let dist = new Map([[0, 1]]);
    for (const slot of booster.slots) {
      const next = new Map();
      for (const [v, p] of dist) {
        for (const [x, q] of slot.odds) {
          next.set(v + x, (next.get(v + x) || 0) + p * q);
        }
      }
      dist = next;
    }
    return [...dist.entries()].sort((a, b) => a[0] - b[0]);
  }

  function expectedValue(booster) {
    return valueDistribution(booster).reduce((s, [v, p]) => s + v * p, 0);
  }

  function probAtLeast(booster, min) {
    return valueDistribution(booster).filter(([v]) => v >= min).reduce((s, [, p]) => s + p, 0);
  }

  function median(booster) {
    let acc = 0;
    for (const [v, p] of valueDistribution(booster)) {
      acc += p;
      if (acc >= 0.5) return v;
    }
    return null;
  }

  // Deterministischer Zufall für Tests (mulberry32)
  function seeded(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  root.EB = {
    pickWeighted, classifySerial, makeSerial, rollEdition,
    openNotePack, openCoinPack, makeTradeOffer,
    noteId, coinId, gedenkId,
    valueDistribution, expectedValue, probAtLeast, median, seeded,
  };
})(typeof window !== 'undefined' ? window : globalThis);
