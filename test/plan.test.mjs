// Übertragung der Android-Tests (PlanTest.kt) für „Bau mir einen Trainingsplan“. Aufruf: node test/plan.test.mjs
// test/daten/plan-referenz.json kommt aus der Android-App (gleiche Antworten → gleicher Plan).
import * as P from '../js/plan-logik.js';
import * as T from '../js/training-logik.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const ok = (n, f) => { try { f(); console.log('✓', n); } catch (e) { console.log('✗', n, e.stack); process.exitCode = 1; } };
const { katalogNachId } = T;
// Montag, 16.11.2026, lokal
const montag = new Date(2026, 10, 16).getTime();
const tag = (ms, n, h = 18) => { const d = new Date(ms); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d.getTime(); };
const training = (ms, id, kg, wdh, uebung = 'bankdruecken-lh') => T.workout({ id, name: 'T', start: ms, dauerSek: 3600, bloecke: [{ uebungId: uebung, saetze: [0, 1, 2].map(() => ({ gewicht: kg, wdh })) }] });
const stand = (workouts = [], plan = null) => ({ ...T.neuerStand(), workouts, plan });

ok('jede Kombination ergibt einen gültigen Plan', () => {
  for (let n = 1; n <= 6; n++) for (const z of P.ZIELE) for (const a of P.AUSSTATTUNGEN) for (const min of [30, 45, 60, 90]) for (const s of [[], ['PO'], ['ARME', 'BRUST']]) {
    const p = P.bauen({ wochentage: P.standardTage(n), ziel: z, schwerpunkte: s, minuten: min, ausstattung: a });
    assert.equal(p.tage.length, n);
    for (const t of p.tage) {
      assert.ok(t.uebungen.length >= 2, `${z} ${a} ${min} ${t.name}`);
      for (const u of t.uebungen) assert.ok(katalogNachId[u.uebungId], u.uebungId);
      const keys = t.uebungen.filter((u) => u.slot !== 'cardio').map((u) => u.uebungId.split('-')[0]);
      assert.equal(new Set(keys).size, keys.length, keys.join());
    }
  }
});

ok('gleiche Pläne wie die Android-App', () => {
  const ref = JSON.parse(readFileSync(new URL('./daten/plan-referenz.json', import.meta.url), 'utf8'));
  assert.ok(ref.length > 100);
  for (const { wunsch, plan } of ref) {
    const p = P.bauen(wunsch, 0);
    assert.equal(p.name, plan.name);
    assert.deepEqual(p.tage.map((t) => [t.name, t.wochentag, t.uebungen.map((u) => [u.uebungId, u.saetze, u.wdhVon, u.wdhBis, u.pauseSek, u.sekunden, u.minuten, u.slot])]),
      plan.tage.map((t) => [t.name, t.wochentag, (t.uebungen || []).map((u) => [u.uebungId, u.saetze ?? 3, u.wdhVon ?? 8, u.wdhBis ?? 12, u.pauseSek ?? 90, u.sekunden ?? 0, u.minuten ?? 0, u.slot ?? ''])]), JSON.stringify(wunsch));
  }
});

ok('ohne Geräte nur Körpergewicht und Band', () => {
  const p = P.bauen({ wochentage: [1, 3, 5], ziel: 'FIT', minuten: 45, ausstattung: 'OHNE' });
  for (const u of p.tage.flatMap((t) => t.uebungen)) {
    const g = u.uebungId.includes('-') ? u.uebungId.split('-')[1] : '';
    assert.ok(['', 'band', 'kg'].includes(g), u.uebungId);
  }
});

ok('Aufteilung nach Häufigkeit', () => {
  assert.deepEqual(P.bauen({ wochentage: [1, 3, 5] }).tage.map((t) => t.name), ['Ganzkörper A', 'Ganzkörper B', 'Ganzkörper C']);
  assert.deepEqual(P.bauen({ wochentage: [1, 2, 4, 5] }).tage.map((t) => t.name), ['Oberkörper A', 'Unterkörper A', 'Oberkörper B', 'Unterkörper B']);
});

ok('neu mischen und tauschen', () => {
  const a = P.bauen({ wochentage: [1, 3, 5] });
  const b = P.bauen({ wochentage: [1, 3, 5], variante: 1 });
  assert.notDeepEqual(a.tage[0].uebungen, b.tage[0].uebungen);
  const t = P.tauschen(a, 0, 0);
  assert.notEqual(t.tage[0].uebungen[0].uebungId, a.tage[0].uebungen[0].uebungId);
  assert.deepEqual(t.tage[0].uebungen.slice(1), a.tage[0].uebungen.slice(1));
});

