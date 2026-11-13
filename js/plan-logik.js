// „Bau mir einen Trainingsplan“ (Port von features/krafttraining/logic Plan.kt und Fortschritt.kt der Android-App):
// aus Häufigkeit, Ziel, optionalem Schwerpunkt, Dauer und Ausstattung entsteht ein Wochenplan mit Übungen aus dem
// eingebauten Katalog, dazu Gewichtsvorschläge (doppelte Progression) und eine motivierende Zusammenfassung.
// Gleiche Antworten ergeben denselben Plan wie in der Android-App; „Neu mischen“ wählt über variante andere Übungen.
import { BEWEGUNGEN, katalogNachId, Rechnung, Format, uebungMap, Geraet } from './training-logik.js';

const TAG = 86_400_000;

export const Ziel = {
  ABNEHMEN: { titel: 'Abnehmen', symbol: '🔥', beschreibung: 'Kraft erhalten, viele Muskeln pro Einheit, kurze Pausen und Ausdauer am Ende.' },
  MUSKELAUFBAU: { titel: 'Muskelaufbau', symbol: '💪', beschreibung: '8–12 Wiederholungen, 3–4 Sätze, mittlere Pausen.' },
  KRAFT: { titel: 'Kraft', symbol: '🏋', beschreibung: 'Schwere Grundübungen mit 4–6 Wiederholungen und langen Pausen.' },
  AUSDAUER: { titel: 'Ausdauer', symbol: '🏃', beschreibung: 'Leichtere Gewichte mit vielen Wiederholungen, kurze Pausen, längere Ausdauer-Einheiten.' },
  FIT: { titel: 'Fit & gesund', symbol: '🌿', beschreibung: 'Ausgewogen: alle großen Muskeln, etwas Ausdauer, gut für den Alltag.' },
};
export const ZIELE = Object.keys(Ziel);

/** Optionaler Schwerpunkt: bekommt eine Extra-Übung und einen Satz mehr. */
export const Schwerpunkt = {
  BEINE: { titel: 'Beine', muskeln: ['QUADRIZEPS', 'BEINBEUGER', 'ADDUKTOREN', 'WADEN'] },
  PO: { titel: 'Po', muskeln: ['GESAESS'] },
  BRUST: { titel: 'Brust', muskeln: ['BRUST'] },
  RUECKEN: { titel: 'Rücken', muskeln: ['LAT', 'TRAPEZ', 'UNTERER_RUECKEN'] },
  SCHULTERN: { titel: 'Schultern', muskeln: ['SCHULTERN'] },
  ARME: { titel: 'Arme', muskeln: ['BIZEPS', 'TRIZEPS'] },
  BAUCH: { titel: 'Bauch', muskeln: ['BAUCH'] },
};
export const SCHWERPUNKTE = Object.keys(Schwerpunkt);

export const Ausstattung = {
  STUDIO: { titel: 'Fitnessstudio', beschreibung: 'Hanteln, Kabelzug und Maschinen' },
  ZUHAUSE: { titel: 'Zuhause mit Kurzhanteln', beschreibung: 'Kurzhanteln, Kettlebell, Band und Körpergewicht' },
  OHNE: { titel: 'Ohne Geräte', beschreibung: 'Nur Körpergewicht und ein Widerstandsband' },
};
export const AUSSTATTUNGEN = Object.keys(Ausstattung);

export const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const WOCHENTAGE_LANG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

const floorMod = (a, n) => ((a % n) + n) % n;
const liste = (x) => (Array.isArray(x) ? x : []);
const zahl = (x, d) => (typeof x === 'number' && Number.isFinite(x) ? x : d);

/** 1 = Montag … 7 = Sonntag (wie java.time.DayOfWeek). */
export const wochentag = (ms) => ((new Date(ms).getDay() + 6) % 7) + 1;
/** Mitternacht (lokal) des Tages von [ms], plus [tage]. */
export function tagBeginn(ms, tage = 0) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + tage);
  return d.getTime();
}

export const wunsch = (w = {}) => ({
  wochentage: liste(w.wochentage).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7),
  ziel: w.ziel in Ziel ? w.ziel : 'MUSKELAUFBAU',
  schwerpunkte: liste(w.schwerpunkte).filter((s) => s in Schwerpunkt),
  minuten: zahl(w.minuten, 60),
  ausstattung: w.ausstattung in Ausstattung ? w.ausstattung : 'STUDIO',
  variante: zahl(w.variante, 0),
});

const planUebungLesen = (p = {}) => ({
  uebungId: String(p.uebungId || ''), saetze: zahl(p.saetze, 3), wdhVon: zahl(p.wdhVon, 8), wdhBis: zahl(p.wdhBis, 12),
  pauseSek: zahl(p.pauseSek, 90), sekunden: zahl(p.sekunden, 0), minuten: zahl(p.minuten, 0), slot: String(p.slot || ''),
});

