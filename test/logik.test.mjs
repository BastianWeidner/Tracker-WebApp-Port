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

// ---------- Einnahmeplan: Wissen und Plan-Vorlagen (aus BoostTest.kt) ----------
const boostP = (name, gramm, portionName, kategorie, o = {}) => {
  const f = 100 / gramm;
  return L.produkt({ id: name, name, portion: gramm, portionName, kategorie, koffeinMgPro100: (o.koffein || 0) * f, plan: o.plan || [], planMenge: o.planMenge || 0, kurWochen: o.kur || 0,
    naehrwerte: { mikros: Object.fromEntries(Object.entries(o.mikros || {}).map(([k, v]) => [k, v * f])) } });
};
ok('Neutraler Start ohne persönliche Daten', () => {
  const s = L.neuerStand();
  assert.deepEqual(s.koerper, { gewichtKg: 75, groesseCm: 178, geburtsjahr: 1995, geschlecht: 'MANN', kfaProzent: 18 });
  assert(s.produkte.every((p) => !p.plan.length && !L.istBoost(p.kategorie)));
});
ok('Plan prüfen: Höchstmengen und Wechselwirkungen', () => {
  const mg = boostP('Magnesium', 1, 'Kapsel', 'SUPPLEMENT', { mikros: { magnesium: 150 }, plan: ['MORGENS', 'ABENDS'] });
  const zink = boostP('Zink', 0.5, 'Kapsel', 'SUPPLEMENT', { mikros: { zink: 25 }, plan: ['TAGSUEBER'] });
  assert.deepEqual(L.Wissen.planPruefen([mg, zink]).filter((h) => h.ernst).map((h) => h.text.includes('Magnesium')), [true]);
  const htp = boostP('5-HTP', 0.3, 'Kapsel', 'SUPPLEMENT', { mikros: { w_htp: 50 }, plan: ['ABENDS'] });
  const tryp = boostP('Tryptophan', 1, '', 'SUPPLEMENT', { mikros: { w_tryptophan: 1000 }, plan: ['ABENDS'], planMenge: 1 });
  assert(L.Wissen.planPruefen([htp, tryp]).some((h) => h.ernst && h.text.includes('5-HTP und L-Tryptophan')));
  const guarana = boostP('Guarana', 1.2, 'Kapsel', 'BOOSTER', { koffein: 100, plan: ['ABENDS'], planMenge: 3 * 1.2 });
  const g = L.Wissen.planPruefen([guarana]);
  assert(g.some((h) => h.text.includes('abends')));
  assert(g.some((h) => h.text.includes('mehr als 200 mg pro Einnahme')));
  const d3 = boostP('D3', 0.3, 'Softgel', 'SUPPLEMENT', { mikros: { vitD: 62.5 }, plan: ['MORGENS', 'ABENDS'] });
  assert(L.Wissen.planPruefen([d3]).some((h) => h.ernst && h.text.includes('Vitamin D')));
  const ca = boostP('Calcium', 1, 'Tablette', 'SUPPLEMENT', { mikros: { calcium: 500 }, plan: ['MORGENS'] });
  assert(L.Wissen.planPruefen([zink, ca]).some((h) => !h.ernst && h.text.includes('Zink und Calcium')));
  const daa = boostP('DAA', 1, '', 'SUPPLEMENT', { mikros: { w_daa: 1 }, plan: ['ABENDS'], planMenge: 3 });
  const t = L.Wissen.produktTipps(daa, []);
  assert(t.some((h) => h.text.includes('Kur') && !h.ernst));
  assert(!t.some((h) => h.text.includes('passt eher')));
  assert(L.Wissen.produktTipps({ ...daa, plan: ['MORGENS'] }, []).some((h) => h.text.includes('passt eher zu: Abends')));
  assert(L.Wirkstoffe.every((m) => L.Wissen.info(m.key)));
});
ok('Plan-Vorlagen', () => {
  const V = L.PlanVorlagen;
  const kreatin = V.find((v) => v.keys.join() === 'w_kreatin').produkt;
  assert(Math.abs(L.eintragAus(kreatin, 'k', 0, L.einnahme(kreatin)).naehrwerte.mikros.w_kreatin - 5) < 1e-9);
  const carnitin = V.find((v) => v.keys.join() === 'w_carnitin').produkt;
  assert(Math.abs(L.eintragAus(carnitin, 'c', 0, L.einnahme(carnitin)).naehrwerte.mikros.w_carnitin - 1500) < 1e-9);
  assert.equal(V.find((v) => v.keys.join() === 'w_daa').produkt.kurWochen, 6);
  const koffein = V.find((v) => v.name.startsWith('Koffein')).produkt;
  assert(Math.abs(L.eintragAus(koffein, 't', 0, koffein.portion).koffeinMg - 200) < 1e-9);
  assert(V.every((v) => v.produkt.id === '' && L.istBoost(v.produkt.kategorie)));
});
ok('Warnungen des Tages: Höchstmengen aus dem Wissen', () => {
  let s = L.neuerStand();
  const mg = boostP('Magnesium', 1, 'Kapsel', 'SUPPLEMENT', { mikros: { magnesium: 150 } });
  const t0 = Date.UTC(2026, 10, 4, 8);
  s = L.S.eintragen(s, L.eintragAus(mg, 'a', t0, 1));
  s = L.S.eintragen(s, L.eintragAus(mg, 'b', t0 + L.STUNDE, 1));
  const tb = (z) => z - (z % L.TAG);
  const w = L.Boost.warnungen(s, tb(t0), tb(t0) + L.TAG, tb);
  assert(w.some((x) => x.startsWith('Magnesium heute 300 mg')), w.join('|'));
});
ok('Vitamine oben, danach der Rest alphabetisch (wie Android)', () => {
  const namen = L.Mikros.sortiert(L.Mikros.vitamineUndMineralien).map((m) => m.name);
  assert.deepEqual(namen.slice(0, 13), ['Vitamin A', 'Vitamin B1', 'Vitamin B2', 'Niacin', 'Pantothensäure', 'Vitamin B6',
    'Biotin', 'Folat', 'Vitamin B12', 'Vitamin C', 'Vitamin D', 'Vitamin E', 'Vitamin K']);
  const rest = namen.slice(13);
  assert.equal(rest[0], 'Calcium');
  assert.deepEqual([...rest].sort(new Intl.Collator('de').compare), rest);
  assert.deepEqual(['zink', 'unbekannt', 'vitA', 'calcium', 'folat'].sort(L.Mikros.alphabetischNachKey), ['vitA', 'folat', 'calcium', 'zink', 'unbekannt']);
});
ok('Vegane Produkte aus Europa in der Datenbank', () => {
  const info = JSON.parse(readFileSync('daten/naehrwerte/info.json'));
  assert(info.anzahl > 300000, info.anzahl);
  for (const [code, name] of [['7613287344816', 'Wunda original'], ['4260402488028', 'Soja-Schnetzel']]) {
    const teil = gunzipSync(readFileSync(`daten/naehrwerte/${String(L.dbTeil(code)).padStart(2, '0')}.tsv.gz`)).toString();
    const n = BigInt(code).toString();
    const zeile = teil.split('\n').find((z) => z.startsWith(n + '\t'));
    assert(zeile, code);
    assert.equal(L.dbLesen(code, zeile.slice(n.length + 1)).name, name);
  }
});
