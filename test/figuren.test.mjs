// Übungsbilder: JS-Rechnung stimmt mit dem Python-Entwurf überein, jede Katalog-Übung hat ein Bild.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gelenke, muskelflaechen, musterFuer, figurSvg, haltung, pendel, fortschritt } from '../js/figuren.js';
import DATEN from '../js/figuren-daten.js';
import { KATALOG, uebung, Teile } from '../js/training-logik.js';

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
  assert.ok(m && m.muster && m.muster.bilder.length >= 5, `kein Bild für ${u.id}`);
  assert.ok(!m.muster.id.startsWith('stehen'), u.id);
  const [tp, ts] = Teile.von(u);
  const svg = figurSvg(m.muster, m.geraet, tp, ts, 0.5);
  assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `Zeichnung kaputt: ${u.id}`);
  if (u.primaer.length) assert.ok(svg.includes('fm-p'), `Hauptmuskel nicht markiert: ${u.id}`);
}
console.log(`✓ alle ${KATALOG.length} Katalog-Übungen haben ein Bild mit markiertem Hauptmuskel`);

const eigen = musterFuer(uebung({ id: 'e:1', name: 'Incline Dumbbell Curl', primaer: ['BIZEPS'] }));
assert.equal(eigen.muster, musterFuer({ id: 'schraegcurl-kh' }).muster);
const fremd = musterFuer(uebung({ id: 'e:2', name: 'Irgendwas', primaer: ['LAT'] }));
assert.equal(fremd.muster.ansicht, 'hinten');
// Namen ohne Katalogtreffer (aus einem Stronger-Export) über Stichworte
const st = (name) => { const m = musterFuer(uebung({ id: 'e:x', name, primaer: [] })); return `${m.muster.id}/${m.geraet}`; };
assert.equal(st('Katana Extension'), 'katana/KABEL');
assert.equal(st('Iso-lateral Pulldown'), 'latzug/MASCHINE');
assert.equal(st('Cable Pull down (Lateral)'), 'latzug/KABEL');
assert.equal(st('Lateral rise'), 'seitheben/KH');
assert.equal(st('Near grip Shoulder Press machi'), 'schulterdruecken/MASCHINE');
assert.equal(st('Decline Benchpress machine'), 'brustpresse_negativ/MASCHINE');
assert.equal(st('unterer R - Bock Platte heben'), 'hyperext/null');
assert.equal(st('Rotatoren Kabel'), 'rotatoren/KABEL');
assert.equal(st('Swimming in 100m'), 'schwimmen/null');
console.log('✓ eigene und importierte Übungen finden ihr Bild über den Namen');

assert.equal(pendel(0, 2), 0); nah(pendel(2, 2), 1, 'pendel'); nah(pendel(4, 2), 0, 'pendel zurück');
assert.deepEqual(haltung({ bilder: [[0], [1], [2], [3], [4]] }, 0.625), [2.5]);
console.log('✓ Abspielen hin und her');

// Kein Glied darf sich zwischen zwei Schlüsselbildern mehr als eine halbe Drehung weiterdrehen (sonst kreist es)
const WINKEL = [2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
for (const m of Object.values(DATEN.muster)) {
  for (let i = 1; i < m.bilder.length; i++) for (const j of WINKEL) assert.ok(Math.abs(m.bilder[i][j] - m.bilder[i - 1][j]) <= 180, `${m.id} Bild ${i} Wert ${j}`);
}
const rad = DATEN.muster.radfahren;
assert.ok(rad.zyklisch); nah(fortschritt(rad, rad.dauer), 0.5, 'Kreis halb'); nah(fortschritt(rad, 2 * rad.dauer * 1.25), 0.25, 'Kreis weiter');
console.log('✓ Winkel stetig, Radfahren und Schwimmen laufen im Kreis');
