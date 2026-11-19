// Rückblick Woche bis Jahr (Port von Zeitraum.kt, Wochenrueckblick.kt, tracker/Rueckblick.kt + TrackerWoche.kt und
// krafttraining/Rueckblick.kt + KraftWoche.kt der Android-App). Rein rechnend: Stände rein, Beiträge raus.
// Ein Beitrag: { titel, symbol, kurz, kennzahlen: [{ name, wert, unter, anteil, trend }], lob: [..], tipps: [..] }.
import { S, Ziele, Boost, istBoost, nwPlus, naehrwerte } from './logik.js';
import * as T from './training-logik.js';
import * as P from './plan-logik.js';

const TAG_MS = 86_400_000;
const zahl = T.Format.zahl;
const floorMod = (a, n) => ((a % n) + n) % n;

// ---------- Zeitraum ----------

/** Länge eines Rückblicks; die Texte passen in Sätze wie „mehr als [vorher]“ oder „[ganz] ohne Alkohol“. */
export const Art = {
  WOCHE: { titel: 'Woche', rueckblick: 'Wochenrückblick', vorKurz: 'Vorwoche', vorher: 'letzte Woche', diese: 'diese Woche', ganz: 'die ganze Woche', gegenueber: 'der Vorwoche', mehrzahl: 'Wochen' },
  MONAT: { titel: 'Monat', rueckblick: 'Monatsrückblick', vorKurz: 'Vormonat', vorher: 'im Vormonat', diese: 'diesen Monat', ganz: 'den ganzen Monat', gegenueber: 'dem Vormonat', mehrzahl: 'Monaten' },
  QUARTAL: { titel: 'Quartal', rueckblick: 'Quartalsrückblick', vorKurz: 'Vorquartal', vorher: 'im Vorquartal', diese: 'dieses Quartal', ganz: 'das ganze Quartal', gegenueber: 'dem Vorquartal', mehrzahl: 'Quartalen' },
  HALBJAHR: { titel: 'Halbjahr', rueckblick: 'Halbjahresrückblick', vorKurz: 'Vorhalbjahr', vorher: 'im Halbjahr davor', diese: 'dieses Halbjahr', ganz: 'das ganze Halbjahr', gegenueber: 'dem Halbjahr davor', mehrzahl: 'Halbjahren' },
  JAHR: { titel: 'Jahr', rueckblick: 'Jahresrückblick', vorKurz: 'Vorjahr', vorher: 'im Vorjahr', diese: 'dieses Jahr', ganz: 'das ganze Jahr', gegenueber: 'dem Vorjahr', mehrzahl: 'Jahren' },
};
export const ARTEN = Object.keys(Art);
const MONATE_JE = { MONAT: 1, QUARTAL: 3, HALBJAHR: 6, JAHR: 12 };

/** Kalendertag { j, m (0–11), t }, lokal. */
export const tag = (j, m, t) => { const d = new Date(j, m, t); return { j: d.getFullYear(), m: d.getMonth(), t: d.getDate() }; };
export const tagVon = (ms) => { const d = new Date(ms); return { j: d.getFullYear(), m: d.getMonth(), t: d.getDate() }; };
export const tagMs = (d) => new Date(d.j, d.m, d.t).getTime();
const plusTage = (d, n) => tag(d.j, d.m, d.t + n);
const plusMonate = (d, n) => tag(d.j, d.m + n, d.t);
const gleich = (a, b) => a.j === b.j && a.m === b.m && a.t === b.t;
/** Tage seit 1970 (wie LocalDate.toEpochDay). */
const epochTag = (d) => Math.floor(Date.UTC(d.j, d.m, d.t) / TAG_MS);
/** 1 = Montag … 7 = Sonntag. */
const wochentag = (d) => ((new Date(d.j, d.m, d.t).getDay() + 6) % 7) + 1;
const montagVon = (d) => plusTage(d, -(wochentag(d) - 1));

/** Zeitraum der Art [art] ab Tag [von] (einschließlich) bis [bis] (ausschließlich). */
export function zeitraum(art, von) {
  const bis = art === 'WOCHE' ? plusTage(von, 7) : plusMonate(von, MONATE_JE[art]);
  return { art, von, bis };
}

/** Zeitraum der Art [art], in dem [d] liegt. */
export function zeitraumUm(art, d) {
  if (art === 'WOCHE') return zeitraum(art, montagVon(d));
  const m = art === 'MONAT' ? d.m : art === 'QUARTAL' ? Math.floor(d.m / 3) * 3 : art === 'HALBJAHR' ? (d.m < 6 ? 0 : 6) : 0;
  return zeitraum(art, tag(d.j, m, 1));
}

/** Um [n] Zeiträume verschoben (−1 = der davor). */
export const verschieben = (z, n) => zeitraum(z.art, z.art === 'WOCHE' ? plusTage(z.von, 7 * n) : plusMonate(z.von, MONATE_JE[z.art] * n));
export const vorher = (z) => verschieben(z, -1);
export const laenge = (z) => Math.round((Date.UTC(z.bis.j, z.bis.m, z.bis.t) - Date.UTC(z.von.j, z.von.m, z.von.t)) / TAG_MS);
export const letzterTag = (z) => plusTage(z.bis, -1);
export const msVon = (z) => tagMs(z.von);
/** Ende in ms, höchstens [jetzt] (ein laufender Zeitraum zählt bis jetzt). */
export const msBis = (z, jetzt) => Math.min(tagMs(z.bis), jetzt);

