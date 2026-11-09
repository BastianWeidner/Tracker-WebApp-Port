// Rechenkern des Trainings (Port von features/krafttraining/logic der Android-App): Übungskatalog, Sätze und
// Kennzahlen, Belastung je Muskelgruppe, Kraftniveau, Verbrauch und der Import aus Stronger, Strong, Hevy und FitNotes.
// Datenformat wie in der Android-App (krafttraining.json), damit Sicherungen in beide Richtungen passen.

// ---------- Modell ----------

/** Muskelgruppen. [vorne]: auf der Vorderansicht. [erholungStunden]: bis eine harte Einheit abgeklungen ist. [fach]: Fachbegriff. */
export const Muskel = {
  BRUST: { titel: 'Brust', vorne: true, erholungStunden: 60, fach: 'M. pectoralis major' },
  SCHULTERN: { titel: 'Schultern', vorne: true, erholungStunden: 48, fach: 'M. deltoideus' },
  BIZEPS: { titel: 'Bizeps', vorne: true, erholungStunden: 40, fach: 'M. biceps brachii, M. brachialis' },
  TRIZEPS: { titel: 'Trizeps', vorne: false, erholungStunden: 40, fach: 'M. triceps brachii' },
  UNTERARME: { titel: 'Unterarme', vorne: true, erholungStunden: 36, fach: 'Unterarmbeuger und -strecker, M. brachioradialis' },
  BAUCH: { titel: 'Bauch', vorne: true, erholungStunden: 36, fach: 'M. rectus abdominis, Mm. obliqui' },
  QUADRIZEPS: { titel: 'Oberschenkel vorne', vorne: true, erholungStunden: 72, fach: 'M. quadriceps femoris' },
  ADDUKTOREN: { titel: 'Adduktoren', vorne: true, erholungStunden: 48, fach: 'Mm. adductores' },
  LAT: { titel: 'Latissimus', vorne: false, erholungStunden: 60, fach: 'M. latissimus dorsi' },
  TRAPEZ: { titel: 'Nacken / oberer Rücken', vorne: false, erholungStunden: 48, fach: 'M. trapezius, Mm. rhomboidei' },
  UNTERER_RUECKEN: { titel: 'Unterer Rücken', vorne: false, erholungStunden: 72, fach: 'M. erector spinae' },
  GESAESS: { titel: 'Gesäß', vorne: false, erholungStunden: 72, fach: 'M. gluteus maximus und medius' },
  BEINBEUGER: { titel: 'Beinbeuger', vorne: false, erholungStunden: 72, fach: 'Ischiocrurale Muskulatur (M. biceps femoris, M. semitendinosus, M. semimembranosus)' },
  WADEN: { titel: 'Waden', vorne: false, erholungStunden: 36, fach: 'M. gastrocnemius, M. soleus' },
};
export const MUSKELN = Object.keys(Muskel);

/** Was je Satz gezählt wird. */
export const Messart = {
  GEWICHT: 'Gewicht × Wdh.',
  KOERPER: 'Körpergewicht × Wdh.',
  ZEIT: 'Zeit',
  CARDIO: 'Strecke / Zeit',
};
export const MESSARTEN = Object.keys(Messart);

export const SatzTyp = {
  NORMAL: { kurz: '', titel: 'Arbeitssatz' },
  AUFWAERMEN: { kurz: 'A', titel: 'Aufwärmen' },
  DROP: { kurz: 'D', titel: 'Dropsatz' },
  VERSAGEN: { kurz: 'V', titel: 'Bis Versagen' },
};
export const SATZTYPEN = Object.keys(SatzTyp);

const liste = (x) => (Array.isArray(x) ? x : []);
const zahlOder = (x, d) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
const textOder = (x, d = '') => (typeof x === 'string' ? x : d);
const enumOder = (x, werte, d) => (typeof x === 'string' && x in werte ? x : d);

export const uebung = (u = {}) => ({
  id: textOder(u.id), name: textOder(u.name), art: enumOder(u.art, Messart, 'GEWICHT'),
  primaer: liste(u.primaer).filter((m) => m in Muskel), sekundaer: liste(u.sekundaer).filter((m) => m in Muskel),
  importName: textOder(u.importName),
});

export const satz = (s = {}) => ({
  gewicht: zahlOder(s.gewicht, 0), wdh: Math.round(zahlOder(s.wdh, 0)), sekunden: Math.round(zahlOder(s.sekunden, 0)),
  meter: zahlOder(s.meter, 0), rpe: typeof s.rpe === 'number' ? s.rpe : null, typ: enumOder(s.typ, SatzTyp, 'NORMAL'),
  erledigt: s.erledigt !== false,
});

export const block = (b = {}) => ({ uebungId: textOder(b.uebungId), saetze: liste(b.saetze).map(satz), notiz: textOder(b.notiz) });

export const workout = (w = {}) => ({
  id: textOder(w.id), name: textOder(w.name), start: zahlOder(w.start, 0), dauerSek: Math.round(zahlOder(w.dauerSek, 0)),
  bloecke: liste(w.bloecke).map(block), notiz: textOder(w.notiz), quelle: textOder(w.quelle),
});

/** [koerpergewicht]: nur noch für alte Stände; das Gewicht kommt aus dem gemeinsamen Profil. */
export const einstellungen = (e = {}) => ({
  koerpergewicht: zahlOder(e.koerpergewicht, 0), pauseSek: Math.round(zahlOder(e.pauseSek, 90)),
  wochenzielMin: Math.round(zahlOder(e.wochenzielMin, 10)), wochenzielMax: Math.round(zahlOder(e.wochenzielMax, 20)),
});

export const neuerStand = () => ({ uebungen: [], workouts: [], einstellungen: einstellungen(), laufend: null, version: 1 });

/** Stand aus JSON (auch der Android-Sicherung krafttraining.json, dort fehlen Standardwerte). */
export function standLesen(o) {
  if (!o || typeof o !== 'object') throw new Error('Keine Trainingsdaten.');
  return {
    uebungen: liste(o.uebungen).map(uebung).filter((u) => u.id && u.name),
    workouts: liste(o.workouts).map(workout).filter((w) => w.id).sort((a, b) => a.start - b.start),
    einstellungen: einstellungen(o.einstellungen || {}),
    laufend: o.laufend ? workout(o.laufend) : null,
    version: 1,
  };
}

export const istTrainingStand = (o) => !!o && typeof o === 'object' && (Array.isArray(o.workouts) || Array.isArray(o.uebungen)) && !Array.isArray(o.eintraege);

// ---------- Katalog ----------

/** Geräte. [en]: Schreibweisen in Exporten und auf Deutsch. */
export const Geraet = {
  LH: { kurz: 'lh', titel: 'Langhantel', en: ['barbell', 'langhantel', 'olympic bar'] },
  KH: { kurz: 'kh', titel: 'Kurzhantel', en: ['dumbbell', 'dumbbells', 'kurzhantel', 'kurzhanteln', 'db'] },
  KABEL: { kurz: 'kabel', titel: 'Kabelzug', en: ['cable', 'cables', 'kabel', 'kabelzug', 'seilzug'] },
  MASCHINE: { kurz: 'ma', titel: 'Maschine', en: ['machine', 'maschine', 'plate loaded', 'lever'] },
  SMITH: { kurz: 'smith', titel: 'Multipresse', en: ['smith machine', 'smith', 'multipresse'] },
  EZ: { kurz: 'ez', titel: 'SZ-Stange', en: ['ez bar', 'ez curl bar', 'ez', 'sz stange', 'sz'] },
  KB: { kurz: 'kb', titel: 'Kettlebell', en: ['kettlebell', 'kettlebells'] },
  BAND: { kurz: 'band', titel: 'Band', en: ['band', 'bands', 'resistance band', 'widerstandsband'] },
  KOERPER: { kurz: 'kg', titel: 'Körpergewicht', en: ['bodyweight', 'body weight', 'weighted', 'assisted', 'korpergewicht', 'koerpergewicht'] },
};

/** Klein, Umlaute ausgeschrieben, alles außer Buchstaben/Ziffern als ein Leerzeichen (wie Katalog.norm). */
export const norm = (s) => String(s ?? '').toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/'/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const {
  BRUST, SCHULTERN, BIZEPS, TRIZEPS, UNTERARME, BAUCH, QUADRIZEPS, ADDUKTOREN, LAT, TRAPEZ, UNTERER_RUECKEN, GESAESS, BEINBEUGER, WADEN,
} = Object.fromEntries(MUSKELN.map((m) => [m, m]));
const [L_, K_, C_, M_, S_, E_, KB_, B_] = ['LH', 'KH', 'KABEL', 'MASCHINE', 'SMITH', 'EZ', 'KB', 'BAND'];

/** Bewegung: [key, name, en, primaer, sekundaer, geraete (null = ohne Gerät), art]. */
const B = (key, name, en, primaer, sekundaer = [], geraete = [null], art = 'GEWICHT') => ({ key, name, en, primaer, sekundaer, geraete, art });

/** Bewegungen, deren Maschinen-Variante mit dem Gewichtsblock arbeitet (nicht unterstützend wie Dips- oder Klimmzug-Maschine). */
const MASCHINE_MIT_BLOCK = new Set(['trizepsdips', 'crunch']);

