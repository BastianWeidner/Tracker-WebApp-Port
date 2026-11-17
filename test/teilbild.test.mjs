// Teilen-Bild (Logik). Aufruf: node test/teilbild.test.mjs — gleiche Fälle wie TeilbildTest.kt der Android-App.
import * as T from '../js/teilbild.js';
import assert from 'node:assert/strict';
const ok = (n, f) => { try { f(); console.log('✓', n); } catch (e) { console.log('✗', n, e.stack); process.exitCode = 1; } };
const n = { kcal: 2450.4, eiweiss: 181.6, kohlenhydrate: 250, fett: 70.2 };

ok('ohne Fett nur kcal, Protein, Carbs', () => {
  const i = T.inhalt('Heute', n, false);
  assert.equal(i.kcal.zahl, '2.450');
  assert.deepEqual(i.makros.map((m) => m.name), ['Protein', 'Carbs']);
  assert.deepEqual(i.makros.map((m) => m.zahl), ['182', '250']);
  assert.equal(i.fusszeile, 'Food & Boost');
  assert.equal(i.signatur, 'by BW');
});

ok('mit Fett und Ziel', () => {
  const i = T.inhalt('  ', n, true, { kcal: 2900, eiweiss: 164, kohlenhydrate: 340, fett: 97 });
  assert.equal(i.titel, 'Heute');
  assert.equal(i.kcal.zahl, '2.450 / 2.900');
  assert.deepEqual(i.makros.map((m) => m.zahl), ['182 / 164', '250 / 340', '70 / 97']);
});

ok('Tausender und Dateiname', () => {
  assert.equal(T.tausender(0.2), '0');
  assert.equal(T.tausender(12345), '12.345');
  assert.equal(T.tausender(999), '999');
  assert.equal(T.dateiname('Haferflocken mit Whey!'), 'food-boost-haferflocken-mit-whey.png');
  assert.equal(T.dateiname('Müsli'), 'food-boost-muesli.png');
});