/** Plan aus JSON (auch aus der Android-Sicherung, dort fehlen Standardwerte); null, wenn keiner. */
export function planLesen(o) {
  if (!o || typeof o !== 'object' || !Array.isArray(o.tage)) return null;
  return {
    name: String(o.name || 'Trainingsplan'), erstellt: zahl(o.erstellt, 0), wunsch: wunsch(o.wunsch || {}),
    tage: o.tage.map((t) => ({ name: String(t?.name || ''), wochentag: zahl(t?.wochentag, 1), uebungen: liste(t?.uebungen).map(planUebungLesen) })),
  };
}

const proWoche = (w) => new Set(w.wochentage).size;

/** Vorschlag für die Trainingstage bei [n] Trainings pro Woche (mit Ruhetagen dazwischen). */
export function standardTage(n) {
  switch (Math.min(6, Math.max(1, n))) {
    case 1: return [3];
    case 2: return [1, 4];
    case 3: return [1, 3, 5];
    case 4: return [1, 2, 4, 5];
    case 5: return [1, 2, 3, 5, 6];
    default: return [1, 2, 3, 4, 5, 6];
  }
}

// ---------- Parameter je Ziel ----------

function dosis(z, grund) {
  switch (z) {
    case 'KRAFT': return grund ? [4, 4, 6, 180] : [3, 6, 10, 120];
    case 'MUSKELAUFBAU': return grund ? [4, 6, 10, 120] : [3, 10, 12, 75];
    case 'ABNEHMEN': return grund ? [3, 8, 12, 75] : [3, 12, 15, 45];
    case 'AUSDAUER': return grund ? [3, 12, 15, 60] : [2, 15, 20, 45];
    default: return grund ? [3, 8, 12, 90] : [3, 10, 15, 60];
  }
}
const cardioMinuten = (z) => ({ ABNEHMEN: 20, AUSDAUER: 25, FIT: 10 })[z] || 0;
const halteSekunden = (z) => (z === 'KRAFT' || z === 'MUSKELAUFBAU' ? 45 : z === 'AUSDAUER' ? 60 : 40);

// ---------- Bausteine ----------

const S = (key, grund, kandidaten) => ({ key, grund, kandidaten });
const SLOTS = Object.fromEntries([
  S('knie', true, ['kniebeuge', 'beinpresse', 'goblet', 'hackenschmidt', 'bulgarisch', 'ausfallschritt', 'stepup']),
  S('huefte', true, ['rumaenisch', 'hipthrust', 'kreuzheben', 'kbswing', 'glutebridge', 'bulgarisch']),
  S('drueckenH', true, ['bankdruecken', 'schraegbank', 'brustpresse', 'liegestuetz', 'dips']),
  S('drueckenV', true, ['schulterdruecken', 'arnold', 'pushpress', 'liegestuetz']),
  S('ziehenV', true, ['latzug', 'klimmzug', 'chinup', 'pullover', 'facepull']),
  S('ziehenH', true, ['kabelrudern', 'rudern', 'einarm', 'brustgestuetzt', 'tbar', 'facepull']),
  S('brust', false, ['fliegende', 'butterfly', 'kabelcross', 'schraegbank', 'liegestuetz']),
  S('schulter', false, ['seitheben', 'reversefly', 'facepull', 'frontheben', 'rotatoren']),
  S('schulterHinten', false, ['reversefly', 'facepull', 'rotatoren']),
  S('bizeps', false, ['bizepscurl', 'hammercurl', 'scottcurl', 'schraegcurl', 'konzentration', 'chinup']),
  S('trizeps', false, ['trizepsdruecken', 'trizepsueberkopf', 'stirndruecken', 'trizepsdips', 'kickback']),
  S('quad', false, ['beinstrecker', 'ausfallschritt', 'bulgarisch', 'stepup', 'goblet']),
  S('beinbeuger', false, ['beincurl', 'beincurlsitz', 'rumaenisch', 'glutebridge']),
  S('po', false, ['hipthrust', 'kickbackbein', 'abduktor', 'glutebridge', 'ausfallschritt', 'stepup']),
  S('adduktoren', false, ['adduktor', 'sumo', 'goblet', 'ausfallschritt']),
  S('waden', false, ['wadenstehend', 'wadensitzend', 'wadenpresse']),
  S('bauch', false, ['plank', 'kabelcrunch', 'beinheben', 'crunch', 'abroller', 'russian']),
  S('ruecken', false, ['hyperext', 'glutebridge', 'goodmorning']),
  S('lat', false, ['pullover', 'latzugeng', 'einarm']),
  S('nacken', false, ['shrugs', 'facepull', 'reversefly']),
  S('unterarme', false, ['handgelenk', 'hammercurl', 'farmer']),
].map((s) => [s.key, s]));

