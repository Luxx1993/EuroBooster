/*
 * EUROPACK – Katalog und Quoten.
 * Alle Zahlen stammen aus docs/konzept.md. Wer Quoten feinjustieren will,
 * ändert nur diese Datei; der Test in test/engine.test.js prüft die Erwartungswerte.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Banknoten-Motive (gleiche sechs Motive je Thema, fünf Stile je Thema)
  // ---------------------------------------------------------------------------
  const DENOMS = [5, 10, 20, 50, 100, 200];

  // Kennfarben je Stückelung (Annahme: Farbcodes der heutigen Serie)
  const DENOM_COLORS = {
    5: '#8E9196',
    10: '#D6463F',
    20: '#3B6FD9',
    50: '#E8892B',
    100: '#3FA45B',
    200: '#C9A24A',
  };

  const MOTIFS = {
    kultur: {
      5: { front: 'Maria Callas', back: 'Darstellende Künste' },
      10: { front: 'Ludwig van Beethoven', back: 'Musik' },
      20: { front: 'Marie Curie', back: 'Schulen und Universitäten' },
      50: { front: 'Miguel de Cervantes', back: 'Bibliotheken' },
      100: { front: 'Leonardo da Vinci', back: 'Museen und Ausstellungen' },
      200: { front: 'Bertha von Suttner', back: 'Öffentliche Plätze' },
    },
    natur: {
      5: { front: 'Mauerläufer an der Bergquelle', back: 'Europäisches Parlament' },
      10: { front: 'Eisvogel am Wasserfall', back: 'Europäische Kommission' },
      20: { front: 'Bienenfresser im Flusstal', back: 'Europäische Zentralbank' },
      50: { front: 'Weißstorch über dem Fluss', back: 'Gerichtshof der EU' },
      100: { front: 'Säbelschnäbler an der Mündung', back: 'Europäischer Rat und Rat der EU' },
      200: { front: 'Basstölpel über dem Meer', back: 'Europäischer Rechnungshof' },
    },
  };

  const DESIGNS = [
    { id: 'A', designer: 'Studio Joost Grootens', theme: 'kultur', style: 'Nahaufnahmen von Augen und Mund' },
    { id: 'B', designer: 'PunktFormStrich', theme: 'natur', style: 'Vogel im Lebensraum, Balken übersetzen den Ruf' },
    { id: 'C', designer: 'Neue Gestaltung GmbH', theme: 'kultur', style: 'Porträt mit kräftiger Kennfarbe, Sternbilder' },
    { id: 'D', designer: 'Rudy Guedj und François Girard-Meunier', theme: 'natur', style: 'Hochformat, abstrakte Landschaften' },
    { id: 'E', designer: 'Myrsini Vardopoulou', theme: 'kultur', style: 'Kreis und Symbole je Person' },
    { id: 'F', designer: 'Jan Robert Dünnweller', theme: 'kultur', style: 'Tusche-Porträts auf Collage' },
    { id: 'G', designer: 'Rubio & del Amo und Cruz más Cruz', theme: 'kultur', style: 'Hochformat, Blöcke ergeben E-U-R-O' },
    { id: 'H', designer: 'Atelier Goppel-Toperngpong', theme: 'natur', style: 'Wasser als Bild für die EU' },
    { id: 'I', designer: 'Isabelle Daëron', theme: 'natur', style: 'Vogel vorne, Schwarm hinten, Flugmaschinen' },
    { id: 'J', designer: 'Ville Tietäväinen', theme: 'natur', style: 'Bildgeschichte von der Quelle zum Meer' },
  ];

  // Digital gibt es keine Druckkosten: Alle zehn Entwürfe sind gültiges Geld.
  // Gewicht = wie oft ein Entwurf im Pack auftaucht. Später z. B. nach dem
  // Ergebnis der EZB-Umfrage setzen (weniger Stimmen = seltener).
  const DESIGN_WEIGHTS = { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1, I: 1, J: 1 };

  // Druckereien: Code -> Ort und Land (Flagge im Stufen-Reveal), Gewicht = Häufigkeit
  const PRINTERS = [
    { code: 'R', name: 'Berlin', country: 'DE', weight: 18 },
    { code: 'W', name: 'Leipzig', country: 'DE', weight: 14 },
    { code: 'E', name: 'Chantepie', country: 'FR', weight: 14 },
    { code: 'U', name: 'Chamalières', country: 'FR', weight: 12 },
    { code: 'S', name: 'Rom', country: 'IT', weight: 12 },
    { code: 'V', name: 'Madrid', country: 'ES', weight: 10 },
    { code: 'P', name: 'Haarlem', country: 'NL', weight: 7 },
    { code: 'N', name: 'Wien', country: 'AT', weight: 5 },
    { code: 'Z', name: 'Brüssel', country: 'BE', weight: 3 },
    { code: 'M', name: 'Carregado', country: 'PT', weight: 2.5 },
    { code: 'Y', name: 'Athen', country: 'GR', weight: 1.5 },
    { code: 'T', name: 'Dublin', country: 'IE', weight: 1 },
  ];

  // ---------------------------------------------------------------------------
  // Booster-Typen
  // ---------------------------------------------------------------------------
  const NOTE_BOOSTER = {
    id: 'schein',
    name: 'Schein-Booster',
    price: 50,
    slots: [
      { label: 'Gewöhnlich', odds: [[5, 0.85], [10, 0.15]] },
      { label: 'Gewöhnlich', odds: [[5, 0.85], [10, 0.15]] },
      { label: 'Gewöhnlich', odds: [[5, 0.85], [10, 0.15]] },
      { label: 'Ungewöhnlich', odds: [[5, 0.4], [10, 0.45], [20, 0.15]] },
      { label: 'Selten (Hit-Slot)', odds: [[10, 0.6], [20, 0.3], [50, 0.07], [100, 0.025], [200, 0.005]] },
    ],
  };

  // Werte in Cent
  const COIN_BOOSTER = {
    id: 'muenze',
    name: 'Münz-Booster',
    price: 3,
    slots: [
      ...Array.from({ length: 8 }, () => ({
        label: 'Kleingeld',
        odds: [[1, 0.3], [2, 0.25], [5, 0.2], [10, 0.15], [20, 0.1]],
      })),
      { label: 'Ungewöhnlich', odds: [[50, 0.5], [100, 0.35], [200, 0.15]] },
      // Hit-Slot: 1 € oder 2 €, immer aus seltenem Land oder als Gedenkmünze
      { label: 'Hit-Slot', odds: [[100, 0.7], [200, 0.3]], hit: true },
    ],
  };

  // ---------------------------------------------------------------------------
  // Münzländer (21 Euro-Länder + 4 Kleinstaaten). Gewicht = Häufigkeit im Pack.
  // ---------------------------------------------------------------------------
  const COIN_COUNTRIES = [
    { code: 'DE', name: 'Deutschland', weight: 20 },
    { code: 'FR', name: 'Frankreich', weight: 15 },
    { code: 'IT', name: 'Italien', weight: 12 },
    { code: 'ES', name: 'Spanien', weight: 11 },
    { code: 'NL', name: 'Niederlande', weight: 6 },
    { code: 'BE', name: 'Belgien', weight: 5 },
    { code: 'AT', name: 'Österreich', weight: 5 },
    { code: 'PT', name: 'Portugal', weight: 4 },
    { code: 'GR', name: 'Griechenland', weight: 4 },
    { code: 'FI', name: 'Finnland', weight: 3 },
    { code: 'IE', name: 'Irland', weight: 3 },
    { code: 'SK', name: 'Slowakei', weight: 2 },
    { code: 'HR', name: 'Kroatien', weight: 2 },
    { code: 'BG', name: 'Bulgarien', weight: 2 }, // seit 1. Januar 2026 im Euroraum
    { code: 'SI', name: 'Slowenien', weight: 1.5 },
    { code: 'LT', name: 'Litauen', weight: 1.5 },
    { code: 'LV', name: 'Lettland', weight: 1.2 },
    { code: 'EE', name: 'Estland', weight: 1 },
    { code: 'LU', name: 'Luxemburg', weight: 1 },
    { code: 'CY', name: 'Zypern', weight: 0.8 },
    { code: 'MT', name: 'Malta', weight: 0.8 },
    { code: 'AD', name: 'Andorra', weight: 0.25, rare: true },
    { code: 'SM', name: 'San Marino', weight: 0.25, rare: true },
    { code: 'MC', name: 'Monaco', weight: 0.2, rare: true },
    { code: 'VA', name: 'Vatikanstadt', weight: 0.1, rare: true },
  ];

  // Länder, die im Hit-Slot als "selten" gelten (kleine Auflagen)
  const HIT_COUNTRIES = ['AD', 'SM', 'MC', 'VA', 'MT', 'CY', 'LU', 'EE'];
  const COMMEMORATIVE_CHANCE = 0.5; // Anteil Gedenkmünzen unter den 2-€-Hits
  const COMMEMORATIVE_YEARS = [2004, 2026]; // von–bis, nur falls js/coins.js fehlt
  // Echte Gedenkmünzen [Land, Jahr, Nummer, Datei], erzeugt mit
  // scripts/build_coin_index.py aus images/coins/commemoratives/.
  const COMMEMORATIVES = (root.EB_COINS && root.EB_COINS.commemoratives) || [];

  const COIN_VALUES = [1, 2, 5, 10, 20, 50, 100, 200];

  // ---------------------------------------------------------------------------
  // Special Editions (Chance je Schein bzw. je Pack)
  // ---------------------------------------------------------------------------
  const EDITIONS = [
    { id: 'holo', name: 'Holo', chance: 0.05 },
    { id: 'glitzer', name: 'Glitzer', chance: 0.03 },
    { id: 'tinte', name: 'Tinte', chance: 0.02 },
    { id: 'gold', name: 'Gold', chance: 0.005 },
    { id: 'alt', name: 'Alternativmotiv', chance: 0.005 },
    { id: 'fehldruck', name: 'Fehldruck', chance: 0.002 },
  ];
  const GOD_PACK_CHANCE = 0.0005; // „Zentralbank-Pack“

  // Seltenheit nach Wert (Glühen)
  const RARITY = {
    5: { id: 'common', name: 'Gewöhnlich', glow: null },
    10: { id: 'common', name: 'Gewöhnlich', glow: null },
    20: { id: 'rare', name: 'Selten', glow: '#4D7CFF' },
    50: { id: 'epic', name: 'Episch', glow: '#A35BFF' },
    100: { id: 'legendary', name: 'Legendär', glow: '#FFC53D' },
    200: { id: 'rainbow', name: 'Regenbogen', glow: 'rainbow' },
  };

  // Chance, dass eine Seriennummer bewusst als Schnapszahl/Leiter/Palindrom
  // erzeugt wird (zusätzlich zu zufälligen Treffern).
  const SPECIAL_SERIAL_CHANCE = 0.01;

  // Kartenbilder im Hochformat, erzeugt mit scripts/build_card_images.py
  // aus den EZB-Gestaltungsvorschlägen in images/designs/.
  const CARD_IMAGES = 'images/cards';

  // Relief-Vorlagen der Münzen für den 3D-Renderer (js/coin3d.js): rund
  // freigestellt mit scripts/build_coin_web.py aus den Originalen in images/coins/
  // (geladen mit scripts/download_ezb_coins.py).
  //   images/coin_web/<Land>/<Cent>.webp, images/coin_web/commemoratives/<Datei>.webp
  const COIN_IMAGES = 'images/coin_web';
  const COIN_IMAGE_SOURCE = 'github.com/lucephile/euro-coin-images';
  const IMAGE_CREDIT = 'Banknoten: © Europäische Zentralbank, Gestaltungsvorschläge für die künftigen Euro-Banknoten (2026); Querformat-Entwürfe für die Karten um 90° gedreht. Münzen: Nationalseiten und Gedenkmünzen der Euro-Länder, Motive der jeweiligen Ausgabeländer; Bilder aus der Sammlung ' + COIN_IMAGE_SOURCE + '. Verwendet im Rahmen redaktioneller Berichterstattung.';

  const STARTING_BALANCE = 500;
  const DAILY_DROP_RANGE = [1, 5]; // Cent

  root.EB_DATA = {
    DENOMS, DENOM_COLORS, MOTIFS, DESIGNS, DESIGN_WEIGHTS, PRINTERS,
    NOTE_BOOSTER, COIN_BOOSTER, COIN_COUNTRIES, HIT_COUNTRIES, COMMEMORATIVE_CHANCE,
    COMMEMORATIVE_YEARS, COMMEMORATIVES, COIN_VALUES, EDITIONS, GOD_PACK_CHANCE, RARITY,
    SPECIAL_SERIAL_CHANCE, STARTING_BALANCE, DAILY_DROP_RANGE, CARD_IMAGES, COIN_IMAGES, COIN_IMAGE_SOURCE, IMAGE_CREDIT,
  };
})(typeof window !== 'undefined' ? window : globalThis);