/** Begonnene Tage (1 bis Länge). */
export function tage(z, jetzt) {
  const ende = Math.max(jetzt, msVon(z) + 1);
  const l = laenge(z);
  let n = 0;
  while (n < l && tagMs(plusTage(z.von, n)) < ende) n++;
  return Math.min(l, Math.max(1, n));
}

/** Beginn jedes begonnenen Tages in ms und als letztes das Ende (für tageweise Rechnungen). */
export const tagesgrenzen = (z, jetzt) => [...Array(tage(z, jetzt)).keys()].map((i) => tagMs(plusTage(z.von, i))).concat(msBis(z, jetzt));

/** ISO-Kalenderwoche. */
export function kw(d) {
  const u = new Date(Date.UTC(d.j, d.m, d.t));
  const wt = u.getUTCDay() || 7;
  u.setUTCDate(u.getUTCDate() + 4 - wt);
  const jan1 = Date.UTC(u.getUTCFullYear(), 0, 1);
  return Math.ceil(((u - jan1) / TAG_MS + 1) / 7);
}

const MONATE = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
const MONATE_LANG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** „KW 46 · 9.–15. Nov.“, „November 2026“, „Q4 2026 · Okt.–Dez.“, „2. Halbjahr 2026“, „2026“. */
export function titel(z) {
  const v = z.von;
  if (z.art === 'WOCHE') {
    const so = plusTage(v, 6);
    const von = v.m === so.m ? `${v.t}.` : `${v.t}. ${MONATE[v.m]}`;
    return `KW ${kw(v)} · ${von}–${so.t}. ${MONATE[so.m]}`;
  }
  if (z.art === 'MONAT') return `${MONATE_LANG[v.m]} ${v.j}`;
  if (z.art === 'QUARTAL') return `Q${Math.floor(v.m / 3) + 1} ${v.j} · ${MONATE[v.m]}–${MONATE[letzterTag(z).m]}`;
  if (z.art === 'HALBJAHR') return `${v.m < 6 ? 1 : 2}. Halbjahr ${v.j}`;
  return `${v.j}`;
}

/** Ein Wert, der je Zeitraum gleich bleibt (für Sprüche). */
export const nummer = (z) => Math.trunc(epochTag(z.von) / 7) + ARTEN.indexOf(z.art) * 7919;

/** Wie viele Zeiträume zurück die Seite startet: am ersten Tag eines Zeitraums mit dem gerade beendeten. */
export const anfang = (art, heute) => (gleich(zeitraumUm(art, heute).von, heute) ? 1 : 0);

/** „Diese Woche“, „Vorwoche“, „Vor 3 Wochen“. */
export const wann = (art, zurueck) => (zurueck === 0 ? Art[art].diese[0].toUpperCase() + Art[art].diese.slice(1) : zurueck === 1 ? Art[art].vorKurz : `Vor ${zurueck} ${Art[art].mehrzahl}`);

// ---------- Kopf: Überschrift, Spruch, Trend ----------

const SPRUECHE = [
  'Dranbleiben schlägt Perfektion.',
  'Kleine Schritte jede Woche ergeben große Sprünge im Jahr.',
  'Erfolg ist die Summe kleiner Anstrengungen, Tag für Tag wiederholt.',
  'Du musst nicht jede Woche perfekt sein – nur dabei.',
  'Gewohnheiten machen den Unterschied, nicht einzelne Tage.',
  'Stark wird man nicht an einem Tag, sondern Woche für Woche.',
  'Was du diese Woche säst, erntest du in ein paar Monaten.',
  'Gönn dir den Sonntag – nächste Woche geht\'s weiter.',
];
const SPRUECHE_LANG = [
  'Zurückschauen lohnt sich: Sieh, wie weit du gekommen bist.',
  'Beständigkeit über Monate schlägt jede Motivation für einen Tag.',
  'Jeder eingetragene Tag ist ein Baustein für deinen Fortschritt.',
  'Fortschritt sieht man nicht im Spiegel von heute, sondern im Rückblick.',
  'Große Ziele erreicht man in vielen kleinen, langweiligen Wochen.',
  'Du bist heute stärker als zu Beginn dieses Zeitraums – das zählt.',
];

/** Ein Spruch je Zeitraum (gleicher Zeitraum, gleicher Spruch). */
export const spruch = (z) => (z.art === 'WOCHE'
  ? SPRUECHE[floorMod(Math.trunc(epochTag(z.von) / 7), SPRUECHE.length)]
  : SPRUECHE_LANG[floorMod(nummer(z), SPRUECHE_LANG.length)]);

/** Überschrift nach der Zahl der Erfolge; bei längeren Zeiträumen zählen mehr Erfolge für „stark“. */
export function ueberschrift(beitraege, art) {
  const n = beitraege.reduce((a, b) => a + b.lob.length, 0);
  if (!beitraege.length) return 'Noch nichts eingetragen';
  if (art === 'WOCHE') return n >= 5 ? 'Was für eine Woche! 🔥' : n >= 3 ? 'Starke Woche! 💪' : n >= 1 ? 'Gute Woche – es geht voran 🌱' : 'Neue Woche, neue Chance ✨';
  return n >= 6 ? `Was für ein ${Art[art].titel}! 🔥` : n >= 3 ? 'Starke Bilanz! 💪' : n >= 1 ? 'Es geht voran 🌱' : 'Weiter geht\'s ✨';
}