ok('heute und nächster Trainingstag', () => {
  const p = P.bauen({ wochentage: [1, 3, 5] });
  assert.equal(P.heute(p, montag).name, 'Ganzkörper A');
  assert.equal(P.heute(p, tag(montag, 1)), null);
  assert.equal(P.naechster(p, tag(montag, 1)).tagMs, P.tagBeginn(montag, 2));
});

ok('Vorschlag nach doppelter Progression', () => {
  const u = katalogNachId['bankdruecken-lh'];
  const p = { uebungId: 'bankdruecken-lh', saetze: 3, wdhVon: 8, wdhBis: 12, pauseSek: 90, sekunden: 0, minuten: 0, slot: '' };
  const oben = P.vorschlag(p, u, [training(montag, 'a', 80, 12)]);
  assert.equal(oben.saetze[0].gewicht, 82.5); assert.equal(oben.saetze[0].wdh, 8); assert.ok(oben.steigerung);
  const mitte = P.vorschlag(p, u, [training(montag, 'a', 80, 9)]);
  assert.equal(mitte.saetze[0].gewicht, 80); assert.equal(mitte.saetze[0].wdh, 10);
  assert.ok(P.vorschlag(p, u, []).saetze.every((s) => !s.erledigt));
});

ok('Zusammenfassung mit Steigerung', () => {
  const p = P.bauen({ wochentage: [1, 3, 5], ziel: 'KRAFT' });
  const heute = tag(montag, 14, 7);
  const erste = p.tage[0].uebungen.find((x) => katalogNachId[x.uebungId].art === 'GEWICHT').uebungId;
  const w = [training(tag(montag, -40), 'a', 80, 5, erste), training(tag(montag, -33), 'b', 82.5, 5, erste), training(tag(montag, -5), 'c', 87.5, 5, erste), training(tag(montag, 7), 'd', 90, 5, erste)];
  const z = P.zusammenfassung(stand(w, p), p, 80, heute);
  assert.ok(z.titel.includes('Ganzkörper A'), z.titel);
  assert.ok(z.text.includes('+'), z.text);
  assert.equal(P.zusammenfassung(stand([...w, training(tag(montag, 14), 'x', 90, 5)]), p, 80, heute), null);
  assert.equal(P.zusammenfassung(stand(w), p, 80, tag(heute, 1)), null);
  assert.ok(P.zusammenfassung(stand(), p, 80, heute).titel.includes('startet'));
});

ok('Serie zählt volle Wochen', () => {
  const w = [1, 2, 3].flatMap((k) => [training(tag(montag, -7 * k), 'a' + k, 50, 8), training(tag(montag, -7 * k + 2), 'b' + k, 50, 8)]);
  assert.equal(P.serie(w, 2, tag(montag, 1)), 3);
  assert.equal(P.serie(w, 3, tag(montag, 1)), 0);
});

ok('Plan bleibt in Stand und Sicherung erhalten', () => {
  const p = P.bauen({ wochentage: [2, 4], ziel: 'ABNEHMEN', schwerpunkte: ['BAUCH'] });
  const s = T.standLesen(JSON.parse(JSON.stringify({ workouts: [], plan: p, einstellungen: { planErinnerung: { aktiv: true, minute: 400 } } })));
  assert.deepEqual(P.planLesen(s.plan), p);
  assert.equal(s.einstellungen.planErinnerung.minute, 400);
  assert.equal(T.standLesen({ workouts: [] }).plan, null);
});

ok('Training aus Plan-Tag mit Vorgabe', () => {
  const p = P.bauen({ wochentage: [1, 3, 5] });
  const w = P.workoutAusPlan(p.tage[0], katalogNachId, [], 'id', montag);
  assert.equal(w.bloecke.length, p.tage[0].uebungen.length);
  assert.ok(w.bloecke[0].notiz.startsWith('Plan: '));
  assert.deepEqual(T.workout(w).bloecke.map((b) => b.pauseSek), p.tage[0].uebungen.map((u) => u.pauseSek));
  assert.ok(w.bloecke.every((b) => b.saetze.every((s) => !s.erledigt)));
});