const SLOT_JE_MUSKEL = {
  QUADRIZEPS: 'quad', BEINBEUGER: 'beinbeuger', ADDUKTOREN: 'adduktoren', WADEN: 'waden', GESAESS: 'po', BRUST: 'brust', LAT: 'lat',
  TRAPEZ: 'nacken', UNTERER_RUECKEN: 'ruecken', SCHULTERN: 'schulter', BIZEPS: 'bizeps', TRIZEPS: 'trizeps', UNTERARME: 'unterarme', BAUCH: 'bauch',
};

// Alle Muskelgruppen (Ganzkörper-Tag)
const MUSKEL_REIHE = ['BRUST', 'SCHULTERN', 'BIZEPS', 'TRIZEPS', 'UNTERARME', 'BAUCH', 'QUADRIZEPS', 'ADDUKTOREN', 'LAT', 'TRAPEZ', 'UNTERER_RUECKEN', 'GESAESS', 'BEINBEUGER', 'WADEN'];

const TagTyp = {
  GANZ: { titel: 'Ganzkörper', slots: ['knie', 'drueckenH', 'ziehenV', 'huefte', 'drueckenV', 'ziehenH', 'bauch', 'bizeps', 'trizeps', 'waden'], bereich: MUSKEL_REIHE },
  OBEN: { titel: 'Oberkörper', slots: ['drueckenH', 'ziehenH', 'drueckenV', 'ziehenV', 'schulter', 'bizeps', 'trizeps', 'brust', 'nacken'], bereich: ['BRUST', 'SCHULTERN', 'BIZEPS', 'TRIZEPS', 'UNTERARME', 'LAT', 'TRAPEZ', 'BAUCH'] },
  UNTEN: { titel: 'Unterkörper', slots: ['knie', 'huefte', 'quad', 'beinbeuger', 'po', 'waden', 'bauch', 'ruecken', 'adduktoren'], bereich: ['QUADRIZEPS', 'BEINBEUGER', 'GESAESS', 'ADDUKTOREN', 'WADEN', 'UNTERER_RUECKEN', 'BAUCH'] },
  DRUECKEN: { titel: 'Drücken (Brust, Schultern, Trizeps)', slots: ['drueckenH', 'drueckenV', 'brust', 'schulter', 'trizeps', 'drueckenH', 'trizeps'], bereich: ['BRUST', 'SCHULTERN', 'TRIZEPS'] },
  ZIEHEN: { titel: 'Ziehen (Rücken, Bizeps)', slots: ['ziehenV', 'ziehenH', 'lat', 'schulterHinten', 'bizeps', 'nacken', 'bizeps', 'unterarme'], bereich: ['LAT', 'TRAPEZ', 'BIZEPS', 'UNTERARME', 'UNTERER_RUECKEN'] },
  BEINE: { titel: 'Beine & Po', slots: ['knie', 'huefte', 'quad', 'beinbeuger', 'po', 'waden', 'bauch'], bereich: ['QUADRIZEPS', 'BEINBEUGER', 'GESAESS', 'ADDUKTOREN', 'WADEN', 'BAUCH'] },
  CARDIO: { titel: 'Ausdauer & Rumpf', slots: ['bauch', 'ruecken', 'bauch'], bereich: ['BAUCH', 'UNTERER_RUECKEN'] },
};

function aufteilung(n, z) {
  const k = z === 'KRAFT' || z === 'MUSKELAUFBAU';
  const { GANZ, OBEN, UNTEN, DRUECKEN, ZIEHEN, BEINE, CARDIO } = TagTyp;
  switch (Math.min(6, Math.max(1, n))) {
    case 1: return [GANZ];
    case 2: return [GANZ, GANZ];
    case 3: return [GANZ, GANZ, GANZ];
    case 4: return k || z === 'FIT' ? [OBEN, UNTEN, OBEN, UNTEN] : [GANZ, CARDIO, GANZ, GANZ];
    case 5: return k ? [DRUECKEN, ZIEHEN, BEINE, OBEN, UNTEN] : [GANZ, CARDIO, GANZ, CARDIO, GANZ];
    default: return k ? [DRUECKEN, ZIEHEN, BEINE, DRUECKEN, ZIEHEN, BEINE] : [GANZ, CARDIO, GANZ, CARDIO, GANZ, CARDIO];
  }
}

// ---------- Ausstattung ----------