export const erfolge = (beitraege, art) => {
  const n = beitraege.reduce((a, b) => a + b.lob.length, 0);
  return n === 0 ? '' : n === 1 ? `1 Erfolg ${Art[art].diese}` : `${n} Erfolge ${Art[art].diese}`;
};

/** +1 wenn [jetzt] spürbar (mehr als [schwelle] relativ) höher als [vor], −1 wenn niedriger (umgekehrt ohne mehrIstBesser). */
export function trend(jetzt, vor, schwelle = 0.05, mehrIstBesser = true) {
  if (vor == null || !(vor > 0) || !(jetzt > 0)) return 0;
  const r = jetzt / vor - 1;
  const t = r > schwelle ? 1 : r < -schwelle ? -1 : 0;
  return mehrIstBesser ? t : -t;
}

const kennzahl = (name, wert, unter = null, anteil = null, tr = 0) => ({ name, wert, unter, anteil, trend: tr });
const anteilVon = (wert, ziel) => (ziel > 0 ? Math.min(1, Math.max(0, wert / ziel)) : null);

// ---------- Food & Boost ----------

/** Zahlen eines Zeitraums aus den Tagesgrenzen; [trainingKcal](von, bis): Zusatzverbrauch durch Training. */
export function foodZahlen(s, grenzen, jahr, trainingKcal = () => 0) {
  const r = { tage: grenzen.length - 1, erfasst: 0, kcal: 0, kcalZiel: 0, tageKcalImZiel: 0, eiweiss: 0, eiweissZiel: 0, tageEiweiss: 0, kohlenhydrate: 0, fett: 0, trinken: 0, trinkenZiel: 0, koffeinGesamt: 0, koffeinMaxTag: 0, tageKoffeinUeberLimit: 0, alkoholG: 0, tageMitAlkohol: 0, planErledigt: 0, planGesamt: 0, boost: [] };
  for (let i = 0; i + 1 < grenzen.length; i++) {
    const von = grenzen[i], bis = grenzen[i + 1];
    const e = S.eintraege(s, von, bis);
    const plan = Boost.plan(s, von, bis);
    r.planGesamt += plan.length;
    r.planErledigt += plan.filter((p) => p.erledigt).length;
    const kTag = e.reduce((a, x) => a + x.koffeinMg, 0);
    r.koffeinGesamt += kTag;
    r.koffeinMaxTag = Math.max(r.koffeinMaxTag, kTag);
    if (kTag > s.einstellungen.koffeinTageslimitMg + 0.5) r.tageKoffeinUeberLimit++;
    const aTag = e.reduce((a, x) => a + x.alkoholG, 0);
    r.alkoholG += aTag;
    if (aTag > 0) r.tageMitAlkohol++;
    if (!e.length) continue;
    r.erfasst++;
    const training = trainingKcal(von, bis);
    const ziel = Ziele.berechnen(s.koerper, s.einstellungen, jahr, training);
    const nw = e.reduce((a, x) => nwPlus(a, x.naehrwerte), naehrwerte());
    r.kcal += nw.kcal; r.kcalZiel += ziel.kcal;
    if (ziel.kcal > 0 && nw.kcal >= ziel.kcal * 0.9 && nw.kcal <= ziel.kcal * 1.1) r.tageKcalImZiel++;
    r.eiweiss += nw.eiweiss; r.eiweissZiel += ziel.eiweiss;
    if (ziel.eiweiss > 0 && nw.eiweiss >= ziel.eiweiss * 0.9) r.tageEiweiss++;
    r.kohlenhydrate += nw.kohlenhydrate; r.fett += nw.fett;
    const [ml, mlZiel] = Ziele.trinken(e, s.koerper, s.einstellungen, training > 0);
    r.trinken += ml; r.trinkenZiel += mlZiel;
  }
  const n = Math.max(1, r.erfasst);
  for (const k of ['kcal', 'kcalZiel', 'eiweiss', 'eiweissZiel', 'kohlenhydrate', 'fett', 'trinken', 'trinkenZiel']) r[k] /= n;
  const zaehl = new Map();
  for (const e of S.eintraege(s, grenzen[0] ?? 0, grenzen[grenzen.length - 1] ?? 0)) if (istBoost(e.kategorie)) zaehl.set(e.name, (zaehl.get(e.name) || 0) + 1);
  r.boost = [...zaehl].sort((a, b) => b[1] - a[1] || a[0].toLowerCase().localeCompare(b[0].toLowerCase()));
  r.leer = r.erfasst === 0;
  r.planQuote = r.planGesamt > 0 ? r.planErledigt / r.planGesamt : null;
  return r;
}

/** Ein Standardglas hat etwa 10 g reinen Alkohol (0,25 l Bier, 0,1 l Wein). */
export const glaeser = (g) => g / 10;
const tageText = (n) => (n === 1 ? '1 Tag' : `${n} Tagen`);
const gross = (t) => t[0].toUpperCase() + t.slice(1);

