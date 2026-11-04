// Übertragung der Android-Tests (KrafttrainingTest.kt, VerbrauchTest.kt). Aufruf: node test/training.test.mjs
import * as T from '../js/training-logik.js';
import assert from 'node:assert/strict';
const { Import, Rechnung, Belastung, Format, Verbrauch, katalogNachId, STANDARDS, KATALOG, finde } = T;
const ok = (n, f) => { try { f(); console.log('✓', n); } catch (e) { console.log('✗', n, e.stack); process.exitCode = 1; } };
const ms = (j, m, t, h = 0, min = 0) => Date.UTC(j, m - 1, t, h, min);
const leer = () => T.neuerStand();
const nah = (a, b, d = 0.01) => assert(Math.abs(a - b) <= d, `${a} ≠ ${b}`);

const strongAlt = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2024-03-07 18:30:00,"Push Day",1h 5m,"Bench Press (Barbell)",1,60,10,0,0,"",,
2024-03-07 18:30:00,"Push Day",1h 5m,"Bench Press (Barbell)",2,80,8,0,0,"tief",,8.5
2024-03-07 18:30:00,"Push Day",1h 5m,"Bench Press (Barbell)",Rest Timer,0,0,0,90,"",,
2024-03-07 18:30:00,"Push Day",1h 5m,"Overhead Press (Dumbbell)",1,22.5,10,0,0,"",,
2024-03-07 18:30:00,"Push Day",1h 5m,"Plank",1,0,0,0,60,"",,
2024-03-07 18:30:00,"Push Day",1h 5m,"Zottelziehen",1,30,12,0,0,"",,
2024-03-09 10:00:00,"Pull Day",52m,"Pull Up",1,10,6,0,0,"",,
2024-03-09 10:00:00,"Pull Day",52m,"Lat Pulldown (Cable)",1,55,12,0,0,"",,`;

const strongNeu = `Workout #;Date;Workout Name;Duration (sec);Exercise Name;Set Order;Weight (kg);Reps;RPE;Distance (meters);Seconds;Notes;Workout Notes
1;2025-01-02 07:00:00;Beine;3600;Squat (Barbell);W;60;5;;0;0;;
1;2025-01-02 07:00:00;Beine;3600;Squat (Barbell);1;102,5;5;9;0;0;;
1;2025-01-02 07:00:00;Beine;3600;Running;1;0;0;;2500;600;;`;

const hevy = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_lbs","reps","distance_miles","duration_seconds","rpe"
"Morning","22 Dec 2025, 08:00","22 Dec 2025, 09:10","","Deadlift (Barbell)",,"",0,"warmup",135,5,,,
"Morning","22 Dec 2025, 08:00","22 Dec 2025, 09:10","","Deadlift (Barbell)",,"",1,"normal",315,3,,,`;

const strongerExport = '﻿Stronger — Personal Data Export\r\nGenerated,2026-10-29T15:45:31.195Z\r\n\r\n' +
  '=== ACCOUNT ===\r\nName,Test\r\n\r\n' +
  '=== WORKOUT HISTORY ===\r\n' +
  'Date,Workout,Exercise,Set,Weight (kg),Reps,RPE,Duration (s),Distance (m),Personal Best,Notes\r\n' +
  '2026-03-19T18:53:50.725Z,Barbell Bench Press,1,40,10,,0,0,,\r\n' +
  '2026-03-19T18:53:50.725Z,Barbell Bench Press,2,50,8,,0,0,Yes,"tief, langsam"\r\n' +
  '2026-03-19T18:53:50.725Z,Lateral rise,1,10,16,,0,0,,\r\n' +
  '2024-02-24T00:00:00.000Z,Swimming in 100m,1,0,22,,,,,\r\n\r\n' +
  '=== BODYWEIGHT HISTORY ===\r\nDate,Weight (kg)\r\n\r\n' +
  '=== YOUR CUSTOM EXERCISES ===\r\nName,Bodyweight exercise\r\nLateral rise,No\r\nSwimming in 100m,Yes\r\n\r\n' +
  '=== YOUR COMMENTS ===\r\nDate,Comment\r\n2023-07-05T14:21:53.553Z,"mehrzeilig\r\n=== kein Abschnitt"\r\n';

ok('CSV mit Anführungszeichen und Semikolon', () => {
  assert.deepEqual(Import.csv('a;b;c\n"x;y";"sagt ""hi""";3\r\n\n'), [['a', 'b', 'c'], ['x;y', 'sagt "hi"', '3']]);
});