export const BEWEGUNGEN = [
  // Brust
  B('bankdruecken', 'Bankdrücken', ['bench press', 'flat bench press', 'chest press flat'], [BRUST], [TRIZEPS, SCHULTERN], [L_, K_, S_, M_]),
  B('schraegbank', 'Schrägbankdrücken', ['incline bench press', 'incline press', 'incline chest press'], [BRUST], [SCHULTERN, TRIZEPS], [L_, K_, S_, M_]),
  B('negativbank', 'Negativ-Bankdrücken', ['decline bench press', 'decline press'], [BRUST], [TRIZEPS], [L_, K_, S_, M_]),
  B('brustpresse', 'Brustpresse', ['chest press', 'seated chest press'], [BRUST], [TRIZEPS, SCHULTERN], [M_]),
  B('fliegende', 'Fliegende', ['chest fly', 'fly', 'flye', 'chest flye', 'dumbbell fly', 'pec fly'], [BRUST], [SCHULTERN], [K_, C_, M_]),
  B('schraegfliegende', 'Schräg-Fliegende', ['incline chest fly', 'incline fly', 'incline flye'], [BRUST], [SCHULTERN], [K_, C_]),
  B('butterfly', 'Butterfly', ['pec deck', 'butterfly', 'pec deck fly'], [BRUST], [], [M_]),
  B('kabelcross', 'Kabel-Crossover', ['cable crossover', 'cable cross', 'crossover', 'cable fly crossovers'], [BRUST], [SCHULTERN], [C_]),
  B('liegestuetz', 'Liegestütz', ['push up', 'pushup', 'push ups', 'press up'], [BRUST], [TRIZEPS, SCHULTERN, BAUCH], [null], 'KOERPER'),
  B('dips', 'Dips', ['dip', 'dips', 'chest dip', 'chest dips', 'parallel bar dips'], [BRUST, TRIZEPS], [SCHULTERN], [null, M_], 'KOERPER'),
  // Rücken
  B('kreuzheben', 'Kreuzheben', ['deadlift', 'conventional deadlift'], [BEINBEUGER, GESAESS, UNTERER_RUECKEN], [QUADRIZEPS, TRAPEZ, UNTERARME, LAT], [L_, K_, KB_]),
  B('sumo', 'Sumo-Kreuzheben', ['sumo deadlift'], [GESAESS, QUADRIZEPS, ADDUKTOREN], [BEINBEUGER, UNTERER_RUECKEN, TRAPEZ], [L_]),
  B('trapbar', 'Trap-Bar-Kreuzheben', ['trap bar deadlift', 'hex bar deadlift', 'trap bar'], [QUADRIZEPS, GESAESS], [BEINBEUGER, UNTERER_RUECKEN, TRAPEZ], [null]),
  B('rumaenisch', 'Rumänisches Kreuzheben', ['romanian deadlift', 'rdl', 'stiff leg deadlift', 'straight leg deadlift'], [BEINBEUGER, GESAESS], [UNTERER_RUECKEN], [L_, K_]),
  B('klimmzug', 'Klimmzug', ['pull up', 'pullup', 'pull ups', 'wide grip pull up'], [LAT], [BIZEPS, TRAPEZ, UNTERARME], [null, M_], 'KOERPER'),
  B('chinup', 'Klimmzug Untergriff', ['chin up', 'chinup', 'chin ups'], [LAT, BIZEPS], [TRAPEZ, UNTERARME], [null], 'KOERPER'),
  B('latzug', 'Latzug', ['lat pulldown', 'pulldown', 'lat pull down', 'wide grip lat pulldown'], [LAT], [BIZEPS, TRAPEZ, SCHULTERN], [C_, M_]),
  B('latzugeng', 'Latzug eng', ['close grip lat pulldown', 'close grip pulldown', 'v bar pulldown'], [LAT], [BIZEPS], [C_]),
  B('rudern', 'Vorgebeugtes Rudern', ['bent over row', 'barbell row', 'row', 'bent over rows'], [LAT, TRAPEZ], [BIZEPS, SCHULTERN, UNTERER_RUECKEN], [L_, K_]),
  B('pendlay', 'Pendlay-Rudern', ['pendlay row'], [LAT, TRAPEZ], [BIZEPS, SCHULTERN, UNTERER_RUECKEN], [L_]),
  B('einarm', 'Einarmiges Rudern', ['one arm row', 'single arm row', 'dumbbell row', 'one arm dumbbell row', 'kroc row'], [LAT], [BIZEPS, TRAPEZ, SCHULTERN], [K_, C_]),
  B('kabelrudern', 'Rudern sitzend', ['seated row', 'seated cable row', 'cable row', 'low row'], [LAT, TRAPEZ], [BIZEPS, SCHULTERN, UNTERARME], [C_, M_]),
  B('tbar', 'T-Bar-Rudern', ['t bar row', 'tbar row'], [LAT, TRAPEZ], [BIZEPS, SCHULTERN, UNTERER_RUECKEN], [null, M_]),
  B('brustgestuetzt', 'Brustgestütztes Rudern', ['chest supported row', 'incline row', 'seal row'], [TRAPEZ, LAT], [BIZEPS, SCHULTERN], [K_, M_, L_]),
  B('pullover', 'Pullover', ['pullover', 'straight arm pulldown', 'straight arm lat pulldown'], [LAT], [BRUST, TRIZEPS], [K_, C_]),
  B('shrugs', 'Shrugs', ['shrug', 'shrugs'], [TRAPEZ], [UNTERARME], [L_, K_, M_]),
  B('facepull', 'Face Pull', ['face pull', 'face pulls'], [SCHULTERN, TRAPEZ], [], [C_, B_]),
  B('hyperext', 'Rückenstrecker', ['back extension', 'hyperextension', 'hyperextensions', 'back extensions'], [UNTERER_RUECKEN], [GESAESS, BEINBEUGER], [null], 'KOERPER'),
  B('goodmorning', 'Good Morning', ['good morning', 'good mornings'], [BEINBEUGER, UNTERER_RUECKEN], [GESAESS], [L_]),
  // Schultern
  B('schulterdruecken', 'Schulterdrücken', ['overhead press', 'shoulder press', 'military press', 'ohp', 'strict press', 'seated overhead press', 'standing overhead press'], [SCHULTERN], [TRIZEPS, TRAPEZ], [L_, K_, S_, M_]),
  B('arnold', 'Arnold Press', ['arnold press'], [SCHULTERN], [TRIZEPS], [K_]),
  B('pushpress', 'Push Press', ['push press'], [SCHULTERN], [TRIZEPS, QUADRIZEPS], [L_]),
  B('seitheben', 'Seitheben', ['lateral raise', 'side lateral raise', 'lateral raises', 'side raise'], [SCHULTERN], [TRAPEZ], [K_, C_, M_]),
  B('frontheben', 'Frontheben', ['front raise', 'front raises'], [SCHULTERN], [BRUST], [K_, L_, C_]),
  B('reversefly', 'Reverse Flys', ['reverse fly', 'rear delt fly', 'reverse flye', 'rear delt raise', 'reverse pec deck', 'bent over lateral raise'], [SCHULTERN], [TRAPEZ], [K_, C_, M_]),
  B('aufrechtrudern', 'Aufrechtes Rudern', ['upright row'], [SCHULTERN, TRAPEZ], [BIZEPS], [L_, K_, C_]),
  // Arme
  B('bizepscurl', 'Bizepscurl', ['bicep curl', 'biceps curl', 'curl', 'standing curl', 'barbell curl', 'dumbbell curl'], [BIZEPS], [UNTERARME], [L_, K_, E_, C_, M_]),
  B('hammercurl', 'Hammercurl', ['hammer curl', 'hammer curls'], [BIZEPS, UNTERARME], [], [K_, C_]),
  B('scottcurl', 'Scottcurl', ['preacher curl', 'preacher curls'], [BIZEPS], [], [E_, K_, M_, L_]),
  B('konzentration', 'Konzentrationscurl', ['concentration curl'], [BIZEPS], [], [K_]),
  B('schraegcurl', 'Schrägbank-Curl', ['incline curl', 'incline dumbbell curl'], [BIZEPS], [], [K_]),
  B('trizepsdruecken', 'Trizepsdrücken', ['triceps pushdown', 'tricep pushdown', 'pushdown', 'triceps pressdown', 'rope pushdown'], [TRIZEPS], [], [C_]),
  B('stirndruecken', 'French Press', ['skullcrusher', 'skull crusher', 'lying triceps extension', 'french press'], [TRIZEPS], [], [E_, L_, K_]),
  B('trizepsueberkopf', 'Trizeps über Kopf', ['overhead triceps extension', 'triceps extension', 'tricep extension', 'overhead tricep extension'], [TRIZEPS], [], [K_, C_, E_]),
  B('enges', 'Enges Bankdrücken', ['close grip bench press', 'close grip bench'], [TRIZEPS, BRUST], [SCHULTERN], [L_, S_]),
  B('trizepsdips', 'Trizeps-Dips', ['triceps dip', 'tricep dip', 'bench dip', 'bench dips', 'triceps dips'], [TRIZEPS], [BRUST, SCHULTERN], [null, M_], 'KOERPER'),
  B('kickback', 'Trizeps-Kickback', ['triceps kickback', 'tricep kickback', 'kickback'], [TRIZEPS], [], [K_, C_]),
  B('handgelenk', 'Unterarmcurl', ['wrist curl', 'wrist curls', 'reverse wrist curl'], [UNTERARME], [], [L_, K_]),
  B('farmer', "Farmer's Walk", ['farmers walk', 'farmer walk', 'farmers carry', 'farmer s walk'], [UNTERARME, TRAPEZ], [BAUCH, QUADRIZEPS], [K_, null], 'GEWICHT'),
  // Beine
  B('kniebeuge', 'Kniebeuge', ['squat', 'back squat', 'full squat', 'high bar squat', 'low bar squat'], [QUADRIZEPS, GESAESS], [ADDUKTOREN, UNTERER_RUECKEN, BEINBEUGER], [L_, S_, K_]),
  B('frontkniebeuge', 'Frontkniebeuge', ['front squat'], [QUADRIZEPS], [GESAESS, BAUCH], [L_]),
  B('goblet', 'Goblet Squat', ['goblet squat'], [QUADRIZEPS, GESAESS], [ADDUKTOREN], [K_, KB_]),
  B('hackenschmidt', 'Hackenschmidt', ['hack squat'], [QUADRIZEPS], [GESAESS], [M_]),
  B('bulgarisch_hack', 'Bulgarian Hack Squat', ['bulgarian hack squat', 'bulgarian split hack squat', 'hack split squat', 'split hack squat'], [QUADRIZEPS, GESAESS], [ADDUKTOREN, BEINBEUGER], [M_]),
  B('beinpresse', 'Beinpresse', ['leg press', '45 degree leg press', 'seated leg press'], [QUADRIZEPS, GESAESS], [ADDUKTOREN], [M_]),
  B('ausfallschritt', 'Ausfallschritte', ['lunge', 'lunges', 'walking lunge', 'walking lunges', 'reverse lunge'], [QUADRIZEPS, GESAESS], [ADDUKTOREN, BEINBEUGER], [K_, L_, null]),
  B('bulgarisch', 'Bulgarische Kniebeuge', ['bulgarian split squat', 'split squat'], [QUADRIZEPS, GESAESS], [ADDUKTOREN], [K_, L_, S_, null]),
  B('stepup', 'Step-up', ['step up', 'step ups'], [QUADRIZEPS, GESAESS], [], [K_, L_, null]),
  B('beinstrecker', 'Beinstrecker', ['leg extension', 'leg extensions'], [QUADRIZEPS], [], [M_]),
  B('beincurl', 'Beinbeuger liegend', ['lying leg curl', 'leg curl', 'prone leg curl'], [BEINBEUGER], [WADEN], [M_]),
  B('beincurlsitz', 'Beinbeuger sitzend', ['seated leg curl'], [BEINBEUGER], [], [M_]),
  B('hipthrust', 'Hip Thrust', ['hip thrust', 'hip thrusts', 'barbell hip thrust'], [GESAESS], [BEINBEUGER], [L_, M_, S_]),
  B('glutebridge', 'Glute Bridge', ['glute bridge', 'hip bridge'], [GESAESS], [BEINBEUGER], [null, L_]),
  B('kickbackbein', 'Glute Kickback', ['glute kickback', 'cable kickback'], [GESAESS], [], [C_, M_]),
  B('abduktor', 'Abduktoren-Maschine', ['hip abductor', 'abductor', 'hip abduction'], [GESAESS], [], [M_]),
  B('adduktor', 'Adduktoren-Maschine', ['hip adductor', 'adductor', 'hip adduction'], [ADDUKTOREN], [], [M_]),
  B('wadenstehend', 'Wadenheben stehend', ['standing calf raise', 'calf raise', 'calf raises'], [WADEN], [], [M_, K_, S_, null]),
  B('wadensitzend', 'Wadenheben sitzend', ['seated calf raise'], [WADEN], [], [M_]),
  B('wadenpresse', 'Wadenpresse', ['calf press', 'calf press on leg press', 'leg press calf raise'], [WADEN], [], [M_]),
  B('kbswing', 'Kettlebell Swing', ['kettlebell swing', 'swing'], [GESAESS, BEINBEUGER], [UNTERER_RUECKEN, SCHULTERN], [KB_, K_]),
  // Rumpf
  B('crunch', 'Crunch', ['crunch', 'crunches', 'sit up', 'situp', 'sit ups'], [BAUCH], [], [null, M_], 'KOERPER'),
  B('kabelcrunch', 'Kabel-Crunch', ['cable crunch', 'kneeling cable crunch'], [BAUCH], [], [C_]),
  B('beinheben', 'Beinheben hängend', ['hanging leg raise', 'hanging knee raise', 'leg raise', 'captain s chair leg raise', 'knee raise'], [BAUCH], [], [null], 'KOERPER'),
  B('plank', 'Unterarmstütz', ['plank', 'planks', 'side plank'], [BAUCH], [SCHULTERN], [null], 'ZEIT'),
  B('russian', 'Russian Twist', ['russian twist', 'russian twists'], [BAUCH], [], [null], 'KOERPER'),
  B('abroller', 'Bauchroller', ['ab wheel', 'ab wheel rollout', 'ab rollout', 'rollout'], [BAUCH], [LAT], [null], 'KOERPER'),
  B('woodchop', 'Holzhacker', ['wood chop', 'woodchop', 'cable woodchop'], [BAUCH], [], [C_]),
  // Ausdauer
  B('laufen', 'Laufen', ['running', 'run', 'jogging', 'treadmill', 'treadmill run'], [QUADRIZEPS], [WADEN, BEINBEUGER, GESAESS], [null], 'CARDIO'),
  B('radfahren', 'Radfahren', ['cycling', 'bike', 'stationary bike', 'spinning', 'bicycle'], [QUADRIZEPS], [GESAESS, BEINBEUGER, WADEN], [null], 'CARDIO'),
  B('rudergeraet', 'Rudergerät', ['rowing', 'rowing machine', 'rower', 'erg'], [QUADRIZEPS, LAT], [GESAESS, BEINBEUGER, BIZEPS, TRAPEZ, UNTERER_RUECKEN], [null], 'CARDIO'),
  B('crosstrainer', 'Crosstrainer', ['elliptical', 'elliptical trainer', 'cross trainer'], [QUADRIZEPS], [GESAESS, BEINBEUGER, WADEN], [null], 'CARDIO'),
  B('seilspringen', 'Seilspringen', ['jump rope', 'skipping'], [WADEN], [], [null], 'CARDIO'),
  // Ergänzt für Übungen aus Stronger-Exporten
  B('katana', 'Katana Extension', ['katana extension', 'katana extensions', 'katana', 'cross body triceps extension', 'crossbody cable triceps extension'], [TRIZEPS], [], [C_]),
  B('rotatoren', 'Außenrotation am Kabel', ['external rotation', 'cable external rotation', 'rotator cuff', 'rotatoren', 'aussenrotation'], [SCHULTERN], [TRAPEZ], [C_, B_]),
  B('schwimmen', 'Schwimmen', ['swimming', 'swim', 'schwimmen', 'kraul'], [LAT, SCHULTERN], [TRIZEPS, BRUST, BAUCH, QUADRIZEPS], [null], 'CARDIO'),
];