export function foodLob(w, v, art) {
  const t = Art[art];
  const r = [];
  if (w.leer) return r;
  // Über längere Zeiträume zählt ein Erfolg erst, wenn er an einem guten Teil der Tage klappt.
  const genug = Math.max(3, Math.ceil(w.erfasst * 0.4));
  if (w.tage >= 3 && w.erfasst === w.tage) r.push(`📒 An allen ${w.tage} Tagen eingetragen – starke Routine!`);
  else if (w.tage >= 28 && w.erfasst >= w.tage * 0.8) r.push(`📒 An ${w.erfasst} von ${w.tage} Tagen eingetragen – starke Routine!`);
  if (w.tageEiweiss >= genug) r.push(`🥩 An ${w.tageEiweiss} Tagen dein Eiweißziel geschafft`);
  else if (v && !v.leer && w.eiweiss > v.eiweiss * 1.1) r.push(`🥩 ${zahl(w.eiweiss - v.eiweiss, 0)} g mehr Eiweiß am Tag als ${t.vorher}`);
  if (w.tageKcalImZiel >= genug) r.push(`🎯 An ${w.tageKcalImZiel} Tagen genau im Kalorienziel`);
  if (w.planQuote != null && w.planQuote >= 0.8 && w.planGesamt >= 3) r.push(`💊 Einnahmeplan zu ${Math.round(w.planQuote * 100)} % eingehalten`);
  const frei = w.tage - w.tageMitAlkohol;
  if (w.tage >= 5 && w.alkoholG <= 0) r.push(`🍃 ${gross(t.ganz)} ohne Alkohol`);
  else if (w.tage >= 3 && w.tageMitAlkohol >= 1 && frei >= 5 && frei >= w.tage * 0.7) r.push(`🍃 ${frei} alkoholfreie Tage`);
  if (w.koffeinGesamt > 0 && w.tageKoffeinUeberLimit === 0 && w.tage >= 3) r.push('☕ Koffein jeden Tag im grünen Bereich');
  if (w.trinkenZiel > 0 && w.trinken >= w.trinkenZiel * 0.9) r.push(`💧 Genug getrunken: im Schnitt ${zahl(w.trinken / 1000, 1)} l am Tag`);
  return r;
}

export function foodTipps(w) {
  const r = [];
  if (w.leer) return r;
  if (w.eiweissZiel > 0 && w.eiweiss < w.eiweissZiel * 0.8) r.push(`Eiweiß im Schnitt ${zahl(w.eiweissZiel - w.eiweiss, 0)} g unter dem Ziel – ein Shake oder Quark mehr am Tag hilft.`);
  if (w.kcalZiel > 0 && w.kcal < w.kcalZiel * 0.8) r.push(`Im Schnitt ${zahl(w.kcalZiel - w.kcal, 0)} kcal unter deinem Bedarf – fürs Training lieber etwas mehr essen.`);
  if (w.tageKoffeinUeberLimit > 0) r.push(`An ${tageText(w.tageKoffeinUeberLimit)} mehr als 400 mg Koffein – öfter mal einen Booster weglassen?`);
  if (w.planQuote != null && w.planQuote < 0.6 && w.planGesamt >= 3) r.push(`Vom Einnahmeplan nur ${Math.round(w.planQuote * 100)} % geschafft – ein fester Zeitpunkt am Tag hilft.`);
  if (w.trinkenZiel > 0 && w.trinken < w.trinkenZiel * 0.7 && w.trinken > 0) r.push(`Etwas mehr trinken: Ziel sind ${zahl(w.trinkenZiel / 1000, 1)} l am Tag.`);
  const grenze = w.tage <= 7 ? w.tage - 2 : Math.trunc(w.tage * 0.6);
  if (w.erfasst >= 1 && w.erfasst < grenze) r.push(`Nur an ${tageText(w.erfasst)} eingetragen – je mehr Tage, desto genauer der Rückblick.`);
  return r;
}

