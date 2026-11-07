// Übungsbilder: JS-Rechnung stimmt mit dem Python-Entwurf überein, jede Katalog-Übung hat ein Bild.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gelenke, muskelflaechen, musterFuer, figurSvg, haltung, pendel } from '../js/figuren.js';
import { KATALOG, uebung } from '../js/training-logik.js';

const ref = JSON.parse(readFileSync(new URL('./daten/figuren-referenz.json', import.meta.url)));
const nah = (a, b, text) => assert.ok(Math.abs(a - b) < 0.01, `${text}: ${a} ≠ ${b}`);

for (const r of ref) {
  const g = gelenke(r.ansicht, r.haltung);
  for (const [k, [x, y]] of Object.entries(r.gelenke)) { nah(g[k][0], x, `${r.muster} ${k}.x`); nah(g[k][1], y, `${r.muster} ${k}.y`); }
  const f = muskelflaechen(r.ansicht, g);
  assert.equal(f.length, r.flaechen.length);
  f.forEach((e, i) => {
    const q = r.flaechen[i];
    assert.equal(e[1], q[1]);
    nah(e[2][0], q[2], 'mitte x'); nah(e[2][1], q[3], 'mitte y'); nah(e[3], q[4], 'rx'); nah(e[5], q[6], 'winkel');
  });
}
console.log('✓ Gelenke und Muskelflächen wie im Entwurf');

for (const u of KATALOG) {
  const m = musterFuer(u);
  assert.ok(m && m.muster && m.muster.bilder.length === 5, `kein Bild für ${u.id}`);
  assert.ok(!m.muster.id.startsWith('stehen'), u.id);
  const svg = figurSvg(m.muster, m.geraet, u.primaer, u.sekundaer, 0.5);
  assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `Zeichnung kaputt: ${u.id}`);
  if (u.primaer.length) assert.ok(svg.includes('fm-p'), `Hauptmuskel nicht markiert: ${u.id}`);
}
console.log(`✓ alle ${KATALOG.length} Katalog-Übungen haben ein Bild mit markiertem Hauptmuskel`);

const eigen = musterFuer(uebung({ id: 'e:1', name: 'Incline Dumbbell Curl', primaer: ['BIZEPS'] }));
assert.equal(eigen.muster, musterFuer({ id: 'schraegcurl-kh' }).muster);
const fremd = musterFuer(uebung({ id: 'e:2', name: 'Irgendwas', primaer: ['LAT'] }));
assert.equal(fremd.muster.ansicht, 'hinten');
console.log('✓ eigene und importierte Übungen finden ihr Bild über den Namen');

assert.equal(pendel(0, 2), 0); nah(pendel(2, 2), 1, 'pendel'); nah(pendel(4, 2), 0, 'pendel zurück');
assert.deepEqual(haltung({ bilder: [[0], [1], [2], [3], [4]] }, 0.625), [2.5]);
console.log('✓ Abspielen hin und her');