const bewegungsId = (b, g) => (g == null ? b.key : `${b.key}-${Geraet[g].kurz}`);
const bewegungsUebung = (b, g) => uebung({
  id: bewegungsId(b, g),
  name: g == null ? b.name : `${b.name} (${Geraet[g].titel})`,
  // Maschinen mit eigenem Gewichtsblock (Trizeps-Dips sitzend, Bauchmaschine): kg sind die Last, kein Zusatz zum Körpergewicht
  art: g === 'KOERPER' && b.art === 'GEWICHT' ? 'KOERPER' : g === 'MASCHINE' && b.art === 'KOERPER' && MASCHINE_MIT_BLOCK.has(b.key) ? 'GEWICHT' : b.art,
  primaer: b.primaer, sekundaer: b.sekundaer,
});

export const KATALOG = BEWEGUNGEN.flatMap((b) => b.geraete.map((g) => bewegungsUebung(b, g)));
export const katalogNachId = Object.fromEntries(KATALOG.map((u) => [u.id, u]));

const bewegungNachAlias = new Map();
for (const b of BEWEGUNGEN) if (!bewegungNachAlias.has(norm(b.name))) bewegungNachAlias.set(norm(b.name), b);
for (const b of BEWEGUNGEN) for (const e of b.en) if (!bewegungNachAlias.has(norm(e))) bewegungNachAlias.set(norm(e), b);

const geraetWoerter = Object.entries(Geraet).flatMap(([g, x]) => x.en.map((w) => [norm(w), g])).sort((a, b) => b[0].length - a[0].length);

/** Zerlegt „Bench Press (Barbell)“ oder „Barbell Bench Press“ in Bewegung und Gerät. */
export function zerlege(name) {
  const klammer = [...name.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]).join(' ');
  const aussen = name.replace(/\([^)]*\)/g, ' ');
  let geraet = null;
  const suche = (text) => {
    let t = ` ${norm(text)} `;
    for (const [w, g] of geraetWoerter) {
      if (t.includes(` ${w} `)) {
        if (geraet == null) geraet = g;
        t = t.split(` ${w} `).join(' ');
      }
    }
    return t.trim().replace(/ +/g, ' ');
  };
  suche(klammer);
  const basis = suche(aussen);
  return [basis, geraet];
}

/** Übung zum Namen aus einem Export. Ohne genauen Treffer werden die Muskeln aus Stichworten geschätzt. */
export function finde(name) {
  const [basis, geraet] = zerlege(name);
  const genau = KATALOG.find((u) => norm(u.name) === norm(name));
  if (genau) return { uebung: genau, bewegung: null, primaer: genau.primaer, sekundaer: genau.sekundaer, art: genau.art };
  const ohneS = (w) => w.replace(/s$/, '');
  const kandidaten = [
    bewegungNachAlias.get(basis),
    bewegungNachAlias.get(ohneS(basis)),
    bewegungNachAlias.get(basis.split(' ').filter(Boolean).map(ohneS).join(' ')),
    bewegungNachAlias.get(norm(name)),
  ].filter(Boolean);
  const b = kandidaten.find((k) => geraet == null || k.geraete.includes(geraet)) || kandidaten[0];
  if (b) {
    let g;
    if (geraet != null && b.geraete.includes(geraet)) g = geraet;
    else if (geraet == null) g = b.geraete[0];
    else if (b.geraete.length === 1 && b.geraete[0] == null) g = null;
    else if (geraet === 'KOERPER' && b.geraete.includes(null)) g = null;
    else return { uebung: null, bewegung: b, primaer: b.primaer, sekundaer: b.sekundaer, art: geraet === 'KOERPER' ? 'KOERPER' : b.art };
    const u = bewegungsUebung(b, g);
    return { uebung: u, bewegung: b, primaer: u.primaer, sekundaer: u.sekundaer, art: u.art };
  }
  const [p, s, art] = schaetze(basis, geraet);
  return { uebung: null, bewegung: null, primaer: p, sekundaer: s, art };
}