ok('Strong (alt) wird gelesen', () => {
  const e = Import.lese(strongAlt, leer(), null, true);
  assert.equal(e.quelle, 'Strong-Format');
  assert.equal(e.workouts.length, 2);
  const push = e.workouts[0];
  assert.equal(push.name, 'Push Day');
  assert.equal(push.start, ms(2024, 3, 7, 18, 30));
  assert.equal(push.dauerSek, 65 * 60);
  const bank = push.bloecke[0];
  assert.equal(bank.uebungId, 'bankdruecken-lh');
  assert.equal(bank.saetze.length, 2);
  assert.equal(bank.saetze[1].rpe, 8.5);
  assert.equal(bank.notiz, 'tief');
  assert.equal(push.bloecke[1].uebungId, 'schulterdruecken-kh');
  assert.equal(push.bloecke[2].uebungId, 'plank');
  assert.equal(push.bloecke[2].saetze[0].sekunden, 60);
  assert.equal(e.uebersprungen, 1);
  assert.equal(e.workouts[1].dauerSek, 52 * 60);
  assert.equal(e.workouts[1].bloecke[0].uebungId, 'klimmzug');
  assert.equal(e.workouts[1].bloecke[1].uebungId, 'latzug-kabel');
});

ok('Stronger-Export wird gelesen', () => {
  const e = Import.lese(strongerExport, leer(), null, true);
  assert.equal(e.quelle, 'Stronger-Export');
  assert.equal(e.zeilen, 4);
  assert.equal(e.workouts.length, 2);
  const w = e.workouts[1];
  assert.equal(w.start, Date.parse('2026-03-19T18:53:50.725Z'));
  const bank = w.bloecke[0];
  assert.equal(bank.uebungId, 'bankdruecken-lh');
  assert.deepEqual(bank.saetze.map((s) => [s.gewicht, s.wdh]), [[40, 10], [50, 8]]);
  assert.equal(bank.notiz, 'tief, langsam');
  assert.equal(w.bloecke[1].saetze[0].wdh, 16);
  assert.equal(e.uebungen.find((t) => t.name === 'Swimming in 100m').uebung.art, 'KOERPER');
  assert.equal(e.workouts[0].bloecke[0].saetze[0].wdh, 22);
});

ok('Stronger-Export wie in der App (Kopf, dann Zuordnung)', () => {
  assert.deepEqual(Import.kopf(strongerExport), ['Date', 'Exercise', 'Set', 'Weight (kg)', 'Reps', 'RPE', 'Duration (s)', 'Distance (m)', 'Personal Best', 'Notes']);
  const e = Import.lese(strongerExport, leer(), Import.erkenne(Import.kopf(strongerExport)), true);
  assert.equal(e.workouts.length, 2);
  assert.equal(e.saetze, 4);
});

ok('Titelzeilen vor der Tabelle werden übersprungen', () => {
  const text = 'Mein Trainingslog\nExportiert am 1.3.2024\n\nDatum;Übung;Gewicht;Wdh\n01.03.2024 18:00;Kniebeuge;100;5\n';
  assert.equal(Import.kopf(text)[0], 'Datum');
  const e = Import.lese(text, leer(), Import.erkenne(Import.kopf(text)), true);
  assert.equal(e.workouts[0].bloecke[0].saetze[0].gewicht, 100);
});

ok('Unbekannte Übung wird angelegt und beim zweiten Import wiedergefunden', () => {
  const e = Import.lese(strongAlt, leer(), null, true);
  assert.equal(e.neueUebungen.length, 1);
  assert.equal(e.neueUebungen[0].name, 'Zottelziehen');
  assert(e.neueUebungen[0].id.startsWith('e:'));
  assert.equal(e.ohneMuskeln.length, 1);
  const [stand] = Import.uebernehmen(leer(), e);
  assert.equal(Import.lese(strongAlt, stand, null, true).neueUebungen.length, 0);
});

ok('Doppelte Trainings werden übersprungen', () => {
  const e = Import.lese(strongAlt, leer(), null, true);
  const [s1, d1] = Import.uebernehmen(leer(), e);
  assert.equal(d1, 0);
  const [s2, d2] = Import.uebernehmen(s1, e);
  assert.equal(d2, 2);
  assert.equal(s2.workouts.length, 2);
  assert.equal(s2.uebungen.length, 1);
});