/** Beitrag von Food & Boost; [training]: Trainingsstand für den Zusatzverbrauch (oder null). null = nichts erfasst. */
export function foodBeitrag(s, training, z, jetzt) {
  const kg = training ? T.koerperKg(training, s.koerper.gewichtKg) : 0;
  const u = training ? T.uebungMap(training) : {};
  const kcal = (von, bis) => (training ? training.workouts.filter((w) => w.start >= von && w.start < bis).reduce((a, w) => a + T.Verbrauch.kcal(w, u, kg), 0) : 0);
  const zahlen = (zz) => foodZahlen(s, tagesgrenzen(zz, jetzt), zz.von.j, kcal);
  const w = zahlen(z);
  if (w.leer) return null;
  const v0 = zahlen(vorher(z));
  const v = v0.leer ? null : v0;
  const k = [];
  k.push(kennzahl('Kalorien', `Ø ${zahl(w.kcal, 0)} kcal`, `Ziel ${zahl(w.kcalZiel, 0)} · ${w.tageKcalImZiel} von ${w.erfasst} Tagen im Ziel`, anteilVon(w.kcal, w.kcalZiel)));
  k.push(kennzahl('Eiweiß', `Ø ${zahl(w.eiweiss, 0)} g`, `Ziel ${zahl(w.eiweissZiel, 0)} g · ${w.tageEiweiss}× geschafft`, anteilVon(w.eiweiss, w.eiweissZiel), trend(w.eiweiss, v?.eiweiss)));
  k.push(kennzahl('Kohlenhydrate · Fett', `Ø ${zahl(w.kohlenhydrate, 0)} g · ${zahl(w.fett, 0)} g`));
  if (w.trinken > 0) k.push(kennzahl('Getrunken', `Ø ${zahl(w.trinken / 1000, 1)} l`, `Ziel ${zahl(w.trinkenZiel / 1000, 1)} l`, anteilVon(w.trinken, w.trinkenZiel), trend(w.trinken, v?.trinken)));
  if (w.koffeinGesamt > 0) {
    k.push(kennzahl('Koffein', `Ø ${zahl(w.koffeinGesamt / w.tage, 0)} mg am Tag`,
      `meiste ${zahl(w.koffeinMaxTag, 0)} mg` + (w.tageKoffeinUeberLimit > 0 ? ` · ${w.tageKoffeinUeberLimit}× über 400 mg` : ' · nie über 400 mg'),
      null, trend(w.koffeinGesamt / w.tage, v ? v.koffeinGesamt / v.tage : null, 0.1, false)));
  }
  if (w.alkoholG > 0 || (v?.alkoholG || 0) > 0) {
    const tr = w.alkoholG <= 0 && (v?.alkoholG || 0) > 0 ? 1 : trend(w.alkoholG / w.tage, v ? v.alkoholG / v.tage : null, 0.1, false);
    k.push(kennzahl('Alkohol', w.alkoholG > 0 ? `${zahl(glaeser(w.alkoholG), 1)} Gläser` : 'keiner',
      `${zahl(w.alkoholG, 0)} g an ${w.tageMitAlkohol} Tagen · ${w.tage - w.tageMitAlkohol} Tage ohne`, null, tr));
  }
  if (w.planQuote != null) k.push(kennzahl('Einnahmeplan', `${Math.round(w.planQuote * 100)} %`, `${w.planErledigt} von ${w.planGesamt} Einnahmen`, w.planQuote, trend(w.planQuote, v?.planQuote)));
  if (w.boost.length) {
    k.push(kennzahl('Supplements genommen', `${w.boost.reduce((a, b) => a + b[1], 0)}×`,
      w.boost.slice(0, 8).map(([n, x]) => (x > 1 ? `${n} ${x}×` : n)).join(', ') + (w.boost.length > 8 ? ' …' : '')));
  }
  const kurz = [`Ø ${zahl(w.kcal, 0)} kcal`, `${zahl(w.eiweiss, 0)} g Eiweiß`, w.planQuote != null ? `Boost ${Math.round(w.planQuote * 100)} %` : null].filter(Boolean).join(' · ');
  return { titel: 'Food & Boost', symbol: '🍽️', kurz, kennzahlen: k, lob: foodLob(w, v, z.art), tipps: foodTipps(w) };
}

// ---------- Training ----------

