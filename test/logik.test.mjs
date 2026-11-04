import * as L from '../js/logik.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const ok = (n, f) => { try { f(); console.log('✓', n); } catch (e) { console.log('✗', n, e.message); process.exitCode = 1; } };
const k = L.koerper({ gewichtKg: 82, groesseCm: 194, geburtsjahr: 2003 });
const e = L.einstellungen();
ok('Watson wie Android (≈48,7 l, r≈0,78)', () => {
  const w = L.Pegel.koerperwasser(k, e, 2026); assert(Math.abs(w - 48.7) < 0.2, w);
  assert(Math.abs(L.Pegel.rFaktor(k, e, 2026) - 0.78) < 0.01);
});
ok('Bier-Verlauf steigt und sinkt', () => {
  let s = { ...L.neuerStand(), koerper: k };
  const t0 = Date.UTC(2026, 10, 4, 20);
  const bier = s.produkte.find(p => p.id === 'bier05');
  s = L.S.eintragen(s, L.eintragAus(bier, 'a', t0, 500));
  const lage = L.Pegel.lage(s, t0 + 30 * L.MINUTE, 2026);
  assert(lage.promille > 0.1 && lage.promilleSpitze > lage.promille && lage.nuechternUm > t0);
  const kof = L.Pegel.lage(L.S.eintragen(s, L.eintragAus(s.produkte.find(p => p.id === 'kaffee'), 'b', t0, 200)), t0 + 5 * L.STUNDE + 45 * L.MINUTE, 2026);
  assert(Math.abs(kof.koffeinMg - 45) < 3, kof.koffeinMg);
});
ok('Format', () => {
  assert.equal(L.Format.zahl(3.14159, 2), '3,14'); assert.equal(L.Format.wert(12345), '12,35 × 10³'); assert.equal(L.Format.promille(0.256), '0,26 ‰');
});
ok('Nährwerttabelle', () => {
  const r = L.Naehrwerttabelle.lesen(['Nährwerte pro 100 g', 'Brennwert 1046 kJ / 250 kcal', 'Fett 9,0 g', 'davon gesättigte Fettsäuren 3,1 g', 'Kohlenhydrate 30 g', 'davon Zucker 12 g', 'Eiweiß 8,5 g', 'Salz 0,9 g', 'Vitamin C 12 mg']);
  assert.equal(r.naehrwerte.kcal, 250); assert.equal(r.naehrwerte.fett, 9); assert.equal(r.naehrwerte.gesaettigt, 3.1); assert.equal(r.naehrwerte.zucker, 12); assert.equal(r.naehrwerte.eiweiss, 8.5); assert.equal(r.naehrwerte.mikros.vitC, 12); assert.equal(r.fluessig, false);
});
ok('Zutaten', () => {
  const z = L.Zutaten.lesen('1 ½ TL Salz'); assert.equal(z.menge, 1.5); assert.equal(z.einheit, 'TEELOEFFEL'); assert.equal(z.text, 'Salz');
  assert.equal(L.Zutaten.lesen('2-3 Zwiebeln, gewürfelt').menge, 2.5); assert.equal(L.Zutaten.portionen(['Zutaten für 4 Portionen']), 4);
});
const bls = L.lebensmittelLesen(gunzipSync(readFileSync('daten/lebensmittel.tsv.gz')).toString());
const zu = new L.Zuordnung(bls.lebensmittel);
ok('BLS-Zuordnung: ' + bls.lebensmittel.length, () => {
  const f = zu.freitext('Döner mit Pommes und eine Cola');
  console.log('   ', f.map(z => `${z.zutat.text} → ${z.lebensmittel?.name} ${Math.round(z.gramm)} g`).join(' | '));
  assert.equal(f.length, 3); assert(f.every(z => z.lebensmittel));
  const r = zu.rezept(['250 g Mehl', '3 Eier', '500 ml Milch']);
  console.log('   ', r.map(z => `${z.zutat.text} → ${z.lebensmittel?.name} ${Math.round(z.gramm)} g`).join(' | '));
});
ok('DB-Teil lesen', () => {
  const code = '4000417025005';
  const teil = gunzipSync(readFileSync(`daten/naehrwerte/${String(L.dbTeil(code)).padStart(2,'0')}.tsv.gz`)).toString();
  const n = BigInt(code).toString();
  const zeile = teil.split('\n').find(z => z.startsWith(n + '\t'));
  if (!zeile) { console.log('    (Code nicht drin)'); return; }
  const d = L.dbLesen(code, zeile.slice(n.length + 1)); console.log('   ', L.dbAnzeige(d), d.naehrwerte.kcal, 'kcal');
});
ok('Android-Sicherung lesbar', () => {
  const s = L.standLesen(JSON.parse(JSON.stringify(L.neuerStand()))); assert(s.produkte.length > 20);
});
ok('Boost-Plan', () => {
  let s = L.neuerStand(); const p = { ...L.Vorlagen.find(v => v.produkt.id === 'v_kreatin').produkt, plan: ['NACH_TRAINING', 'MORGENS'] };
  s = L.S.speichern(s, p); const t = Date.now();
  s = L.S.eintragen(s, L.eintragAus(p, 'x', t, 5));
  const pl = L.Boost.plan(s, t - 1000, t + 1000); assert.equal(pl.length, 2); assert.equal(pl[0].zeitpunkt, 'MORGENS'); assert(pl[0].erledigt);
});