const NULL_IM_STUDIO = new Set(['trapbar', 'tbar', 'hyperext', 'klimmzug', 'chinup', 'beinheben', 'dips', 'farmer', 'rudergeraet', 'crosstrainer', 'schwimmen']);
const NULL_OHNE_GERAET = new Set(['ausfallschritt', 'bulgarisch', 'stepup', 'glutebridge', 'wadenstehend']);
const REIHENFOLGE = {
  STUDIO: ['LH', 'KH', 'KABEL', 'MASCHINE', 'SMITH', 'EZ', 'KB', null, 'KOERPER', 'BAND'],
  ZUHAUSE: ['KH', 'KB', null, 'KOERPER', 'BAND'],
  OHNE: [null, 'KOERPER', 'BAND'],
};
const bewegungNachKey = Object.fromEntries(BEWEGUNGEN.map((b) => [b.key, b]));
const idVon = (b, g) => (g == null ? b.key : `${b.key}-${Geraet[g].kurz}`);
const basis = (id) => id.split('-')[0];

/** Katalogübung für eine Bewegung mit der gewählten Ausstattung, oder null, wenn es damit nicht geht. */
export function uebungFuer(key, a) {
  const b = bewegungNachKey[key];
  if (!b) return null;
  const geht = (g) => b.geraete.includes(g) && (g != null || a === 'STUDIO' || (!NULL_IM_STUDIO.has(key) && (b.art !== 'GEWICHT' || NULL_OHNE_GERAET.has(key))));
  const g = REIHENFOLGE[a].find(geht);
  if (g === undefined) return null;
  return katalogNachId[idVon(b, g)] || null;
}

const cardioUebungen = (a) => (a === 'STUDIO' ? ['crosstrainer', 'radfahren', 'rudergeraet', 'laufen'] : ['laufen', 'seilspringen', 'laufen']);

// ---------- Plan bauen ----------

function planUebung(u, slot, z, extra, grund) {
  const [saetze, von, bis, pause] = dosis(z, grund);
  if (u.art === 'ZEIT') return { uebungId: u.id, saetze, wdhVon: 0, wdhBis: 0, pauseSek: Math.min(pause, 60), sekunden: halteSekunden(z), minuten: 0, slot: slot.key };
  if (u.art === 'CARDIO') return { uebungId: u.id, saetze: 1, wdhVon: 0, wdhBis: 0, pauseSek: 0, sekunden: 0, minuten: Math.max(10, cardioMinuten(z)), slot: slot.key };
  return { uebungId: u.id, saetze: saetze + (extra ? 1 : 0), wdhVon: von, wdhBis: bis, pauseSek: pause, sekunden: 0, minuten: 0, slot: slot.key };
}

function waehle(slot, w, versatz, schon) {
  const moeglich = slot.kandidaten.map((k) => uebungFuer(k, w.ausstattung)).filter((u) => u && !schon.has(basis(u.id)));
  return moeglich.length ? moeglich[floorMod(versatz, moeglich.length)] : null;
}

function tagBauen(typ, w, versatz, fokus) {
  const z = w.ziel;
  const cardioMin = typ === TagTyp.CARDIO
    ? Math.min(z === 'AUSDAUER' ? 60 : 45, Math.max(20, Math.floor(w.minuten * 3 / 4)))
    : Math.min(cardioMinuten(z), Math.floor(w.minuten / 3));
  const fokusSlots = typ === TagTyp.CARDIO ? []
    : [...new Set([...fokus].filter((m) => typ.bereich.includes(m)).map((m) => SLOT_JE_MUSKEL[m]))].slice(0, 2);
  const slots = [...typ.slots.slice(0, 3), ...fokusSlots, ...typ.slots.slice(3)];

  let cardio = null;
  if (cardioMin > 0) {
    const l = cardioUebungen(w.ausstattung);
    const c = katalogNachId[l[floorMod(versatz, l.length)]];
    if (c) cardio = { uebungId: c.id, saetze: 1, wdhVon: 0, wdhBis: 0, pauseSek: 0, sekunden: 0, minuten: cardioMin, slot: 'cardio' };
  }
  const mindestens = typ === TagTyp.CARDIO ? 2 : 3;
  const hoechstens = typ === TagTyp.CARDIO ? 4 : z === 'AUSDAUER' || z === 'ABNEHMEN' ? 7 : 8;
  const gewaehlt = [];
  const schon = new Set();
  slots.forEach((key, i) => {
    if (gewaehlt.ende) return;
    const slot = SLOTS[key];
    const wiederholt = slots.slice(0, i).filter((k) => k === key).length;
    const u = waehle(slot, w, versatz + wiederholt, schon);
    if (!u) return;
    const extra = fokus.size > 0 && u.primaer.some((m) => fokus.has(m));
    const p = planUebung(u, slot, z, extra, slot.grund && gewaehlt.length < 3);
    const probe = { uebungen: [...gewaehlt, p, ...(cardio ? [cardio] : [])] };
    if ((gewaehlt.length >= mindestens && dauerMinuten(probe) > w.minuten + 3) || gewaehlt.length >= hoechstens) { gewaehlt.ende = true; return; }
    schon.add(basis(u.id));
    gewaehlt.push(p);
  });
  const ergebnis = [...gewaehlt];
  if (cardio) { if (typ === TagTyp.CARDIO || z === 'FIT') ergebnis.unshift(cardio); else ergebnis.push(cardio); }
  return ergebnis;
}