/** Zahlen des Krafttrainings für [z] mit Vergleich zum Zeitraum davor; [koerper]: Körpergewicht in kg. */
export function trainingZahlen(s, z, jetzt, koerper) {
  const woche = z.art === 'WOCHE';
  const vonMs = msVon(z), bisMs = msBis(z, jetzt), vorMs = msVon(vorher(z));
  const map = T.uebungMap(s);
  const kraft = s.workouts.filter((w) => !T.Cardio.nurCardio(w, map));
  const diese = kraft.filter((w) => w.start >= vonMs && w.start < bisMs).sort((a, b) => a.start - b.start);
  const vor = kraft.filter((w) => w.start >= vorMs && w.start < vonMs);
  const zus = (l) => l.map((w) => T.Rechnung.zusammenfassung(w, map, koerper));
  const zz = zus(diese);

  const heuteTag = tagVon(Math.max(bisMs - 1, vonMs));
  const tageBis = Math.max(1, Math.round((Date.UTC(heuteTag.j, heuteTag.m, heuteTag.t) - Date.UTC(z.von.j, z.von.m, z.von.t)) / TAG_MS) + 1);
  const wochen = woche ? 1 : Math.max(1, tageBis / 7);
  const vorWochen = woche ? 1 : Math.max(1, laenge(vorher(z)) / 7);

  // Neue Bestwerte: je Übung nur einmal, der erste Text (schwerstes Gewicht vor 1RM vor Volumen).
  const rekorde = new Map();
  for (const w of diese) for (const t of T.Rechnung.neueRekorde(w, s.workouts, map, koerper)) {
    const n = t.split(':')[0];
    if (!rekorde.has(n)) rekorde.set(n, t);
  }

  const plan = s.plan;
  const planTage = new Set((plan?.tage || []).map((t) => t.wochentag));
  const proWoche = plan ? new Set(plan.wunsch.wochentage).size || plan.tage.length : 0;
  const planTageBis = (ende) => {
    let n = 0;
    for (let d = z.von; tagMs(d) <= tagMs(ende) && tagMs(d) < tagMs(z.bis); d = plusTage(d, 1)) if (planTage.has(wochentag(d))) n++;
    return n;
  };
  const faellig = planTageBis(heuteTag);
  const ziel = proWoche || 1;
  const ids = [...new Set(diese.flatMap((w) => w.bloecke.map((b) => b.uebungId)))];
  let steig = [];
  if (diese.length && woche) steig = P.steigerungen(ids, s, koerper, tagMs(heuteTag)).slice(0, 3).map((x) => x.text);
  else if (diese.length) steig = steigerungen(ids, s, map, vonMs, bisMs, vorMs, koerper);

  // Kalenderwochen (ab Montag) mit mindestens 4 Tagen im Zeitraum bis heute; angeschnittene Ränder zählen nicht.
  const ende = tagMs(z.bis) < tagMs(plusTage(heuteTag, 1)) ? z.bis : plusTage(heuteTag, 1);
  const montage = [];
  for (let m = montagVon(z.von); tagMs(m) < tagMs(ende); m = plusTage(m, 7)) {
    const a = Math.max(tagMs(m), tagMs(z.von)), b = Math.min(tagMs(plusTage(m, 7)), tagMs(ende));
    if (Math.round((b - a) / TAG_MS) >= 4) montage.push(m);
  }
  const cardioZiel = s.einstellungen.cardioZielMin;
  const tagSchl = (ms) => new Date(ms).toDateString();
  const muskeln = Object.fromEntries(Object.entries(T.Belastung.saetze(s.workouts, map, vonMs, bisMs)).map(([m, n]) => [m, n / wochen]));
  const imWoche = (m, f) => f(tagMs(m), tagMs(plusTage(m, 7)));
  const r = {
    trainings: diese.length,
    minuten: Math.floor(diese.reduce((a, w) => a + w.dauerSek, 0) / 60),
    saetze: zz.reduce((a, x) => a + x.saetze, 0),
    volumen: zz.reduce((a, x) => a + x.volumen, 0),
    vorwocheTrainings: vor.length,
    vorwocheVolumen: zus(vor).reduce((a, x) => a + x.volumen, 0),
    rekorde: [...rekorde.values()],
    muskeln,
    planProWoche: proWoche,
    planFaellig: faellig,
    serie: woche ? P.serie(kraft, ziel, tagMs(plusTage(z.von, 6))) : 0,
    steigerungen: steig,
    cardio: T.Cardio.woche(s.workouts, map, vonMs, bisMs, Math.round(cardioZiel * wochen), tagSchl),
    vorwocheCardio: T.Cardio.woche(s.workouts, map, vorMs, vonMs, cardioZiel, tagSchl).zielMinuten,
    wochen, vorWochen,
    planSoll: woche ? proWoche : planTageBis(letzterTag(z)),
    wochenMitTraining: woche ? 0 : montage.filter((m) => imWoche(m, (a, b) => diese.some((w) => w.start >= a && w.start < b))).length,
    wochenGesamt: woche ? 0 : montage.length,
    cardioWochenGeschafft: woche ? 0 : montage.filter((m) => imWoche(m, (a, b) => T.Cardio.woche(s.workouts, map, a, b, cardioZiel, tagSchl).geschafft)).length,
  };
  r.cardio.leer = r.cardio.einheiten === 0;
  r.leer = r.trainings === 0 && r.cardio.leer;
  r.jeWoche = r.trainings / r.wochen;
  r.vorJeWoche = r.vorwocheTrainings / r.vorWochen;
  return r;
}

/** Bestes geschätztes 1RM je Übung im Zeitraum gegen den Zeitraum davor (nur Gewichtsübungen), größte zuerst. */
function steigerungen(ids, s, map, von, bis, vorVon, k) {
  return ids.map((id) => {
    const u = map[id];
    if (!u || (u.art !== 'GEWICHT' && u.art !== 'KOERPER')) return null;
    const best = (a, b) => {
      const v = T.Rechnung.verlauf(id, s.workouts.filter((w) => w.start >= a && w.start < b), u.art, k);
      return v.length ? Math.max(...v.map((p) => p.e1rm)) : 0;
    };
    const jetzt = best(von, bis), vor = best(vorVon, von);
    if (jetzt <= 0 || vor <= 0 || jetzt <= vor * 1.005) return null;
    const pct = (jetzt / vor - 1) * 100;
    return [pct, `${u.name}: ${T.Format.kg(jetzt)} geschätztes Maximum, +${T.Format.kg(jetzt - vor)} (+${Math.round(pct)} %)`];
  }).filter(Boolean).sort((a, b) => b[0] - a[0]).slice(0, 3).map((x) => x[1]);
}

/** Muskelgruppen im Wochenziel (mindestens [min] harte Sätze, bei längeren Zeiträumen im Schnitt je Woche). */
export const imZiel = (w, min) => T.MUSKELN.filter((m) => (w.muskeln[m] || 0) >= min);

function cardioLob(w, woche, t) {
  const c = w.cardio;
  if (c.leer) return null;
  if (!woche) {
    const je = Math.round(c.zielMinuten / w.wochen);
    return w.wochenGesamt > 0 && w.cardioWochenGeschafft >= w.wochenGesamt * 0.75
      ? `🫀 Ausdauerziel (WHO) in ${w.cardioWochenGeschafft} von ${w.wochenGesamt} Wochen geschafft`
      : `🏃 ${c.zielMinuten} min Ausdauer, Ø ${je} min je Woche`;
  }
  if (c.geschafft && c.kraftTage >= T.Cardio.KRAFT_TAGE) return `🫀 WHO-Empfehlung komplett: ${c.zielMinuten} min Ausdauer und ${c.kraftTage} Krafttage`;
  if (c.geschafft) return `🫀 Ausdauerziel geschafft: ${c.zielMinuten} von ${c.ziel} min`;
  if (w.vorwocheCardio > 0 && c.zielMinuten > w.vorwocheCardio) return `🏃 ${c.zielMinuten} min Ausdauer – ${c.zielMinuten - w.vorwocheCardio} mehr als ${t.vorher}`;
  return `🏃 ${c.zielMinuten} min Ausdauer gesammelt`;
}