ok('Strong (neu): Sekunden und Aufwärmen', () => {
  const w = Import.lese(strongNeu, leer(), null, true).workouts[0];
  assert.equal(w.dauerSek, 3600);
  assert.equal(w.bloecke[0].uebungId, 'kniebeuge-lh');
  assert.equal(w.bloecke[0].saetze[0].typ, 'AUFWAERMEN');
  assert.equal(w.bloecke[0].saetze[1].gewicht, 102.5);
  assert.equal(w.bloecke[1].uebungId, 'laufen');
  assert.equal(w.bloecke[1].saetze[0].meter, 2500);
});

ok('Hevy in Pfund', () => {
  const e = Import.lese(hevy, leer(), null, true);
  assert.equal(e.quelle, 'Hevy-Format');
  const w = e.workouts[0];
  assert.equal(w.start, ms(2025, 12, 22, 8, 0));
  assert.equal(w.dauerSek, 70 * 60);
  assert.equal(w.bloecke[0].uebungId, 'kreuzheben-lh');
  assert.equal(w.bloecke[0].saetze[0].typ, 'AUFWAERMEN');
  nah(w.bloecke[0].saetze[1].gewicht, 142.88);
});

ok('Eigene Tabelle auf Deutsch', () => {
  const csv = 'Datum;Übung;Satz;Gewicht;Wdh\n13.02.2024 17:45;Bankdrücken (Langhantel);1;70;10\n13.02.2024 17:45;Kniebeuge;2;100;5';
  const e = Import.lese(csv, leer(), null, true);
  assert.equal(e.quelle, 'CSV');
  assert.equal(e.workouts[0].start, ms(2024, 2, 13, 17, 45));
  assert.deepEqual(e.workouts[0].bloecke.map((b) => b.uebungId), ['bankdruecken-lh', 'kniebeuge-lh']);
});

ok('Fehlende Spalten geben verständlichen Fehler', () => {
  assert.throws(() => Import.lese('Name,Alter\nA,3', leer(), null, true), T.ImportFehler);
  assert.throws(() => Import.lese('', leer(), null, true), T.ImportFehler);
});

ok('Zuordnung von Hand überschreibt Erkennung', () => {
  const csv = 'Wann,Was,Kilo,Mal\n2024-05-01,Squat,100,5';
  assert.throws(() => Import.lese(csv, leer(), null, true), T.ImportFehler);
  const z = { spalten: { DATUM: 0, UEBUNG: 1, GEWICHT: 2, WDH: 3 }, gewichtLb: false, meterJeEinheit: 1000, dauerInSekunden: false };
  assert.equal(Import.lese(csv, leer(), z, true).workouts[0].bloecke[0].saetze[0].gewicht, 100);
});

ok('Datumsformate', () => {
  const z = (t, tagZuerst) => Import.zeitpunkt(t, true, tagZuerst);
  assert.equal(z('2024-03-07 18:30:00'), ms(2024, 3, 7, 18, 30));
  assert.equal(z('2024-03-07T18:30:00Z'), ms(2024, 3, 7, 18, 30));
  assert.equal(z('07.03.2024'), ms(2024, 3, 7));
  assert.equal(z('Dec 22, 2025 8:05 PM'), ms(2025, 12, 22, 20, 5));
  assert.equal(z('22. Dez. 2025, 08:00'), ms(2025, 12, 22, 8, 0));
  assert.equal(z('02/13/2024'), ms(2024, 2, 13));
  assert.equal(z('07/03/2024', true), ms(2024, 3, 7));
  assert.equal(z('1700000000'), 1_700_000_000_000);
  assert.equal(z('gestern'), null);
  assert.equal(z('2024-02-31'), null);
});

ok('Zahlen und Dauer', () => {
  assert.equal(Import.zahl('82,5'), 82.5);
  assert.equal(Import.zahl('1.234,5'), 1234.5);
  assert.equal(Import.zahl('1,234.5'), 1234.5);
  assert.equal(Import.zahl('60 kg'), 60);
  assert.equal(Import.zahl(''), null);
  assert.equal(Import.sekunden('1h 5m'), 3900);
  assert.equal(Import.sekunden('1:30'), 90);
  assert.equal(Import.sekunden('1:02:03'), 3723);
  assert.equal(Import.sekunden('45s'), 45);
  assert.equal(Import.sekunden('50', true), 3000);
});