export function bauen(wunschRoh, jetzt = Date.now()) {
  const w = wunsch(wunschRoh);
  let tage = [...new Set(w.wochentage)].sort((a, b) => a - b);
  if (!tage.length) tage = standardTage(3);
  const typen = aufteilung(tage.length, w.ziel);
  const fokus = new Set(w.schwerpunkte.flatMap((s) => Schwerpunkt[s].muskeln));
  const zaehler = new Map();
  const planTage = tage.map((tag, i) => {
    const typ = typen[i];
    const nr = zaehler.get(typ) || 0;
    zaehler.set(typ, nr + 1);
    const gleich = typen.filter((t) => t === typ).length;
    const buchstabe = gleich > 1 ? ' ' + String.fromCharCode(65 + nr) : '';
    return { name: typ.titel + buchstabe, wochentag: tag, uebungen: tagBauen(typ, w, nr + w.variante, fokus) };
  });
  const name = `${Ziel[w.ziel].titel} · ${tage.length}× pro Woche` + (w.schwerpunkte.length ? ' · ' + w.schwerpunkte.map((s) => Schwerpunkt[s].titel).join(' + ') : '');
  return { name, erstellt: jetzt, wunsch: { ...w, wochentage: tage }, tage: planTage };
}

/** Alternativen für eine Übung im Plan (gleicher Baustein, gleiche Ausstattung), ohne die schon am Tag geplanten. */
export function alternativen(plan, tag, p) {
  const andere = new Set(tag.uebungen.filter((x) => x !== p).map((x) => basis(x.uebungId)));
  const cardio = p.slot === 'cardio';
  const keys = cardio ? [...cardioUebungen(plan.wunsch.ausstattung), 'radfahren', 'laufen', 'seilspringen'] : SLOTS[p.slot]?.kandidaten || [];
  const ges = new Set();
  return [...new Set(keys)].map((k) => (cardio ? katalogNachId[k] : uebungFuer(k, plan.wunsch.ausstattung)))
    .filter((u) => u && (u.id === p.uebungId || !andere.has(basis(u.id))))
    .filter((u) => (ges.has(u.id) ? false : (ges.add(u.id), true)));
}

/** Übung [index] am Tag [tagIndex] durch die nächste Alternative ersetzen. */
export function tauschen(plan, tagIndex, index) {
  const tag = plan.tage[tagIndex];
  const p = tag?.uebungen[index];
  if (!p) return plan;
  const alt = alternativen(plan, tag, p);
  if (alt.length < 2) return plan;
  const pos = alt.findIndex((u) => u.id === p.uebungId);
  const neu = alt[floorMod(pos + 1, alt.length)];
  let ersetzt;
  if (neu.art === 'ZEIT') ersetzt = { ...p, uebungId: neu.id, wdhVon: 0, wdhBis: 0, sekunden: p.sekunden > 0 ? p.sekunden : halteSekunden(plan.wunsch.ziel) };
  else if (neu.art === 'CARDIO') ersetzt = { ...p, uebungId: neu.id };
  else if (p.sekunden > 0) { const [, von, bis] = dosis(plan.wunsch.ziel, false); ersetzt = { ...p, uebungId: neu.id, sekunden: 0, wdhVon: von, wdhBis: bis }; }
  else ersetzt = { ...p, uebungId: neu.id };
  return { ...plan, tage: plan.tage.map((t, i) => (i !== tagIndex ? t : { ...t, uebungen: t.uebungen.map((x, j) => (j === index ? ersetzt : x)) })) };
}

// ---------- Heute und demnächst ----------

/** Plan-Tag am Tag von [ms] oder null. */
export const heute = (plan, ms) => plan.tage.find((t) => t.wochentag === wochentag(ms)) || null;

/** Nächster Trainingstag ab dem Tag von [ms] (einschließlich): { tagMs, tag }. */
export function naechster(plan, ms) {
  if (!plan.tage.length) return null;
  for (let i = 0; i <= 7; i++) {
    const d = tagBeginn(ms, i);
    const t = heute(plan, d);
    if (t) return { tagMs: d, tag: t };
  }
  return null;
}