export function trainingLob(w, s, art) {
  const t = Art[art];
  const woche = art === 'WOCHE';
  const r = [];
  if (w.leer) return r;
  const cl = cardioLob(w, woche, t);
  if (cl) r.push(cl);
  if (w.trainings === 0) return r;
  if (woche) {
    const mehr = w.trainings - w.vorwocheTrainings;
    r.push(w.vorwocheTrainings > 0 && mehr > 0 ? `🏋 ${w.trainings} Trainings – ${mehr === 1 ? 'eins' : mehr} mehr als ${t.vorher}`
      : w.trainings >= 3 ? `🏋 ${w.trainings} Trainings ${t.diese} – stark!`
        : `🏋 ${w.trainings === 1 ? '1 Training' : `${w.trainings} Trainings`} geschafft`);
  } else {
    const je = zahl(w.jeWoche, 1);
    r.push(w.vorwocheTrainings > 0 && w.jeWoche > w.vorJeWoche * 1.05 ? `🏋 ${w.trainings} Trainings, Ø ${je} je Woche – mehr als ${t.vorher}`
      : w.jeWoche >= 2.5 ? `🏋 ${w.trainings} Trainings ${t.diese}, Ø ${je} je Woche – stark!`
        : `🏋 ${w.trainings} Trainings ${t.diese} geschafft`);
    if (w.wochenGesamt >= 3 && w.wochenMitTraining >= w.wochenGesamt * 0.75) r.push(`🔥 In ${w.wochenMitTraining} von ${w.wochenGesamt} Wochen trainiert`);
  }
  if (w.planSoll > 0 && w.trainings >= w.planSoll) r.push(`✅ Plan erfüllt: ${w.trainings} von ${w.planSoll} Trainings`);
  const vol = w.volumen / w.wochen, volVor = w.vorwocheVolumen / w.vorWochen;
  if (volVor > 0 && vol > volVor * 1.05) r.push(`📈 Bewegtes Gewicht${woche ? '' : ' je Woche'} +${Math.round((vol / volVor - 1) * 100)} % gegenüber ${t.gegenueber}`);
  if (w.rekorde.length) {
    const namen = w.rekorde.map((x) => x.split(':')[0]);
    r.push(`🏆 Neue Bestwerte: ${namen.slice(0, 4).join(', ')}${namen.length > 4 ? ` und ${namen.length - 4} weitere` : ''}`);
  }
  if (w.steigerungen.length) r.push(`💪 ${w.steigerungen[0]}${woche ? '' : ` gegenüber ${t.gegenueber}`}`);
  if (woche) {
    const geschafft = (w.planProWoche > 0 && w.trainings >= w.planProWoche) || (w.planProWoche === 0 && w.trainings > 0);
    const serie = w.serie + (geschafft ? 1 : 0);
    if (serie >= 2) r.push(`🔥 ${serie} Wochen in Folge ${w.planProWoche > 0 ? 'deinen Plan geschafft' : 'trainiert'}`);
  }
  const min = s.einstellungen.wochenzielMin;
  const ziel = imZiel(w, min);
  if (ziel.length >= 6) r.push(`🎯 ${ziel.length} Muskelgruppen im Wochenziel (${woche ? '' : 'Ø '}ab ${min} harten Sätzen${woche ? '' : ' je Woche'})`);
  return r;
}

export function trainingTipps(w, s, art) {
  const woche = art === 'WOCHE';
  const c = w.cardio;
  const r = [];
  if (!c.geschafft && (w.trainings > 0 || !c.leer)) {
    if (woche) {
      const tipp = c.offen <= 30 ? 'eine kurze Runde mehr reicht' : `z. B. 2× ${Math.min(60, Math.floor((c.offen + 1) / 2))} min Radeln oder zügig Gehen`;
      r.push(`Ausdauer ${c.zielMinuten} von ${c.ziel} min (WHO) – für die fehlenden ${c.offen} min ${tipp}.`);
    } else {
      r.push(`Ausdauer im Schnitt ${Math.round(c.zielMinuten / w.wochen)} von ${s.einstellungen.cardioZielMin} min je Woche (WHO) – öfter mal Radeln oder zügig Gehen einplanen.`);
    }
  }
  if (w.planProWoche > 0 && w.planFaellig > w.trainings) {
    const offen = (woche ? Math.min(w.planFaellig, w.planProWoche) : w.planFaellig) - w.trainings;
    if (offen > 0) r.push(`${offen === 1 ? '1 Plan-Training' : `${offen} Plan-Trainings`} offen – ${woche ? 'nächste Woche' : 'im nächsten Zeitraum'} wieder voll angreifen.`);
  }
  if (w.trainings >= 2) {
    const wenig = T.MUSKELN.filter((m) => (w.muskeln[m] || 0) >= 0.01 && (w.muskeln[m] || 0) <= s.einstellungen.wochenzielMin / 2);
    if (wenig.length) r.push(`Kaum trainiert: ${wenig.slice(0, 4).map((m) => T.Muskel[m].titel).join(', ')} – vielleicht eine Übung dazunehmen.`);
  }
  const viel = T.MUSKELN.filter((m) => (w.muskeln[m] || 0) > s.einstellungen.wochenzielMax * 1.25);
  if (viel.length) r.push(`Sehr viel für ${viel.map((m) => T.Muskel[m].titel).join(', ')} – auf genug Erholung achten.`);
  return r;
}