/** Grobe Zuordnung über Stichworte, wenn der Name unbekannt ist. */
export function schaetze(basis, geraet) {
  const t = ` ${basis} `;
  const hat = (...w) => w.some((x) => t.includes(' ' + x));
  const art = geraet === 'KOERPER' ? 'KOERPER' : 'GEWICHT';
  if (hat('run', 'jog', 'walk', 'cycl', 'bike', 'row machine', 'rowing', 'elliptical', 'stair', 'swim', 'hike', 'lauf', 'rad') && !hat('lunge', 'farmer')) return [[QUADRIZEPS], [WADEN], 'CARDIO'];
  if (hat('leg curl', 'hamstring', 'nordic', 'beinbeuger')) return [[BEINBEUGER], [], art];
  if (hat('wrist', 'forearm', 'grip training', 'hand grip', 'unterarm')) return [[UNTERARME], [], art];
  if (hat('tricep', 'pushdown', 'skull', 'trizeps', 'kickback', 'katana')) return [[TRIZEPS], [], art];
  if (hat('curl', 'bizeps', 'bicep')) return [[BIZEPS], [UNTERARME], art];
  if (hat('pulldown', 'pull down')) return [[LAT], [BIZEPS, TRAPEZ], art];
  if (hat('rotator', 'rotatoren')) return [[SCHULTERN], [], art];
  if (hat('calf', 'wade')) return [[WADEN], [], art];
  if (hat('deadlift', 'kreuzheben', 'rdl')) return [[BEINBEUGER, GESAESS, UNTERER_RUECKEN], [TRAPEZ], art];
  if (hat('squat', 'leg press', 'lunge', 'leg extension', 'kniebeuge', 'beinpresse', 'step')) return [[QUADRIZEPS, GESAESS], [ADDUKTOREN], art];
  if (hat('glute', 'hip thrust', 'bridge', 'abduct', 'gesaess')) return [[GESAESS], [BEINBEUGER], art];
  if (hat('adduct')) return [[ADDUKTOREN], [], art];
  if (hat('shrug')) return [[TRAPEZ], [], art];
  if (hat('lateral', 'raise', 'delt', 'shoulder', 'overhead', 'military', 'schulter', 'face pull')) return [[SCHULTERN], [TRIZEPS], art];
  if (hat('pull up', 'pullup', 'chin', 'pulldown', 'lat ', 'row', 'ruder', 'latzug', 'klimmzug')) return [[LAT], [BIZEPS, TRAPEZ], art];
  if (hat('bench', 'barbench', 'chest', 'fly', 'flye', 'push up', 'pushup', 'dip', 'pec', 'brust', 'bank')) return [[BRUST], [TRIZEPS, SCHULTERN], art];
  if (hat('back extension', 'hyperext', 'good morning', 'ruecken', 'unterer r', 'bock')) return [[UNTERER_RUECKEN], [GESAESS], art];
  if (hat('crunch', 'plank', 'sit up', 'situp', 'ab ', 'abs', 'core', 'oblique', 'twist', 'leg raise', 'bauch')) return [[BAUCH], [], hat('plank') ? 'ZEIT' : 'KOERPER'];
  return [[], [], art];
}

/** Kraftstandards (Vielfaches des Körpergewichts, geschätztes 1RM) für Männer: Anfänger … Elite. */
export const STANDARDS = {
  'bankdruecken-lh': [0.5, 0.75, 1.25, 1.75, 2.0],
  'kniebeuge-lh': [0.75, 1.25, 1.5, 2.25, 2.75],
  'kreuzheben-lh': [1.0, 1.5, 2.0, 2.5, 3.0],
  'schulterdruecken-lh': [0.35, 0.55, 0.8, 1.05, 1.35],
  'rudern-lh': [0.5, 0.75, 1.0, 1.5, 1.75],
  klimmzug: [1.0, 1.1, 1.3, 1.6, 1.9],
  dips: [1.0, 1.2, 1.5, 1.9, 2.3],
  'bizepscurl-lh': [0.2, 0.4, 0.6, 0.85, 1.15],
  'hipthrust-lh': [0.75, 1.25, 1.75, 2.5, 3.25],
  'frontkniebeuge-lh': [0.6, 1.0, 1.25, 1.75, 2.25],
  'rumaenisch-lh': [0.75, 1.1, 1.5, 2.0, 2.5],
};

/** Alle Übungen nach id: Katalog, darüber eigene. */
export const uebungMap = (s) => ({ ...katalogNachId, ...Object.fromEntries(s.uebungen.map((u) => [u.id, u])) });

/** Körpergewicht fürs Training: aus dem gemeinsamen Profil, sonst ein alter eigener Wert, sonst 75 kg. */
export const koerperKg = (s, profilKg) => (profilKg > 0 ? profilKg : s.einstellungen.koerpergewicht > 0 ? s.einstellungen.koerpergewicht : 75);

// ---------- Format ----------

const MONATE = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
const WTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** Datumsteile lokal oder (für Tests) in UTC. */
const teile = (ms, utc) => {
  const d = new Date(ms);
  return utc
    ? { j: d.getUTCFullYear(), m: d.getUTCMonth(), t: d.getUTCDate(), wt: d.getUTCDay(), h: d.getUTCHours(), mi: d.getUTCMinutes() }
    : { j: d.getFullYear(), m: d.getMonth(), t: d.getDate(), wt: d.getDay(), h: d.getHours(), mi: d.getMinutes() };
};

