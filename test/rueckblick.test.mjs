// Rückblick Woche bis Jahr (Übertragung von ZeitraumTest/RueckblickTest der Android-App).
// Aufruf: TZ=Europe/Berlin node test/rueckblick.test.mjs (rechnet in lokaler Zeit)
import * as R from '../js/rueckblick-logik.js';
import * as T from '../js/training-logik.js';
import * as L from '../js/logik.js';
import assert from 'node:assert/strict';
const ok = (n, f) => { try { f(); console.log('✓', n); } catch (e) { console.log('✗', n, e.stack); process.exitCode = 1; } };
const tag = (j, m, t) => R.tag(j, m - 1, t);
const ms = (j, m, t, h = 0, mi = 0) => new Date(j, m - 1, t, h, mi).getTime();

ok('Zeiträume um einen Tag', () => {
  const d = tag(2026, 11, 19); // Donnerstag
  assert.deepEqual(R.zeitraumUm('WOCHE', d).von, tag(2026, 11, 16));
  assert.deepEqual(R.zeitraumUm('MONAT', d).von, tag(2026, 11, 1));
  assert.deepEqual(R.zeitraumUm('QUARTAL', d).von, tag(2026, 10, 1));
  assert.deepEqual(R.zeitraumUm('HALBJAHR', d).von, tag(2026, 7, 1));
  assert.deepEqual(R.zeitraumUm('JAHR', d).von, tag(2026, 1, 1));
  assert.equal(R.laenge(R.zeitraumUm('QUARTAL', d)), 92);
  assert.equal(R.laenge(R.zeitraumUm('WOCHE', tag(2026, 10, 25))), 7); // über die Zeitumstellung
});

ok('Titel wie Android', () => {
  assert.equal(R.titel(R.zeitraumUm('WOCHE', tag(2026, 11, 12))), 'KW 46 · 9.–15. Nov.');
  assert.equal(R.titel(R.zeitraumUm('WOCHE', tag(2026, 12, 30))), 'KW 53 · 28. Dez.–3. Jan.');
  assert.equal(R.titel(R.zeitraumUm('MONAT', tag(2026, 11, 12))), 'November 2026');
  assert.equal(R.titel(R.zeitraumUm('QUARTAL', tag(2026, 11, 12))), 'Q4 2026 · Okt.–Dez.');
  assert.equal(R.titel(R.zeitraumUm('HALBJAHR', tag(2026, 11, 12))), '2. Halbjahr 2026');
  assert.equal(R.titel(R.zeitraumUm('JAHR', tag(2026, 11, 12))), '2026');
});

ok('Blättern und Start am ersten Tag', () => {
  const z = R.zeitraumUm('MONAT', tag(2026, 1, 15));
  assert.deepEqual(R.vorher(z).von, tag(2025, 12, 1));
  assert.deepEqual(R.verschieben(R.zeitraumUm('QUARTAL', tag(2026, 2, 1)), -2).von, tag(2025, 7, 1));
  assert.equal(R.anfang('WOCHE', tag(2026, 11, 16)), 1);
  assert.equal(R.anfang('WOCHE', tag(2026, 11, 19)), 0);
  assert.equal(R.anfang('JAHR', tag(2026, 1, 1)), 1);
  assert.equal(R.wann('MONAT', 0), 'Diesen Monat');
  assert.equal(R.wann('MONAT', 1), 'Vormonat');
  assert.equal(R.wann('QUARTAL', 3), 'Vor 3 Quartalen');
});

ok('Laufender Zeitraum zählt bis jetzt', () => {
  const z = R.zeitraumUm('WOCHE', tag(2026, 11, 19));
  const jetzt = ms(2026, 11, 19, 10);
  assert.equal(R.tage(z, jetzt), 4);
  const g = R.tagesgrenzen(z, jetzt);
  assert.equal(g.length, 5);
  assert.equal(g[4], jetzt);
  assert.equal(R.tage(R.vorher(z), jetzt), 7);
});