export function dauerMinuten(tag) {
  const sek = tag.uebungen.reduce((a, p) => a + (p.minuten > 0 ? p.minuten * 60 : p.sekunden > 0 ? p.saetze * (p.sekunden + p.pauseSek) : p.saetze * (40 + p.pauseSek)), 0);
  return Math.floor((sek + 300) / 60 / 5) * 5;
}

export function vorgabe(p) {
  if (p.minuten > 0) return `${p.minuten} min`;
  if (p.sekunden > 0) return `${p.saetze} × ${p.sekunden} s`;
  return p.wdhVon === p.wdhBis ? `${p.saetze} × ${p.wdhVon}` : `${p.saetze} × ${p.wdhVon}–${p.wdhBis}`;
}

// ---------- Steigerung ----------

/** Gewichtsschritt je Gerät: Kurzhanteln, Kabel und Kettlebell in kleineren Sprüngen, Beine größer. */
export function schritt(u) {
  const g = u.id.includes('-') ? u.id.slice(u.id.indexOf('-') + 1) : '';
  if (['kh', 'kabel', 'kb', 'band'].includes(g)) return 2;
  return u.primaer.some((m) => ['QUADRIZEPS', 'GESAESS', 'BEINBEUGER'].includes(m)) ? 5 : 2.5;
}

const satz = (s) => ({ gewicht: 0, wdh: 0, sekunden: 0, meter: 0, rpe: null, typ: 'NORMAL', erledigt: false, ...s });
const wiederhole = (n, s) => Array.from({ length: n }, () => satz(s));

/** Sätze für heute aus dem letzten Mal: alle Wiederholungen oben geschafft → mehr Gewicht, sonst eine Wdh. mehr. */
export function vorschlag(p, u, workouts, vor = Infinity) {
  const letzte = Rechnung.letzteSaetze(p.uebungId, workouts, vor).filter(Rechnung.zaehlt);
  if (u.art === 'CARDIO') {
    const m = letzte.reduce((a, s) => a + s.meter, 0);
    return { saetze: [satz({ sekunden: p.minuten * 60 })], hinweis: m > 0 ? `Letztes Mal ${Format.strecke(m)}` : '', steigerung: false };
  }
  if (u.art === 'ZEIT') {
    const best = letzte.length ? Math.max(...letzte.map((s) => s.sekunden)) : 0;
    const hoch = best > 0 && best >= p.sekunden;
    const sek = hoch ? best + 5 : p.sekunden;
    return { saetze: wiederhole(p.saetze, { sekunden: sek, gewicht: letzte[0]?.gewicht || 0 }), hinweis: hoch ? `↑ ${sek} s – letztes Mal ${best} s gehalten` : '', steigerung: hoch };
  }
  if (!letzte.length) {
    return { saetze: wiederhole(p.saetze, { wdh: p.wdhVon }), hinweis: u.art === 'GEWICHT' ? `Erstes Mal: Gewicht wählen, mit dem ${p.wdhBis} Wdh. gerade so gehen` : '', steigerung: false };
  }
  const gewicht = Math.max(...letzte.map((s) => s.gewicht));
  const beim = letzte.filter((s) => s.gewicht === gewicht);
  const alleOben = beim.length >= Math.min(p.saetze, letzte.length) && beim.every((s) => s.wdh >= p.wdhBis);
  const maxWdh = Math.max(...beim.map((s) => s.wdh));
  if (u.art === 'KOERPER' && gewicht <= 0) {
    if (gewicht < 0 && alleOben) return { saetze: wiederhole(p.saetze, { gewicht: Math.min(0, gewicht + 5), wdh: p.wdhVon }), hinweis: '↑ 5 kg weniger Unterstützung', steigerung: true };
    const wdh = Math.max(maxWdh + 1, p.wdhVon);
    return { saetze: wiederhole(p.saetze, { gewicht, wdh }), hinweis: `↑ ${wdh} Wdh. – letztes Mal ${maxWdh}`, steigerung: wdh > maxWdh };
  }
  if (alleOben) {
    const plus = schritt(u);
    return { saetze: wiederhole(p.saetze, { gewicht: gewicht + plus, wdh: p.wdhVon }), hinweis: `↑ +${Format.kg(plus)}: letztes Mal alle Sätze mit ${p.wdhBis}+ Wdh.`, steigerung: true };
  }
  const wdh = Math.min(p.wdhBis, Math.max(p.wdhVon, maxWdh + 1));
  return { saetze: wiederhole(p.saetze, { gewicht, wdh }), hinweis: `${Format.kg(gewicht)} × ${wdh} – Ziel ${p.wdhBis} Wdh., dann mehr Gewicht`, steigerung: false };
}