export const Format = {
  /** Zahl mit Komma, höchstens [stellen] Nachkommastellen, ohne Nullen am Ende; Tausender mit Punkt. */
  zahl(d, stellen = 1) {
    if (!Number.isFinite(d)) return '–';
    const f = 10 ** stellen;
    const g = Math.round(d * f);
    const neg = g < 0;
    const abs = Math.abs(g);
    const ganz = String(Math.floor(abs / f)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const rest = String(abs % f).padStart(stellen, '0').replace(/0+$/, '');
    return (neg ? '-' : '') + ganz + (rest && stellen > 0 ? ',' + rest : '');
  },
  parse(t) { const v = parseFloat(String(t).trim().replace(',', '.')); return Number.isNaN(v) ? null : v; },
  kg: (d) => `${Format.zahl(d, d >= 1000 ? 0 : 1)} kg`,
  dauer(sek) {
    if (sek <= 0) return '–';
    if (sek < 60) return `${sek} s`;
    if (sek < 3600) return sek % 60 === 0 ? `${Math.floor(sek / 60)} min` : `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, '0')} min`;
    return `${Math.floor(sek / 3600)} h ${Math.floor((sek % 3600) / 60)} min`;
  },
  strecke: (m) => (m >= 1000 ? `${Format.zahl(m / 1000, 2)} km` : `${Format.zahl(m, 0)} m`),
  /** „80 kg × 8“, „+10 kg × 6“ (Zusatzgewicht), „60 s“, „5 km in 25 min“. */
  satz(s, art) {
    let t;
    if (art === 'GEWICHT') t = `${Format.zahl(s.gewicht, 2)} kg × ${s.wdh}`;
    else if (art === 'KOERPER') t = s.gewicht > 0 ? `+${Format.zahl(s.gewicht, 2)} kg × ${s.wdh}` : s.gewicht < 0 ? `−${Format.zahl(-s.gewicht, 2)} kg × ${s.wdh}` : `${s.wdh} Wdh.`;
    else if (art === 'ZEIT') t = s.gewicht > 0 ? `${Format.dauer(s.sekunden)} mit ${Format.zahl(s.gewicht, 2)} kg` : Format.dauer(s.sekunden);
    else t = [s.meter > 0 ? Format.strecke(s.meter) : null, s.sekunden > 0 ? Format.dauer(s.sekunden) : null].filter(Boolean).join(' in ') || '–';
    return t + (s.rpe != null ? ` @${Format.zahl(s.rpe)}` : '');
  },
  datum(ms, utc) { const d = teile(ms, utc); return `${WTAGE[d.wt]}, ${d.t}. ${MONATE[d.m]} ${d.j}`; },
  datumKurz(ms, utc) { const d = teile(ms, utc); return `${d.t}.${d.m + 1}.${d.j % 100}`; },
  uhrzeit(ms, utc) { const d = teile(ms, utc); return `${d.h}:${String(d.mi).padStart(2, '0')}`; },
  monatJahr(ms, utc) { const d = teile(ms, utc); return `${MONATE[d.m]} ${d.j}`; },
};

export const anzahl = (n, eins, mehr) => `${Format.zahl(n, 0)} ${n === 1 ? eins : mehr}`;

export function muskelText(u) {
  if (!u.primaer.length) return 'Muskelgruppen noch nicht zugeordnet';
  const p = u.primaer.map((m) => Muskel[m].titel).join(', ');
  const s = u.sekundaer.filter((m) => !u.primaer.includes(m));
  return s.length ? `${p} (+ ${s.map((m) => Muskel[m].titel).join(', ')})` : p;
}

// ---------- Rechnung ----------

export const Rechnung = {
  /** Geschätztes 1RM nach Epley; über 15 Wdh. wird nicht weiter hochgerechnet. */
  e1rm: (kg, wdh) => (kg <= 0 || wdh <= 0 ? 0 : wdh === 1 ? kg : kg * (1 + Math.min(wdh, 15) / 30)),
  /** Bewegte Last: bei Körpergewicht-Übungen Körper + Zusatz (negativ = Unterstützung). */
  last: (s, art, koerper) => (art === 'KOERPER' ? Math.max(0, koerper + s.gewicht) : s.gewicht),
  /** Arbeitssatz: erledigt und kein Aufwärmsatz. */
  zaehlt: (s) => s.erledigt && s.typ !== 'AUFWAERMEN',
  volumen: (s, art, koerper) => (Rechnung.zaehlt(s) && (art === 'GEWICHT' || art === 'KOERPER') ? Rechnung.last(s, art, koerper) * s.wdh : 0),

  zusammenfassung(w, uebungen, koerper) {
    let saetze = 0, wdh = 0, vol = 0;
    for (const b of w.bloecke) {
      const art = uebungen[b.uebungId]?.art || 'GEWICHT';
      for (const s of b.saetze.filter(Rechnung.zaehlt)) { saetze++; wdh += s.wdh; vol += Rechnung.volumen(s, art, koerper); }
    }
    return { saetze, wdh, volumen: vol, uebungen: w.bloecke.filter((b) => b.saetze.some(Rechnung.zaehlt)).length };
  },

  /** Verlauf einer Übung über alle Trainings, ältestes zuerst. */
  verlauf(uebungId, workouts, art, koerper) {
    const R = Rechnung;
    return [...workouts].sort((a, b) => a.start - b.start).map((w) => {
      const saetze = w.bloecke.filter((b) => b.uebungId === uebungId).flatMap((b) => b.saetze).filter(R.zaehlt);
      if (!saetze.length) return null;
      const schl = (s) => [R.e1rm(R.last(s, art, koerper), s.wdh), s.gewicht, s.wdh, s.sekunden];
      let bester = saetze[0];
      for (const s of saetze) {
        const a = schl(s), b = schl(bester);
        for (let i = 0; i < 4; i++) { if (a[i] > b[i]) { bester = s; break; } if (a[i] < b[i]) break; }
      }
      const mitGewicht = saetze.filter((s) => s.wdh > 0 || art === 'ZEIT');
      return {
        start: w.start, workoutId: w.id,
        maxGewicht: mitGewicht.length ? Math.max(...mitGewicht.map((s) => s.gewicht)) : 0,
        e1rm: Math.max(...saetze.map((s) => R.e1rm(R.last(s, art, koerper), s.wdh))),
        volumen: saetze.reduce((a, s) => a + R.volumen(s, art, koerper), 0),
        maxWdh: Math.max(...saetze.map((s) => s.wdh)),
        saetze: saetze.length,
        maxSek: Math.max(...saetze.map((s) => s.sekunden)),
        meter: saetze.reduce((a, s) => a + s.meter, 0),
        besterSatz: bester,
      };
    }).filter(Boolean);
  },

  rekorde(verlauf) {
    const best = (f) => {
      let r = null;
      for (const p of verlauf) if (f(p) > 0 && (!r || f(p) > r.wert || (f(p) === r.wert && p.start < r.start))) r = { wert: f(p), start: p.start };
      return r;
    };
    return {
      maxGewicht: best((p) => p.maxGewicht), e1rm: best((p) => p.e1rm), volumen: best((p) => p.volumen),
      maxWdh: best((p) => p.maxWdh), maxSek: best((p) => p.maxSek), meter: best((p) => p.meter),
    };
  },

  /** Neue Bestwerte eines Trainings gegenüber allen früheren (für die Meldung nach dem Training). */
  neueRekorde(w, alle, uebungen, koerper) {
    const frueher = alle.filter((x) => x.id !== w.id && x.start < w.start);
    const ids = [...new Set(w.bloecke.map((b) => b.uebungId))];
    const max = (l, f) => Math.max(...l.map(f));
    return ids.flatMap((id) => {
      const u = uebungen[id];
      if (!u) return [];
      const jetzt = Rechnung.verlauf(id, [w], u.art, koerper)[0];
      const vorher = Rechnung.verlauf(id, frueher, u.art, koerper);
      if (!jetzt || !vorher.length) return [];
      const r = [];
      if (u.art === 'GEWICHT' || u.art === 'KOERPER') {
        if (u.art === 'GEWICHT' && jetzt.maxGewicht > max(vorher, (p) => p.maxGewicht)) r.push(`${u.name}: schwerstes Gewicht ${Format.kg(jetzt.maxGewicht)}`);
        if (jetzt.e1rm > max(vorher, (p) => p.e1rm) + 0.05) r.push(`${u.name}: bestes geschätztes 1RM ${Format.kg(jetzt.e1rm)}`);
        if (jetzt.volumen > max(vorher, (p) => p.volumen) + 0.05) r.push(`${u.name}: meistes Volumen ${Format.kg(jetzt.volumen)}`);
      } else if (u.art === 'ZEIT') {
        if (jetzt.maxSek > max(vorher, (p) => p.maxSek)) r.push(`${u.name}: längste Zeit ${Format.dauer(jetzt.maxSek)}`);
      } else if (jetzt.meter > max(vorher, (p) => p.meter)) r.push(`${u.name}: weiteste Strecke ${Format.strecke(jetzt.meter)}`);
      return r;
    });
  },

  /** Sätze der Übung aus dem letzten Training vor [vor], als Vorschlag und Hinweis „Letztes Mal“. */
  letzteSaetze(uebungId, workouts, vor = Infinity) {
    const sortiert = workouts.filter((w) => w.start < vor).sort((a, b) => b.start - a.start);
    for (const w of sortiert) {
      const b = w.bloecke.find((x) => x.uebungId === uebungId && x.saetze.length);
      if (b) return b.saetze;
    }
    return [];
  },

  /** Wie oft und wann zuletzt jede Übung trainiert wurde: id → [anzahl, zuletzt]. */
  nutzung(workouts) {
    const m = {};
    for (const w of workouts) for (const id of new Set(w.bloecke.map((b) => b.uebungId))) {
      const [n, z] = m[id] || [0, 0];
      m[id] = [n + 1, Math.max(z, w.start)];
    }
    return m;
  },
};

// ---------- Belastung ----------

export const Belastung = {
  ANTEIL_SEKUNDAER: 0.5,
  VOLL: 8,
  stufen: ['Einsteiger', 'Anfänger', 'Fortgeschrittener Anfänger', 'Mittel', 'Fortgeschritten', 'Elite'],

  jeSatz(workouts, uebungen, f) {
    for (const w of workouts) for (const b of w.bloecke) {
      const u = uebungen[b.uebungId];
      if (!u) continue;
      const n = b.saetze.filter(Rechnung.zaehlt).length;
      if (!n) continue;
      for (const m of u.primaer) f(w, m, n);
      for (const m of u.sekundaer.filter((x) => !u.primaer.includes(x))) f(w, m, n * Belastung.ANTEIL_SEKUNDAER);
    }
  },

  /** Arbeitssätze je Muskelgruppe für Trainings mit Start in [von, bis). */
  saetze(workouts, uebungen, von, bis) {
    const m = Object.fromEntries(MUSKELN.map((x) => [x, 0]));
    Belastung.jeSatz(workouts.filter((w) => w.start >= von && w.start < bis), uebungen, (_, muskel, n) => { m[muskel] += n; });
    return m;
  },

  /** Erholung je Muskelgruppe: 1 = erholt, 0 = gerade voll belastet. */
  erholung(workouts, uebungen, jetzt) {
    const last = Object.fromEntries(MUSKELN.map((x) => [x, 0]));
    const relevant = workouts.filter((w) => w.start <= jetzt && jetzt - w.start < 7 * 24 * 3_600_000);
    Belastung.jeSatz(relevant, uebungen, (w, muskel, n) => {
      const ende = w.start + w.dauerSek * 1000;
      const stunden = Math.max(0, jetzt - ende) / 3_600_000;
      last[muskel] += n * Math.exp(-stunden / (Muskel[muskel].erholungStunden / 3));
    });
    return Object.fromEntries(MUSKELN.map((m) => [m, 1 - Math.min(1, Math.max(0, last[m] / Belastung.VOLL))]));
  },

  /** [stufe, punkte 0–100] aus Verhältnis zum Körpergewicht: je Stufe 20 Punkte, dazwischen linear. */
  punkte(v, std) {
    if (v <= 0) return [0, 0];
    if (v < std[0]) return [0, Math.trunc((v / std[0]) * 20)];
    for (let i = 0; i < std.length - 1; i++) {
      if (v < std[i + 1]) return [i + 1, Math.trunc(20 * (i + 1) + ((v - std[i]) / (std[i + 1] - std[i])) * 20)];
    }
    return [std.length, 100];
  },

  /** Kraftniveau je Muskelgruppe aus der besten Standard-Übung mit dem besten geschätzten 1RM. */
  kraftniveau(workouts, uebungen, koerper, seit = 0) {
    if (koerper <= 0) return {};
    const beste = {};
    for (const w of workouts.filter((x) => x.start >= seit)) for (const b of w.bloecke) {
      if (!(b.uebungId in STANDARDS)) continue;
      const art = uebungen[b.uebungId]?.art || 'GEWICHT';
      for (const s of b.saetze.filter(Rechnung.zaehlt)) {
        const e = Rechnung.e1rm(Rechnung.last(s, art, koerper), s.wdh);
        if (e > (beste[b.uebungId] || 0)) beste[b.uebungId] = e;
      }
    }
    const r = {};
    for (const [id, e1rm] of Object.entries(beste)) {
      const v = e1rm / koerper;
      const [stufe, p] = Belastung.punkte(v, STANDARDS[id]);
      const u = uebungen[id];
      if (!u) continue;
      for (const m of u.primaer) if ((r[m]?.punkte ?? -1) < p) r[m] = { stufe, punkte: p, uebungId: id, e1rm, verhaeltnis: v };
    }
    return r;
  },
};

// ---------- Verbrauch ----------

/**
 * Grober Zusatzverbrauch eines Trainings über MET-Werte, netto (ohne Ruheumsatz): kcal = (MET − 1) × kg × Stunden.
 * Kraft MET 5, ohne Dauer 2,5 min je Satz; Cardio MET 7, Laufen nach Tempo.
 */
export const Verbrauch = {
  MET_KRAFT: 5, MET_CARDIO: 7, SEK_JE_SATZ: 150,
  kcal(w, uebungen, kg) {
    let cardioSek = 0, cardioKcal = 0, kraftSaetze = 0;
    for (const b of w.bloecke) {
      const u = uebungen[b.uebungId];
      for (const s of b.saetze.filter((x) => x.erledigt)) {
        if (u?.art === 'CARDIO') {
          const sek = s.sekunden > 0 ? s.sekunden : Math.round(s.meter * 0.36);
          const kmh = s.sekunden > 0 && s.meter > 0 ? s.meter / 1000 / (s.sekunden / 3600) : 0;
          const met = kmh >= 6.5 && /lauf|run|jogg|sprint/i.test(u.name) ? Math.min(16, kmh) : Verbrauch.MET_CARDIO;
          cardioSek += sek;
          cardioKcal += ((met - 1) * kg * sek) / 3600;
        } else kraftSaetze++;
      }
    }
    const kraftSek = w.dauerSek > 0 ? Math.max(0, w.dauerSek - cardioSek) : kraftSaetze * Verbrauch.SEK_JE_SATZ;
    const kraftKcal = kraftSaetze === 0 ? 0 : ((Verbrauch.MET_KRAFT - 1) * kg * kraftSek) / 3600;
    return Math.round(kraftKcal + cardioKcal);
  },
  /** Trainings der letzten [tage] Tage als { id, start, kcal, name } für Food & Boost (wie das Trainingsbuch). */
  buch(s, foodKg, jetzt = Date.now(), tage = 60) {
    const u = uebungMap(s);
    const kg = koerperKg(s, foodKg);
    return s.workouts.filter((w) => w.start >= jetzt - tage * 86_400_000).map((w) => ({ id: w.id, start: w.start, kcal: Verbrauch.kcal(w, u, kg), name: w.name }));
  },
};

// ---------- Import ----------

export const FELDER = {
  DATUM: 'Datum / Start', ENDE: 'Ende', TRAINING: 'Trainingsname', TRAINING_NR: 'Trainingsnummer', DAUER: 'Trainingsdauer',
  UEBUNG: 'Übung', SATZ: 'Satz-Nr. / Satzart', SATZTYP: 'Satztyp', GEWICHT: 'Gewicht', EINHEIT: 'Gewichtseinheit',
  WDH: 'Wiederholungen', SEKUNDEN: 'Zeit je Satz', STRECKE: 'Strecke', STRECKE_EINHEIT: 'Streckeneinheit', RPE: 'RPE',
  NOTIZ: 'Notiz', TRAINING_NOTIZ: 'Trainingsnotiz',
};

export class ImportFehler extends Error {}

const LB = 0.45359237;

const SPALTEN = [
  ['UEBUNG', ['exercise name', 'exercise', 'exercise title', 'uebung', 'uebungsname', 'movement', 'lift']],
  ['DATUM', ['date', 'workout date', 'start time', 'start date', 'start', 'datum', 'startzeit', 'beginn', 'date time', 'datetime', 'timestamp']],
  ['ENDE', ['end time', 'end date', 'ende', 'endzeit']],
  ['TRAINING_NR', ['workout nr', 'workout no', 'workout number', 'training nr']],
  ['TRAINING', ['workout name', 'title', 'workout', 'routine', 'routine name', 'training', 'trainingsname', 'session', 'session name']],
  ['SEKUNDEN', ['seconds', 'duration seconds', 'set duration sec', 'set duration', 'time seconds', 'sekunden', 'zeit', 'time', 'zeit s']],
  ['DAUER', ['duration', 'duration sec', 'duration secs', 'duration min', 'duration minutes', 'workout duration', 'dauer', 'dauer min', 'trainingsdauer']],
  ['SATZ', ['set order', 'set', 'set index', 'set number', 'set no', 'satz', 'satz nr', 'satznummer']],
  ['SATZTYP', ['set type', 'satztyp', 'satzart', 'type']],
  ['GEWICHT', ['weight', 'weight kg', 'weight kgs', 'weight lbs', 'weight lb', 'gewicht', 'gewicht kg', 'load', 'last']],
  ['EINHEIT', ['weight unit', 'unit', 'units', 'einheit', 'gewichtseinheit']],
  ['WDH', ['reps', 'repetitions', 'rep', 'wdh', 'wiederholungen', 'wh']],
  ['STRECKE', ['distance', 'distance km', 'distance m', 'distance meters', 'distance metres', 'distance mi', 'distance miles', 'strecke', 'distanz', 'strecke km', 'strecke m']],
  ['STRECKE_EINHEIT', ['distance unit', 'streckeneinheit']],
  ['RPE', ['rpe', 'rpe rating', 'rir rpe']],
  ['TRAINING_NOTIZ', ['workout notes', 'workout note', 'description', 'trainingsnotiz']],
  ['NOTIZ', ['notes', 'note', 'exercise notes', 'comment', 'comments', 'notiz', 'notizen', 'bemerkung']],
];

const normKopf = (h) => norm(String(h).replace(/#/g, ' nr '));

/** Zuordnung { spalten: {FELD: index}, gewichtLb, meterJeEinheit, dauerInSekunden }. */
export const vollstaendig = (z) => 'DATUM' in z.spalten && 'UEBUNG' in z.spalten && ['GEWICHT', 'WDH', 'SEKUNDEN', 'STRECKE'].some((f) => f in z.spalten);

export const Import = {
  /** CSV lesen: Komma, Semikolon oder Tab, Anführungszeichen, BOM, Zeilenumbrüche in Feldern. */
  csv(text) {
    const s = text.replace(/^﻿/, '');
    const anfang = s.split('\n').slice(0, 20).join('\n').replace(/"[^"]*"/g, '');
    const zaehl = (c) => anfang.split(c).length - 1;
    const trenner = [',', ';', '\t'].reduce((a, c) => (zaehl(c) > zaehl(a) ? c : a));
    const zeilen = [];
    let zeile = [], feld = '', inQ = false;
    const ende = () => { zeile.push(feld); feld = ''; if (zeile.some((x) => x.trim())) zeilen.push(zeile); zeile = []; };
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inQ) {
        if (c === '"') { if (s[i + 1] === '"') { feld += '"'; i++; } else inQ = false; } else feld += c;
      } else if (c === '"') inQ = true;
      else if (c === trenner) { zeile.push(feld); feld = ''; }
      else if (c === '\r') { if (s[i + 1] === '\n') i++; ende(); }
      else if (c === '\n') ende();
      else feld += c;
    }
    if (feld || zeile.length) ende();
    return zeilen;
  },

  erkenne(kopf) {
    const n = kopf.map(normKopf);
    const spalten = {};
    const belegt = new Set();
    for (const [feld, namen] of SPALTEN) {
      for (const x of namen) {
        const i = n.indexOf(x);
        if (i >= 0 && !belegt.has(i)) { spalten[feld] = i; belegt.add(i); break; }
      }
    }
    const g = 'GEWICHT' in spalten ? n[spalten.GEWICHT] : '';
    const d = 'STRECKE' in spalten ? n[spalten.STRECKE] : '';
    const dauer = 'DAUER' in spalten ? n[spalten.DAUER] : '';
    return {
      spalten,
      gewichtLb: g.endsWith(' lb') || g.endsWith(' lbs'),
      meterJeEinheit: d.endsWith(' m') || d.endsWith(' meters') || d.endsWith(' metres') || d === 'strecke m' ? 1 : d.endsWith(' mi') || d.endsWith(' miles') ? 1609.344 : 1000,
      dauerInSekunden: dauer.endsWith(' sec') || dauer.endsWith(' secs') || dauer.endsWith(' s'),
    };
  },

  /** Stronger-Datenexport: Abschnitte „=== NAME ===“, Trainings unter WORKOUT HISTORY. */
  strongerExport(text) {
    const marken = [...text.matchAll(/^=== (.+?) ===[ \t]*\r?$/gm)];
    if (!marken.length) return null;
    const abschnitte = {};
    marken.forEach((m, i) => {
      const von = m.index + m[0].length;
      const bis = i + 1 < marken.length ? marken[i + 1].index : text.length;
      abschnitte[m[1].trim()] = text.slice(von, bis).trim();
    });
    const tabelle = abschnitte['WORKOUT HISTORY'];
    if (tabelle == null) return null;
    const koerper = new Set((abschnitte['YOUR CUSTOM EXERCISES'] ? Import.csv(abschnitte['YOUR CUSTOM EXERCISES']) : []).slice(1)
      .filter((r) => (r[1] || '').trim().toLowerCase() === 'yes').map((r) => norm(r[0])));
    return { tabelle, koerpergewicht: koerper };
  },

  tabelle(text) {
    const stronger = Import.strongerExport(text);
    const zeilen = Import.csv(stronger ? stronger.tabelle : text);
    if (!zeilen.length) return { kopf: [], daten: [], stronger };
    const k = stronger ? 0 : Math.max(0, zeilen.slice(0, 30).findIndex((z) => vollstaendig(Import.erkenne(z.map((x) => x.trim())))));
    let kopf = zeilen[k].map((x) => x.trim());
    const daten = zeilen.slice(k + 1);
    if (stronger) {
      const n = {};
      for (const r of daten) n[r.length] = (n[r.length] || 0) + 1;
      const ueblich = +Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0];
      const w = kopf.findIndex((x) => normKopf(x) === 'workout');
      if (ueblich === kopf.length - 1 && w >= 0) kopf = kopf.filter((_, i) => i !== w);
    }
    return { kopf, daten, stronger };
  },

  /** Die Kopfzeile, wie [lese] sie verwendet. */
  kopf: (text) => Import.tabelle(text).kopf,

  quelle(kopf) {
    const h = kopf.map(normKopf);
    if (h.includes('exercise name') && h.includes('set order')) return 'Strong-Format';
    if (h.includes('exercise title') && h.includes('set index')) return 'Hevy-Format';
    if (h.includes('exercise') && h.includes('category')) return 'FitNotes-Format';
    return 'CSV';
  },

  /** Zahl mit Punkt oder Komma, auch „1.234,5“ und „1,234.5“; leer oder unlesbar = null. */
  zahl(text) {
    let t = String(text).trim().replace(/[  ]/g, '');
    t = t.replace(/(kg|kgs|lbs|lb|km|mi|m|s|sec)$/i, '');
    if (!t) return null;
    const komma = t.lastIndexOf(','), punkt = t.lastIndexOf('.');
    if (komma >= 0 && punkt >= 0) t = komma > punkt ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
    else if (komma >= 0) t = t.replace(',', '.');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
    const v = Number(t);
    return Number.isFinite(v) ? v : null;
  },

  /** Sekunden aus „90“, „1:30“, „1:02:03“, „2h 5m“, „45s“; [minutenOhneEinheit]: reine Zahl = Minuten. */
  sekunden(text, minutenOhneEinheit = false) {
    const t = String(text).trim().toLowerCase();
    if (!t) return 0;
    if (t.includes(':')) {
      const p = t.split(':').map((x) => parseFloat(x.trim()) || 0);
      return Math.round(p.length >= 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + (p[1] || 0));
    }
    const g = (re) => { const m = t.match(re); return m ? Import.zahl(m[1]) : null; };
    const h = g(/(\d+(?:[.,]\d+)?)\s*h/), m = g(/(\d+(?:[.,]\d+)?)\s*(m(?!s)|min)/), s = g(/(\d+(?:[.,]\d+)?)\s*s/);
    if (h != null || m != null || s != null) return Math.round((h || 0) * 3600 + (m || 0) * 60 + (s || 0));
    const n = Import.zahl(t);
    if (n == null) return 0;
    return Math.round(minutenOhneEinheit ? n * 60 : n);
  },

  monat(w) {
    const M = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12, maer: 3, mrz: 3, mai: 5, okt: 10, dez: 12, januar: 1, februar: 2, maerz: 3, juni: 6, juli: 7 };
    const k = norm(w).replace(/ /g, '');
    return M[k] ?? M[k.slice(0, 4)] ?? M[k.slice(0, 3)] ?? null;
  },

  /** Datum und Uhrzeit aus den üblichen Schreibweisen. Ohne Zeitzone in der Datei gilt Ortszeit (oder UTC mit [utc]). */
  zeitpunkt(text, utc = false, tagZuerst = true) {
    const t = String(text).trim();
    if (!t) return null;
    if (/^\d+$/.test(t)) return t.length === 10 ? Number(t) * 1000 : t.length === 13 ? Number(t) : null;
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(t)) {
      const v = Date.parse(t.replace(' ', 'T'));
      if (!Number.isNaN(v)) return v;
    }
    const uhr = t.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/);
    let stunde = uhr ? +uhr[1] : 0;
    const minute = uhr ? +uhr[2] : 0;
    const sekunde = uhr && uhr[3] ? +uhr[3] : 0;
    const ap = uhr?.[4]?.toLowerCase();
    if (ap === 'pm' && stunde < 12) stunde += 12;
    if (ap === 'am' && stunde === 12) stunde = 0;
    const ohneUhr = uhr ? t.slice(0, uhr.index) + t.slice(uhr.index + uhr[0].length) : t;
    const jahr = (s) => { const j = +s; return j < 100 ? 2000 + j : j; };
    const datum = (j, m, d) => {
      if (j < 1970 || j > 2100 || m < 1 || m > 12 || d < 1) return null;
      const tage = new Date(Date.UTC(j, m, 0)).getUTCDate();
      return d > tage ? null : [j, m, d];
    };
    let dt = null;
    let m;
    if ((m = ohneUhr.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) dt = datum(+m[1], +m[2], +m[3]);
    else if ((m = ohneUhr.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2,4})/))) dt = datum(jahr(m[3]), +m[2], +m[1]);
    else if ((m = ohneUhr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) {
      const a = +m[1], b = +m[2];
      const tagErst = a > 12 ? true : b > 12 ? false : tagZuerst;
      dt = tagErst ? datum(jahr(m[3]), b, a) : datum(jahr(m[3]), a, b);
    } else if ((m = ohneUhr.match(/(\d{1,2})\.?\s+([A-Za-zÄÖÜäöü]{3,})\.?,?\s+(\d{4})/)) && Import.monat(m[2])) dt = datum(+m[3], Import.monat(m[2]), +m[1]);
    else if ((m = ohneUhr.match(/([A-Za-zÄÖÜäöü]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/)) && Import.monat(m[1])) dt = datum(+m[3], Import.monat(m[1]), +m[2]);
    if (!dt || stunde > 23 || minute > 59) return null;
    const s = Math.min(59, sekunde);
    return utc ? Date.UTC(dt[0], dt[1] - 1, dt[2], stunde, minute, s) : new Date(dt[0], dt[1] - 1, dt[2], stunde, minute, s).getTime();
  },

  tagZuerst(werte) {
    for (const w of werte) {
      const m = w.match(/^\s*(\d{1,2})\/(\d{1,2})\/\d{2,4}/);
      if (!m) continue;
      if (+m[1] > 12) return true;
      if (+m[2] > 12) return false;
    }
    return true;
  },

  satzTyp(text) {
    const t = norm(text);
    if (!t || /^\d+$/.test(t) || t === 'normal' || t === 'working') return 'NORMAL';
    if (t === 'w' || t === 'a' || t.startsWith('warm') || t.startsWith('aufwaerm')) return 'AUFWAERMEN';
    if (t === 'd' || t.startsWith('drop')) return 'DROP';
    if (t === 'f' || t === 'v' || t.startsWith('fail') || t.startsWith('versag')) return 'VERSAGEN';
    return null;
  },

  /** Liest eine Trainings-CSV. Übungen erst unter den eigenen, dann im Katalog; Unbekannte werden angelegt. */
  lese(text, stand, vorgabe = null, utc = false) {
    const tab = Import.tabelle(text);
    const { kopf, daten, stronger } = tab;
    if (!kopf.length || !daten.length) throw new ImportFehler('Die Datei enthält keine Tabelle mit Kopfzeile und Daten.');
    const herkunft = stronger ? 'Stronger-Export' : Import.quelle(kopf);
    const z = vorgabe || Import.erkenne(kopf);
    if (!vollstaendig(z)) throw new ImportFehler('Spalten nicht erkannt. Nötig sind Datum, Übung und mindestens Gewicht, Wiederholungen, Zeit oder Strecke.');
    const zelle = (r, f) => (f in z.spalten ? (r[z.spalten[f]] ?? '').trim() : '');
    const tagErst = Import.tagZuerst(daten.map((r) => zelle(r, 'DATUM')));
    const einheiten = new Map();
    let uebersprungen = 0;
    const datumFehler = [];

    daten.forEach((r, idx) => {
      const name = zelle(r, 'UEBUNG');
      const start = Import.zeitpunkt(zelle(r, 'DATUM'), utc, tagErst);
      if (!name.trim()) { uebersprungen++; return; }
      if (start == null) { uebersprungen++; if (datumFehler.length < 10) datumFehler.push(idx + 2); return; }
      let typ = Import.satzTyp(zelle(r, 'SATZ'));
      if (typ === 'NORMAL') typ = Import.satzTyp(zelle(r, 'SATZTYP')) || 'NORMAL';
      if (typ == null) { uebersprungen++; return; }
      const einheitText = zelle(r, 'EINHEIT').toLowerCase();
      const lb = einheitText ? einheitText.startsWith('lb') || einheitText.startsWith('pound') : z.gewichtLb;
      let kg = (Import.zahl(zelle(r, 'GEWICHT')) ?? 0) * (lb ? LB : 1);
      kg = Math.round(kg * 100) / 100;
      if (norm(name).includes('assisted')) kg = -Math.abs(kg);
      const wdh = Math.min(10_000, Math.max(0, Math.round(Import.zahl(zelle(r, 'WDH')) ?? 0)));
      const sek = Math.min(100_000, Math.max(0, Import.sekunden(zelle(r, 'SEKUNDEN'))));
      const faktor = { m: 1, meter: 1, meters: 1, metres: 1, km: 1000, kilometer: 1000, kilometers: 1000, mi: 1609.344, mile: 1609.344, miles: 1609.344, yd: 0.9144, yards: 0.9144, ft: 0.3048, feet: 0.3048 }[zelle(r, 'STRECKE_EINHEIT').toLowerCase().trim()] ?? z.meterJeEinheit;
      const meter = (Import.zahl(zelle(r, 'STRECKE')) ?? 0) * faktor;
      if (kg === 0 && wdh === 0 && sek === 0 && meter <= 0) { uebersprungen++; return; }
      const rpeRoh = Import.zahl(zelle(r, 'RPE'));
      const rpe = rpeRoh != null && rpeRoh >= 1 && rpeRoh <= 10 ? rpeRoh : null;
      const trainingsName = zelle(r, 'TRAINING');
      const key = `${start}|${trainingsName}|${zelle(r, 'TRAINING_NR')}`;
      if (!einheiten.has(key)) einheiten.set(key, { key, start, name: trainingsName, roh: [], dauer: 0, notiz: '' });
      const e = einheiten.get(key);
      e.roh.push({ name, satz: satz({ gewicht: kg, wdh, sekunden: sek, meter, rpe, typ }), notiz: zelle(r, 'NOTIZ') });
      if (e.dauer === 0) {
        const d = zelle(r, 'DAUER');
        if (d) e.dauer = z.dauerInSekunden ? Math.round(Import.zahl(d) ?? 0) : Import.sekunden(d, true);
        else { const ende = Import.zeitpunkt(zelle(r, 'ENDE'), utc, tagErst); e.dauer = ende != null ? Math.trunc((ende - start) / 1000) : 0; }
        e.dauer = Math.min(24 * 3600, Math.max(0, e.dauer));
      }
      if (!e.notiz) e.notiz = zelle(r, 'TRAINING_NOTIZ');
    });

    // Übungen zuordnen.
    const eigene = stand.uebungen;
    const zuNamen = new Map();
    const neu = [];
    const vergeben = new Set([...Object.keys(katalogNachId), ...eigene.map((u) => u.id)]);
    const gruppen = new Map();
    for (const e of einheiten.values()) for (const r of e.roh) { if (!gruppen.has(r.name)) gruppen.set(r.name, []); gruppen.get(r.name).push(r); }
    for (const [name, rohe] of gruppen) {
      const n = norm(name);
      const vorhanden = eigene.find((u) => norm(u.importName) === n || norm(u.name) === n);
      const koerper = !!stronger && stronger.koerpergewicht.has(n);
      let treffer;
      if (vorhanden) treffer = { name, uebung: vorhanden, katalog: vorhanden.id in katalogNachId, vorhanden: true, saetze: rohe.length };
      else {
        const t = finde(name);
        if (t.uebung && (!koerper || t.uebung.art === 'KOERPER')) treffer = { name, uebung: t.uebung, katalog: true, vorhanden: false, saetze: rohe.length };
        else {
          const ss = rohe.map((x) => x.satz);
          const art = koerper ? 'KOERPER'
            : t.art === 'CARDIO' || (ss.every((s) => s.wdh === 0) && ss.some((s) => s.meter > 0)) ? 'CARDIO'
              : ss.every((s) => s.wdh === 0) && ss.some((s) => s.sekunden > 0) ? 'ZEIT' : t.art;
          const basis = n.replace(/ /g, '-') || 'uebung';
          let id = 'e:' + basis;
          let i = 2;
          while (vergeben.has(id)) id = `e:${basis}-${i++}`;
          vergeben.add(id);
          const ohneMuskeln = koerper && t.art === 'CARDIO';
          const u = uebung({ id, name: name.trim(), art, primaer: ohneMuskeln ? [] : t.primaer, sekundaer: ohneMuskeln ? [] : t.sekundaer, importName: name.trim() });
          neu.push(u);
          treffer = { name, uebung: u, katalog: false, vorhanden: false, saetze: rohe.length };
        }
      }
      zuNamen.set(name, treffer);
    }

    const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); };
    const workouts = [...einheiten.values()].map((e) => {
      const bloecke = new Map();
      for (const r of e.roh) {
        const id = zuNamen.get(r.name).uebung.id;
        const b = bloecke.get(id) || { uebungId: id, saetze: [], notiz: '' };
        bloecke.set(id, { ...b, saetze: [...b.saetze, r.satz], notiz: b.notiz || r.notiz });
      }
      return workout({ id: `imp-${e.start}-${hash(e.key)}`, name: e.name.trim() || 'Training', start: e.start, dauerSek: e.dauer, bloecke: [...bloecke.values()], notiz: e.notiz, quelle: `Import ${herkunft}` });
    }).sort((a, b) => a.start - b.start);

    if (!workouts.length) {
      throw new ImportFehler(datumFehler.length ? `Kein Datum lesbar (z. B. Zeile ${datumFehler[0]}). Bitte die Datumsspalte prüfen.` : 'Keine Sätze gefunden. Stimmt die Zuordnung von Gewicht und Wiederholungen?');
    }
    const uebungen = [...zuNamen.values()].sort((a, b) => b.saetze - a.saetze);
    return {
      quelle: herkunft, kopf, zuordnung: z, workouts, neueUebungen: neu, uebungen,
      saetze: workouts.reduce((a, w) => a + w.bloecke.reduce((x, b) => x + b.saetze.length, 0), 0),
      zeilen: daten.length, uebersprungen, datumFehler,
      von: workouts[0].start, bis: workouts[workouts.length - 1].start,
      ohneMuskeln: uebungen.filter((t) => !t.uebung.primaer.length),
    };
  },

  /** Übernimmt die Trainings; schon vorhandene (Start auf die Minute gleich) werden übersprungen. → [stand, doppelt]. */
  uebernehmen(stand, e) {
    const minuten = new Set(stand.workouts.map((w) => Math.floor(w.start / 60_000)));
    const neu = e.workouts.filter((w) => !minuten.has(Math.floor(w.start / 60_000)));
    const doppelt = e.workouts.length - neu.length;
    const genutzt = new Set(neu.flatMap((w) => w.bloecke.map((b) => b.uebungId)));
    const ids = new Set(stand.uebungen.map((u) => u.id));
    const neueUebungen = e.neueUebungen.filter((u) => genutzt.has(u.id) && !ids.has(u.id));
    return [{ ...stand, uebungen: [...stand.uebungen, ...neueUebungen], workouts: [...stand.workouts, ...neu].sort((a, b) => a.start - b.start) }, doppelt];
  },
};