ok('Katalog erkennt Schreibweisen', () => {
  assert.equal(finde('Bench Press (Dumbbell)').uebung?.id, 'bankdruecken-kh');
  assert.equal(finde('Dumbbell Bench Press').uebung?.id, 'bankdruecken-kh');
  assert.equal(finde('Triceps Pushdown (Cable - Straight Bar)').uebung?.id, 'trizepsdruecken-kabel');
  assert.equal(finde('Pull Up (Weighted)').uebung?.id, 'klimmzug');
  assert.equal(finde('Rowing (Machine)').uebung?.id, 'rudergeraet');
  assert.equal(finde('Leg Press').uebung?.id, 'beinpresse-ma');
  assert.equal(finde('Kniebeuge (Langhantel)').uebung?.id, 'kniebeuge-lh');
  const t = finde('Bench Press (Kettlebell)');
  assert.equal(t.uebung, null);
  assert.deepEqual(t.primaer, ['BRUST']);
  assert.deepEqual(finde('Spider Curl (Dumbbell)').primaer, ['BIZEPS']);
  assert.deepEqual(finde('Donkey Calf Raise').primaer, ['WADEN']);
  assert.equal(finde('Zottelziehen').primaer.length, 0);
});

ok('Katalog-IDs eindeutig, Standards vorhanden', () => {
  assert.equal(KATALOG.length, Object.keys(katalogNachId).length);
  assert(KATALOG.length > 140, KATALOG.length);
  for (const id of Object.keys(STANDARDS)) assert(katalogNachId[id], id);
});

ok('Unterstützte Klimmzüge zählen negativ', () => {
  const csv = 'Date,Exercise Name,Set Order,Weight,Reps\n2024-01-01 10:00:00,Assisted Pull Up,1,20,8';
  const b = Import.lese(csv, leer(), null, true).workouts[0].bloecke[0];
  assert.equal(b.uebungId, 'klimmzug');
  assert.equal(b.saetze[0].gewicht, -20);
  assert.equal(Rechnung.last(b.saetze[0], 'KOERPER', 82), 62);
});

const S = (gewicht, wdh, x = {}) => T.satz({ gewicht, wdh, ...x });
const training = (id, start, uebung, ...saetze) => T.workout({ id, start, bloecke: [{ uebungId: uebung, saetze }] });

ok('1RM und Volumen', () => {
  assert.equal(Rechnung.e1rm(100, 1), 100);
  nah(Rechnung.e1rm(100, 6), 120, 0.001);
  assert.equal(Rechnung.e1rm(100, 0), 0);
  assert.equal(Rechnung.e1rm(50, 15), Rechnung.e1rm(50, 30));
  const w = training('w', 0, 'bankdruecken-lh', S(40, 10, { typ: 'AUFWAERMEN' }), S(80, 8), S(80, 7, { erledigt: false }));
  const z = Rechnung.zusammenfassung(w, katalogNachId, 82);
  assert.equal(z.saetze, 1);
  assert.equal(z.volumen, 640);
});

ok('Verlauf und Rekorde', () => {
  const ws = [training('b', ms(2024, 1, 8), 'bankdruecken-lh', S(85, 5)), training('a', ms(2024, 1, 1), 'bankdruecken-lh', S(80, 8), S(80, 8))];
  const v = Rechnung.verlauf('bankdruecken-lh', ws, 'GEWICHT', 82);
  assert.deepEqual(v.map((p) => p.workoutId), ['a', 'b']);
  assert.equal(v[0].volumen, 1280);
  const r = Rechnung.rekorde(v);
  assert.equal(r.maxGewicht.wert, 85);
  assert.equal(r.volumen.start, ms(2024, 1, 1));
  assert.equal(r.e1rm.wert, v[0].e1rm);
  const neu = Rechnung.neueRekorde(ws[0], ws, katalogNachId, 82);
  assert(neu.some((x) => x.includes('schwerstes Gewicht 85 kg')), neu.join());
  assert(!neu.some((x) => x.includes('Volumen')));
});

ok('Letzte Sätze als Vorschlag', () => {
  const ws = [training('a', 1000, 'kniebeuge-lh', S(100, 5)), training('b', 2000, 'kniebeuge-lh', S(105, 5))];
  assert.equal(Rechnung.letzteSaetze('kniebeuge-lh', ws)[0].gewicht, 105);
  assert.equal(Rechnung.letzteSaetze('kniebeuge-lh', ws, 2000)[0].gewicht, 100);
  assert.equal(Rechnung.letzteSaetze('latzug-kabel', ws).length, 0);
});