ok('Überschrift, Spruch, Trend', () => {
  const b = (n) => ({ lob: Array(n).fill('x') });
  assert.equal(R.ueberschrift([], 'WOCHE'), 'Noch nichts eingetragen');
  assert.equal(R.ueberschrift([b(3), b(2)], 'WOCHE'), 'Was für eine Woche! 🔥');
  assert.equal(R.ueberschrift([b(6)], 'MONAT'), 'Was für ein Monat! 🔥');
  assert.equal(R.ueberschrift([b(0)], 'JAHR'), 'Weiter geht\'s ✨');
  const z = R.zeitraumUm('WOCHE', tag(2026, 11, 19));
  assert.equal(R.spruch(z), R.spruch(R.zeitraumUm('WOCHE', tag(2026, 11, 22))));
  assert.equal(R.trend(110, 100), 1);
  assert.equal(R.trend(90, 100, 0.05, false), 1);
  assert.equal(R.trend(100, null), 0);
});

// ---------- Food & Boost ----------

const essen = (id, zeit, kcal, eiweiss, extra = {}) => L.eintragObj({ id, zeit, name: 'Essen', menge: 100, naehrwerte: { kcal, eiweiss, kohlenhydrate: 200, fett: 60 }, ...extra });
function foodStand(eintraege) {
  const s = L.neuerStand();
  return { ...s, produkte: [], eintraege, eingerichtet: true, koerper: L.koerper({ gewichtKg: 80, groesseCm: 180, geburtsjahr: 1996, geschlecht: 'MANN' }) };
}

ok('Food: Woche mit Schnitt, Erfolgen und Tipps', () => {
  // Ziel: GU 10·80+6,25·180−5·30+5 = 1780 × 1,5 = 2670 kcal, Eiweiß 1,6 × 80 = 128 g
  const e = [];
  for (let d = 9; d <= 15; d++) e.push(essen('e' + d, ms(2026, 11, d, 12), 2670, 130));
  e.push(L.eintragObj({ id: 'k', zeit: ms(2026, 11, 10, 8), name: 'Kaffee', menge: 200, fluessig: true, koffeinMg: 80 }));
  const z = R.zeitraumUm('WOCHE', tag(2026, 11, 12));
  const b = R.foodBeitrag(foodStand(e), null, z, ms(2026, 11, 19));
  assert.ok(b);
  assert.equal(b.kennzahlen[0].wert, 'Ø 2.670 kcal');
  assert.equal(b.kennzahlen[1].wert, 'Ø 130 g');
  assert.ok(b.lob.includes('📒 An allen 7 Tagen eingetragen – starke Routine!'));
  assert.ok(b.lob.includes('🥩 An 7 Tagen dein Eiweißziel geschafft'));
  assert.ok(b.lob.includes('🎯 An 7 Tagen genau im Kalorienziel'));
  assert.ok(b.lob.includes('🍃 Die ganze Woche ohne Alkohol'));
  assert.ok(b.lob.includes('☕ Koffein jeden Tag im grünen Bereich'));
  assert.ok(b.kurz.startsWith('Ø 2.670 kcal · 130 g Eiweiß'));
});

ok('Food: leer gibt keinen Beitrag, wenig Tage einen Tipp', () => {
  const z = R.zeitraumUm('WOCHE', tag(2026, 11, 12));
  assert.equal(R.foodBeitrag(foodStand([]), null, z, ms(2026, 11, 19)), null);
  const b = R.foodBeitrag(foodStand([essen('a', ms(2026, 11, 9, 12), 1000, 40)]), null, z, ms(2026, 11, 19));
  assert.ok(b.tipps.some((t) => t.startsWith('Nur an 1 Tag eingetragen')));
  assert.ok(b.tipps.some((t) => t.startsWith('Eiweiß im Schnitt')));
});

ok('Food: Monat zählt Alkohol und Vergleich', () => {
  const e = [essen('a', ms(2026, 10, 3, 12), 2500, 100), essen('b', ms(2026, 11, 3, 12), 2500, 140),
    L.eintragObj({ id: 'bier', zeit: ms(2026, 11, 3, 20), name: 'Bier', menge: 500, fluessig: true, alkoholG: 20 })];
  const z = R.zeitraumUm('MONAT', tag(2026, 11, 1));
  const b = R.foodBeitrag(foodStand(e), null, z, ms(2026, 12, 1));
  const alk = b.kennzahlen.find((k) => k.name === 'Alkohol');
  assert.equal(alk.wert, '2 Gläser');
  assert.ok(b.lob.some((t) => t.includes('mehr Eiweiß am Tag als im Vormonat')));
  assert.ok(b.lob.includes('🍃 29 alkoholfreie Tage'));
});