/** Training für heute aus einem Plan-Tag, mit Vorschlägen und Vorgabe als Notiz je Übung. */
export function workoutAusPlan(tag, uebungen, workouts, id, start) {
  return {
    id, name: tag.name, start, dauerSek: 0, notiz: '', quelle: '',
    bloecke: tag.uebungen.filter((p) => uebungen[p.uebungId]).map((p) => {
      const v = vorschlag(p, uebungen[p.uebungId], workouts, start);
      const pause = p.pauseSek > 0 ? `, Pause ${Format.dauer(p.pauseSek)}` : '';
      return { uebungId: p.uebungId, saetze: v.saetze, notiz: `Plan: ${vorgabe(p)}${pause}` + (v.hinweis ? `\n${v.hinweis}` : ''), pauseSek: p.pauseSek };
    }),
  };
}

function bestwert(id, art, workouts, koerper, von, bis) {
  const v = Rechnung.verlauf(id, workouts.filter((w) => w.start >= von && w.start < bis), art, koerper);
  if (!v.length) return 0;
  return Math.max(...v.map((p) => (art === 'ZEIT' ? p.maxSek : art === 'CARDIO' ? p.meter : p.e1rm)));
}

/** Steigerungen der letzten 4 Wochen (bis einschließlich Tag von [ms]) gegenüber den 4 davor, größte zuerst. */
export function steigerungen(ids, stand, koerper, ms = Date.now()) {
  const bis = tagBeginn(ms, 1), mitte = tagBeginn(ms, -28), anfang = tagBeginn(ms, -56);
  const map = uebungMap(stand);
  return [...new Set(ids)].map((id) => {
    const u = map[id];
    if (!u) return null;
    const jetzt = bestwert(id, u.art, stand.workouts, koerper, mitte, bis);
    let vorher = bestwert(id, u.art, stand.workouts, koerper, anfang, mitte);
    let seit = 'in 4 Wochen';
    if (vorher <= 0) {
      const mit = stand.workouts.filter((w) => w.bloecke.some((b) => b.uebungId === id));
      if (!mit.length) return null;
      const erstes = mit.reduce((a, w) => (w.start < a.start ? w : a));
      if (bis - erstes.start < 14 * TAG) return null;
      vorher = bestwert(id, u.art, [erstes], koerper, 0, Infinity);
      seit = `seit ${Format.datumKurz(erstes.start)}`;
    }
    if (jetzt <= 0 || vorher <= 0 || jetzt <= vorher * 1.005) return null;
    const pct = (jetzt / vorher - 1) * 100;
    const text = u.art === 'ZEIT' ? `${u.name}: ${Math.round(jetzt)} s gehalten, +${Math.round(jetzt - vorher)} s ${seit}`
      : u.art === 'CARDIO' ? `${u.name}: ${Format.strecke(jetzt)}, +${Math.round(pct)} % ${seit}`
        : `${u.name}: ${Format.kg(jetzt)} geschätztes Maximum, +${Format.kg(jetzt - vorher)} (+${Math.round(pct)} %) ${seit}`;
    return { uebung: u, text, prozent: pct };
  }).filter(Boolean).sort((a, b) => b.prozent - a.prozent);
}

const montagMs = (ms) => tagBeginn(ms, -(wochentag(ms) - 1));

/** Wochen in Folge (vor dieser Woche) mit mindestens [ziel] Trainings. */
export function serie(workouts, ziel, ms = Date.now()) {
  if (ziel <= 0) return 0;
  let mo = tagBeginn(montagMs(ms), -7);
  let n = 0;
  while (n < 104) {
    const bis = tagBeginn(mo, 7);
    if (workouts.filter((w) => w.start >= mo && w.start < bis).length >= ziel) n++; else break;
    mo = tagBeginn(mo, -7);
  }
  return n;
}

const SPRUECHE = [
  'Jede Wiederholung zählt – auf geht\'s!',
  'Dranbleiben schlägt Perfektion. 💪',
  'Du musst nicht motiviert sein, nur anfangen.',
  'Heute baust du an der stärkeren Version von dir.',
  'Kleine Schritte, große Wirkung.',
  'Stark wird man nicht an einem Tag – aber an Tagen wie heute.',
  'Die schwerste Hantel ist die Haustür. Danach läuft\'s.',
];
const tagImJahr = (ms) => { const d = new Date(ms); return Math.round((tagBeginn(ms) - new Date(d.getFullYear(), 0, 1).getTime()) / TAG) + 1; };

/**
 * Zusammenfassung für den Tag von [ms] (in Android die Morgen-Benachrichtigung): was ansteht und wie du dich
 * gesteigert hast. null, wenn an dem Tag kein Plan-Training ist oder schon trainiert wurde.
 * Ergebnis: { titel, text, lob: [..], zeilen: [..], spruch }.
 */