ok('Sätze je Muskel', () => {
  const ws = [training('a', ms(2024, 1, 1), 'bankdruecken-lh', S(80, 8), S(80, 8), S(40, 10, { typ: 'AUFWAERMEN' }))];
  const m = Belastung.saetze(ws, katalogNachId, ms(2024, 1, 1), ms(2024, 1, 8));
  assert.equal(m.BRUST, 2);
  assert.equal(m.TRIZEPS, 1);
  assert.equal(m.QUADRIZEPS, 0);
  assert.equal(Belastung.saetze(ws, katalogNachId, ms(2024, 1, 2), ms(2024, 1, 8)).BRUST, 0);
});

ok('Erholung klingt ab', () => {
  const start = ms(2024, 1, 1, 10);
  const ws = [training('a', start, 'kniebeuge-lh', ...Array.from({ length: 8 }, () => S(100, 5)))];
  const gleich = Belastung.erholung(ws, katalogNachId, start);
  nah(gleich.QUADRIZEPS, 0, 0.001);
  assert.equal(gleich.BRUST, 1);
  assert(Belastung.erholung(ws, katalogNachId, start + 72 * 3_600_000).QUADRIZEPS > 0.94);
  const mitte = Belastung.erholung(ws, katalogNachId, start + 24 * 3_600_000).QUADRIZEPS;
  assert(mitte >= 0.5 && mitte <= 0.75, String(mitte));
});

ok('Kraftniveau', () => {
  assert.deepEqual(Belastung.punkte(0.25, STANDARDS['bankdruecken-lh']), [0, 10]);
  assert.deepEqual(Belastung.punkte(1.25, STANDARDS['bankdruecken-lh']), [3, 60]);
  assert.deepEqual(Belastung.punkte(3.0, STANDARDS['bankdruecken-lh']), [5, 100]);
  const n = Belastung.kraftniveau([training('a', 0, 'bankdruecken-lh', S(100, 1))], katalogNachId, 80);
  assert.equal(n.BRUST.stufe, 3);
  assert.equal(n.TRIZEPS, undefined);
});

ok('Speichern und Laden (auch Android-JSON ohne Standardwerte)', () => {
  const [s] = Import.uebernehmen(leer(), Import.lese(strongAlt, leer(), null, true));
  assert.deepEqual(T.standLesen(JSON.parse(JSON.stringify(s))), s);
  assert.deepEqual(T.standLesen({ unbekannt: 1 }), leer());
  const android = T.standLesen({ workouts: [{ id: 'x', start: 5, bloecke: [{ uebungId: 'kniebeuge-lh', saetze: [{ gewicht: 100, wdh: 5 }, { typ: 'AUFWAERMEN', wdh: 8 }] }] }] });
  assert.equal(android.workouts[0].bloecke[0].saetze[0].erledigt, true);
  assert.equal(android.workouts[0].bloecke[0].saetze[1].typ, 'AUFWAERMEN');
  assert.equal(android.einstellungen.pauseSek, 90);
});

ok('Formatierung', () => {
  assert.equal(Format.zahl(1234.5), '1.234,5');
  assert.equal(Format.satz(S(80, 8), 'GEWICHT'), '80 kg × 8');
  assert.equal(Format.satz(S(10, 6, { rpe: 8 }), 'KOERPER'), '+10 kg × 6 @8');
  assert.equal(Format.satz(T.satz({ meter: 2500, sekunden: 600 }), 'CARDIO'), '2,5 km in 10 min');
  assert.equal(Format.dauer(3900), '1 h 5 min');
  assert.equal(Format.datum(ms(2024, 3, 7), true), 'Do, 7. März 2024');
});

ok('Verbrauch (Netto-MET)', () => {
  const kraft = T.workout({ id: 'k', start: 0, bloecke: [{ uebungId: 'bankdruecken-lh', saetze: Array.from({ length: 16 }, () => ({ gewicht: 80, wdh: 8 })) }] });
  // 16 Sätze × 2,5 min = 40 min, (5 − 1) × 80 kg × 2/3 h ≈ 213 kcal
  assert.equal(Verbrauch.kcal(kraft, katalogNachId, 80), 213);
  const mitDauer = { ...kraft, dauerSek: 3600 };
  assert.equal(Verbrauch.kcal(mitDauer, katalogNachId, 80), 320);
  const lauf = T.workout({ id: 'l', start: 0, bloecke: [{ uebungId: 'laufen', saetze: [{ meter: 5000, sekunden: 1800 }] }] });
  // 10 km/h → MET 10: (10 − 1) × 80 × 0,5 = 360
  assert.equal(Verbrauch.kcal(lauf, katalogNachId, 80), 360);
});