// ---------- Training ----------

const S = (gewicht, wdh, o = {}) => T.satz({ gewicht, wdh, erledigt: true, ...o });
const training = (id, start, uebung, ...saetze) => T.workout({ id, start, dauerSek: 3600, bloecke: [{ uebungId: uebung, saetze }] });

ok('Training: Woche mit mehr Trainings und Bestwert', () => {
  const s = { ...T.neuerStand(), workouts: [
    training('v', ms(2026, 11, 3, 18), 'bankdruecken-lh', S(80, 8), S(80, 8)),
    training('a', ms(2026, 11, 9, 18), 'bankdruecken-lh', S(85, 8), S(85, 8)),
    training('b', ms(2026, 11, 11, 18), 'kniebeuge-lh', S(100, 5)),
    training('c', ms(2026, 11, 13, 18), 'bankdruecken-lh', S(82, 8)),
  ] };
  const z = R.zeitraumUm('WOCHE', tag(2026, 11, 12));
  const b = R.trainingBeitrag(s, z, ms(2026, 11, 19), 80);
  assert.equal(b.kennzahlen[0].wert, '3');
  assert.equal(b.kennzahlen[0].trend, 1);
  assert.ok(b.lob.includes('🏋 3 Trainings – 2 mehr als letzte Woche'), b.lob.join('|'));
  assert.ok(b.lob.some((t) => t.startsWith('🏆 Neue Bestwerte: Bankdrücken')), b.lob.join('|'));
  assert.ok(b.lob.includes('🔥 2 Wochen in Folge trainiert'));
  assert.ok(b.tipps.some((t) => t.startsWith('Ausdauer 0 von 150 min')));
  assert.equal(b.kurz, '3 Trainings · 1 🏆');
});

ok('Training: nichts los gibt keinen Beitrag', () => {
  const z = R.zeitraumUm('WOCHE', tag(2026, 11, 12));
  assert.equal(R.trainingBeitrag(T.neuerStand(), z, ms(2026, 11, 19), 80), null);
});

ok('Training: Monat mit Ausdauer und Wochen', () => {
  const w = [];
  for (let d = 2; d <= 30; d += 7) {
    w.push(training('k' + d, ms(2026, 11, d, 18), 'bankdruecken-lh', S(80, 8)));
    w.push(T.Cardio.eintrag('c' + d, T.katalogNachId.radfahren, ms(2026, 11, d + 1, 7), 160, 0, 'MODERAT'));
  }
  const s = { ...T.neuerStand(), workouts: w };
  const z = R.zeitraumUm('MONAT', tag(2026, 11, 1));
  const b = R.trainingBeitrag(s, z, ms(2026, 12, 1), 80);
  assert.ok(b.lob.some((t) => t.startsWith('🫀 Ausdauerziel (WHO) in 4 von 4 Wochen')), b.lob.join('|'));
  assert.ok(b.lob.some((t) => t.startsWith('🔥 In 4 von 4 Wochen trainiert')), b.lob.join('|'));
  const tr = b.kennzahlen.find((k) => k.name === 'Trainings');
  assert.ok(tr.unter.includes('Ø 1,2 je Woche'), tr.unter);
});

ok('Beiträge zusammen, Training zuerst', () => {
  const f = foodStand([essen('a', ms(2026, 11, 10, 12), 2000, 100)]);
  const t = { ...T.neuerStand(), workouts: [training('a', ms(2026, 11, 10, 18), 'bankdruecken-lh', S(80, 8))] };
  const b = R.beitraege(f, t, R.zeitraumUm('WOCHE', tag(2026, 11, 12)), ms(2026, 11, 19));
  assert.deepEqual(b.map((x) => x.titel), ['Training', 'Food & Boost']);
});