export function zusammenfassung(stand, plan, koerper, ms = Date.now()) {
  const tag = heute(plan, ms);
  if (!tag) return null;
  const von = tagBeginn(ms), bis = tagBeginn(ms, 1);
  if (stand.workouts.some((w) => w.start >= von && w.start < bis)) return null;
  const map = uebungMap(stand);
  const steig = steigerungen(tag.uebungen.map((p) => p.uebungId), stand, koerper, tagBeginn(ms, -1));
  const dieseWoche = stand.workouts.filter((w) => w.start >= montagMs(ms) && w.start < von).length;
  const geplantBisHeute = plan.tage.filter((t) => t.wochentag < wochentag(ms)).length;
  const vier = stand.workouts.filter((w) => w.start >= tagBeginn(ms, -28) && w.start < von);
  const davor = stand.workouts.filter((w) => w.start >= tagBeginn(ms, -56) && w.start < tagBeginn(ms, -28));
  const vol = (l) => l.reduce((a, w) => a + Rechnung.zusammenfassung(w, map, koerper).volumen, 0);
  const ser = serie(stand.workouts, proWoche(plan.wunsch), ms);
  const frueher = stand.workouts.filter((w) => w.start < von);
  const pauseTage = frueher.length ? Math.floor((von - Math.max(...frueher.map((w) => w.start))) / TAG) : null;
  const ab = tagBeginn(ms, -30);
  // Übungen mit neuem Bestwert (nicht jede Kennzahl einzeln)
  const rekorde = new Set(stand.workouts.filter((w) => w.start >= ab && w.start < von)
    .flatMap((w) => Rechnung.neueRekorde(w, stand.workouts, map, koerper).map((r) => r.split(':')[0]))).size;

  const dauer = dauerMinuten(tag);
  const zeilen = tag.uebungen.filter((p) => map[p.uebungId]).map((p) => {
    const u = map[p.uebungId];
    const v = vorschlag(p, u, stand.workouts, von);
    const kg = u.art === 'GEWICHT' && v.saetze[0]?.gewicht > 0 ? ` · ${Format.kg(v.saetze[0].gewicht)}` : '';
    return `${u.name} ${vorgabe(p)}${kg}${v.steigerung ? ' ↑' : ''}`;
  });

  const lob = steig.slice(0, 3).map((x) => `📈 ${x.text}`);
  if (vier.length) {
    const trend = !davor.length ? '' : vier.length > davor.length ? ` (davor ${davor.length}) – mehr als vorher!` : vier.length === davor.length ? ' – genauso konstant wie davor' : ` (davor ${davor.length})`;
    lob.push(`🗓 Letzte 4 Wochen: ${vier.length} Trainings${trend}`);
    const vv = vol(vier), vd = vol(davor);
    if (vd > 0 && vv > vd * 1.05) lob.push(`🏋 Bewegtes Gewicht +${Math.round((vv / vd - 1) * 100)} % gegenüber den 4 Wochen davor`);
  }
  if (ser >= 2) lob.push(`🔥 ${ser} Wochen in Folge deinen Plan geschafft`);
  if (rekorde > 0) lob.push(`🏆 Neue Bestwerte bei ${rekorde === 1 ? '1 Übung' : `${rekorde} Übungen`} in den letzten 30 Tagen`);
  if (geplantBisHeute > 0) lob.push(`✅ Diese Woche: ${dieseWoche} von ${proWoche(plan.wunsch)} Trainings erledigt, heute kommt Nr. ${dieseWoche + 1}`);

  const spruch = SPRUECHE[tagImJahr(ms) % SPRUECHE.length];
  let titel, text;
  if (!stand.workouts.length) { titel = `Heute startet dein Plan: ${tag.name} 💪`; text = 'Erstes Training mit deinem neuen Plan – heute legst du den Grundstein.'; }
  else if (pauseTage != null && pauseTage >= 10) { titel = `Willkommen zurück: ${tag.name}`; text = `${pauseTage} Tage Pause sind vorbei. Heute ruhig etwas leichter einsteigen – Hauptsache, du bist da.`; }
  else if (steig.length) { titel = `Heute: ${tag.name} 💪`; text = steig[0].text; }
  else if (ser >= 2) { titel = `Heute: ${tag.name} 🔥`; text = `${ser} Wochen in Folge durchgezogen – mach weiter so!`; }
  else { titel = `Heute: ${tag.name} 💪`; text = `${tag.uebungen.length} Übungen, ca. ${dauer} min. ${spruch}`; }
  return { titel, text, lob: lob.filter((l) => !l.endsWith(text)), zeilen, spruch, dauer };
}