/** Beitrag des Trainings; null, wenn es nichts zu sagen gibt. */
export function trainingBeitrag(s, z, jetzt, koerper) {
  const woche = z.art === 'WOCHE';
  const vk = Art[z.art].vorKurz;
  const w = trainingZahlen(s, z, jetzt, koerper);
  const lob = trainingLob(w, s, z.art);
  const tipps = trainingTipps(w, s, z.art);
  // Ohne Training und ohne Plan gibt es nichts zu sagen; mit Plan erinnert der Abschnitt an die offenen Trainings.
  if (w.leer && (w.planProWoche === 0 || !tipps.length)) return null;
  const c = w.cardio;
  const k = [];
  if (w.trainings > 0 || w.planProWoche > 0 || c.leer) {
    k.push(kennzahl('Trainings', `${w.trainings}`, [
      w.planSoll > 0 ? `Plan ${w.planSoll}` : null,
      woche ? null : `Ø ${zahl(w.jeWoche, 1)} je Woche`,
      !woche && w.wochenGesamt > 0 ? `in ${w.wochenMitTraining} von ${w.wochenGesamt} Wochen` : null,
      `${vk} ${w.vorwocheTrainings}`,
    ].filter(Boolean).join(' · '), w.planSoll > 0 ? Math.min(1, w.trainings / w.planSoll) : null,
    trend(w.jeWoche, w.vorJeWoche > 0 ? w.vorJeWoche : null, woche ? 0 : 0.05)));
  }
  if (w.minuten > 0) k.push(kennzahl('Trainingszeit', T.Format.dauer(w.minuten * 60), `Ø ${Math.floor(w.minuten / Math.max(1, w.trainings))} min je Training`));
  if (w.saetze > 0) k.push(kennzahl('Arbeitssätze', `${w.saetze}`));
  if (w.volumen > 0) {
    k.push(kennzahl('Bewegtes Gewicht', T.Format.kg(w.volumen), w.vorwocheVolumen > 0 ? `${vk} ${T.Format.kg(w.vorwocheVolumen)}` : null, null,
      trend(w.volumen / w.wochen, w.vorwocheVolumen > 0 ? w.vorwocheVolumen / w.vorWochen : null)));
  }
  if (!c.leer || w.trainings > 0) {
    k.push(kennzahl('Ausdauer (WHO)', `${c.zielMinuten} von ${c.ziel} min`, [
      c.jeSport.slice(0, 3).map(([n, m]) => `${n} ${m} min`).join(', ') || null,
      c.intensivMinuten > 0 ? `${c.intensivMinuten} min intensiv` : null,
      !woche && w.wochenGesamt > 0 ? `Ziel in ${w.cardioWochenGeschafft} von ${w.wochenGesamt} Wochen` : null,
      `${vk} ${w.vorwocheCardio} min`,
    ].filter(Boolean).join(' · '), c.anteil, trend(c.zielMinuten / w.wochen, w.vorwocheCardio > 0 ? w.vorwocheCardio / w.vorWochen : null)));
  }
  if (w.rekorde.length) k.push(kennzahl('Neue Bestwerte', `${w.rekorde.length}`, w.rekorde.slice(0, 3).join('\n')));
  if (w.trainings > 0) {
    const min = s.einstellungen.wochenzielMin;
    const ziel = imZiel(w, min);
    const trainiert = T.MUSKELN.filter((m) => (w.muskeln[m] || 0) > 0).length;
    k.push(kennzahl('Muskelgruppen im Wochenziel', `${ziel.length} von ${trainiert}`,
      (woche ? `ab ${min} harten Sätzen` : `Ø ab ${min} harten Sätzen je Woche`) + (ziel.length ? ': ' + ziel.slice(0, 6).map((m) => T.Muskel[m].titel).join(', ') : ''),
      trainiert > 0 ? ziel.length / trainiert : null));
  }
  const kurz = (w.trainings === 0 && !c.leer ? `${c.zielMinuten} min Ausdauer`
    : w.leer ? 'kein Training'
      : w.planSoll > 0 ? `${w.trainings}/${w.planSoll} Trainings`
        : w.trainings === 1 ? '1 Training' : `${w.trainings} Trainings`)
    + (w.trainings > 0 && !c.leer ? ` · ${c.zielMinuten} min Ausdauer` : '') + (w.rekorde.length ? ` · ${w.rekorde.length} 🏆` : '');
  return { titel: 'Training', symbol: '🏋️', kurz, kennzahlen: k, lob, tipps };
}

/** Alle Beiträge für [z]: Training zuerst, dann Food & Boost (wie die Reihenfolge der Android-Übersicht). */
export function beitraege(food, training, z, jetzt) {
  const kg = T.koerperKg(training, food.koerper.gewichtKg);
  return [trainingBeitrag(training, z, jetzt, kg), foodBeitrag(food, training, z, jetzt)].filter(Boolean);
}