// ---------- Anleitung ----------

/** Umzug aus Stronger (Atlas Smart Technologies): Datenauskunft nach DSGVO. */
export const Anleitung = {
  schritte: [
    ['Warum eine Datenauskunft', 'Stronger hat keinen Export in der App. Deine Trainings liegen auf den Servern des Anbieters, nicht bei Google oder Apple. Nach Art. 15 und Art. 20 DSGVO muss der Anbieter dir deine Daten innerhalb eines Monats kostenlos herausgeben, auf Wunsch maschinenlesbar.'],
    ['Wer ist zuständig', 'Atlas Smart Technologies Ltd, Ballymena, Nordirland. Kontakt: stronger@strongermobileapp.com. Die Postanschrift steht im App Store bzw. Play Store bei Stronger unter den Angaben zum Entwickler.'],
    ['So schickst du den Brief', '1. „Brief kopieren“ tippen.\n2. Neue Mail an stronger@strongermobileapp.com, und zwar von der Adresse, mit der du dich in Stronger anmeldest. So kann der Anbieter dich ohne Ausweis zuordnen. Keinen Ausweis mitschicken.\n3. Platzhalter in eckigen Klammern ausfüllen, Frist = heute plus ein Monat.\n4. Abschicken und eine Erinnerung für den Fristtag setzen.'],
    ['Wenn die Antwort da ist', 'Die Datei („Stronger — Personal Data Export“, CSV) hier unter „Daten → Datei wählen“ importieren. Sie wird direkt erkannt. Klappt es nicht, lassen sich die Spalten von Hand zuordnen.'],
    ['Wenn nichts oder zu wenig kommt', 'Nach einem Monat mit Verweis auf die Frist erinnern und 14 Tage Nachfrist setzen. Nur PDF oder Screenshots: maschinenlesbare Daten nach Art. 20 nachfordern. Danach Beschwerde bei der britischen Datenschutzbehörde ICO (ico.org.uk) oder bei der Datenschutzbehörde deines Bundeslands. Beides ist kostenlos.'],
    ['Wichtig bis dahin', 'Stronger nicht löschen, bevor die Daten importiert sind: Mit dem Konto verschwinden auch die Trainings. Neue Trainings kannst du schon hier erfassen, der spätere Import überspringt doppelte.'],
  ],
  brief: `Subject: Subject Access Request and Data Portability Request (Art. 15 and Art. 20 UK GDPR / EU GDPR)

Dear Sir or Madam,

I use your app "Stronger – Workout Gym Tracker" and sign in with the account [your email address]. This email is sent from that address.

Under Article 15 of the UK GDPR and the EU GDPR (which applies to you under Article 3(2), as you offer the app to users in Germany), I request:

1. confirmation whether you process personal data about me, and a copy of all such data;
2. the information listed in Article 15(1)(a) to (h), in particular the purposes, the recipients, the storage period and the source of the data.

Under Article 20, I also request the personal data I have provided to you in a structured, commonly used and machine-readable format. Please include in particular my complete workout history with, for every set: date and time of the workout, workout name, exercise name, set number, set type (e.g. warm-up), weight and unit, repetitions, duration and distance where applicable, RPE and notes; as well as my custom exercises, routines/templates, body weight and body measurements, and the personal details stored in my profile. CSV or JSON is ideal.

Please send the data to this email address. Under Article 12(3) you must respond without undue delay and at the latest within one month of receipt, i.e. by [date: today + 1 month]. The first copy is free of charge (Article 15(3)).

This is a request for my data only. Please do not delete my account.

Kind regards,
[first and last name]`,
};
