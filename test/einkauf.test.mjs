import * as E from '../js/einkauf-logik.js';
import * as L from '../js/logik.js';
import { Nachkauf } from '../js/einkauf-logik.js';
import assert from 'node:assert/strict';
const ok = (n, f) => { try { f(); console.log('✓', n); } catch (e) { console.log('✗', n, e.message); process.exitCode = 1; } };
const TAG = 86_400_000;
const jetzt = 1_800_000_000_000;
const verbrauch = (name, menge, n, tage = 14, portion = menge, fluessig = true, packung = '') =>
  ({ name, ean: '', fluessig, portion, packung, eintraege: Array.from({ length: n }, (_, i) => [jetzt - Math.floor(i * tage * TAG / n) - 3_600_000, menge]) });

ok('Schnelleingabe wie Android', () => {
  assert.deepEqual([E.zeile('2x Milch').menge, E.zeile('2x Milch').name], [2, 'Milch']);
  const h = E.zeile('500 g Hack'); assert.equal(h.einheit, 'G'); assert.equal(h.menge, 500);
  assert.equal(E.zeile('Butter 1,99 €').preisCent, 199);
  assert.equal(E.zeile('Milch x3').menge, 3);
  assert.equal(E.zeile('123'), null);
});
ok('Energy-Dosen → 12er-Palette', () => {
  const s = Nachkauf.vorschlaege(E.neueDaten(), [verbrauch('Monster Energy Ultra', 500, 28)], jetzt);
  assert.equal(s.length, 1);
  const v = s[0], o = v.optionen[v.empfohlen];
  assert.equal(v.behaelter, 'DOSE'); assert.equal(o.gebinde.name, '12er-Palette'); assert.equal(o.anzahl, 1);
  const e = Nachkauf.eintrag(v, o, jetzt);
  assert.equal(e.einheit, 'PACKUNG'); assert.equal(e.groesse, '12 × 0,5 l Dose');
});
ok('Bier im Kasten, Name ohne Menge', () => {
  const v = Nachkauf.vorschlaege(E.neueDaten(), [verbrauch('Bier 0,5 l', 500, 40)], jetzt)[0];
  assert.equal(v.name, 'Bier'); assert.equal(v.optionen[v.empfohlen].gebinde.stueck, 20);
});
ok('Wasser mit Packungsangabe → 6er-Pack', () => {
  const v = Nachkauf.vorschlaege(E.neueDaten(), [{ ...verbrauch('Mineralwasser', 1500, 14, 14, 250), packung: '6 x 1,5 l' }], jetzt)[0];
  assert.equal(v.inhalt, 1500); assert.equal(v.optionen[v.empfohlen].gebinde.name, '6er-Pack');
});
ok('Selten oder schon auf der Liste: kein Vorschlag; Später und Nie', () => {
  assert.equal(Nachkauf.vorschlaege(E.neueDaten(), [verbrauch('Cola', 330, 3)], jetzt).length, 0);
  const v = verbrauch('Cola Zero 0,33 l', 330, 20);
  let d = E.hinzufuegen(E.neueDaten(), { name: 'Cola Zero' }, jetzt);
  assert.equal(Nachkauf.vorschlaege(d, [v], jetzt).length, 0);
  d = Nachkauf.spaeter(E.neueDaten(), 'cola zero', jetzt);
  assert.equal(Nachkauf.vorschlaege(d, [v], jetzt).length, 0);
  d = Nachkauf.nie(d, 'cola zero');
  assert.equal(Nachkauf.nieAnzahl(d), 1);
  assert.equal(Nachkauf.vorschlaege(Nachkauf.nieZuruecksetzen(d), [v], jetzt).length, 1);
});
ok('Kauf wird mitgerechnet', () => {
  let d = E.hinzufuegen(E.neueDaten(), { name: 'Red Bull', menge: 1, einheit: 'PACKUNG', groesse: '24 × 0,25 l Dose' }, jetzt - 3 * TAG);
  d = E.abhaken(d, d.eintraege[0].id, true, jetzt - 3 * TAG);
  const wenig = { name: 'Red Bull', ean: '', fluessig: true, portion: 250, packung: '', eintraege: Array.from({ length: 14 }, (_, i) => [jetzt - i * TAG / 2 - 1000, 250]) };
  assert.equal(Nachkauf.vorschlaege(E.erledigteEntfernen(d), [wenig], jetzt).length, 0);
  const viel = { ...wenig, eintraege: Array.from({ length: 28 }, (_, i) => [jetzt - i * TAG / 4 - 1000, 250]) };
  const v = Nachkauf.vorschlaege(E.erledigteEntfernen(d), [viel], jetzt)[0];
  assert.equal(v.rest, 12); assert.equal(v.optionen[v.empfohlen].gebinde.stueck, 24);
  assert.equal(E.abhaken(d, d.eintraege[0].id, false, jetzt).produkte[0].letzterKauf, null);
});
ok('Essen ohne Größe: 1 Packung, mit Größe in Packungen', () => {
  const v = Nachkauf.vorschlaege(E.neueDaten(), [verbrauch('Magerquark', 250, 10, 14, 250, false)], jetzt)[0];
  assert.equal(Nachkauf.optionText(v.optionen[0]), '1 Packung');
  const v2 = Nachkauf.vorschlaege(E.neueDaten(), [verbrauch('Magerquark', 250, 10, 14, 250, false, '500 g')], jetzt)[0];
  assert.equal(v2.optionen[v2.empfohlen].anzahl, 3);
});
ok('Verbrauch aus Food & Boost ohne Boost und Zubereitetes', () => {
  let s = L.neuerStand();
  const cola = s.produkte.find((p) => p.id === 'colazero'), esp = s.produkte.find((p) => p.id === 'espresso');
  let n = 0;
  for (let i = 0; i < 5; i++) { s = L.S.eintragen(s, L.eintragAus(cola, 'c' + n++, jetzt - i * TAG, 330)); s = L.S.eintragen(s, L.eintragAus(esp, 'e' + n++, jetzt - i * TAG, 30)); }
  const v = E.verbrauchAus(s, jetzt);
  assert.deepEqual(v.map((x) => x.name), ['Cola Zero 0,33 l']);
  assert.equal(Nachkauf.vorschlaege(E.neueDaten(), v, jetzt)[0].behaelter, 'DOSE');
});
ok('Android-Sicherung lesen', () => {
  const d = E.datenLesen({ format: 'dach-einkauf', version: 1, eintraege: [{ id: 'a', name: 'Milch' }], produkte: [], ausgeblendet: { x: 9223372036854775807 } });
  assert.equal(d.eintraege[0].menge, 1); assert.equal(Nachkauf.nieAnzahl(d), 1);
  assert.throws(() => E.datenLesen({ format: 'anders' }));
});
