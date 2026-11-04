// Rechenlogik von „Food & Boost“, übertragen aus der Android-App (features/tracker/logic, Kotlin).
// Reines JavaScript ohne Oberfläche, damit sie sich mit Node testen lässt (test/logik.test.mjs).
// Datenformat (Feldnamen, Aufzählungen) wie in der Android-App, damit Sicherungen in beide Richtungen passen.

export const MINUTE = 60_000;
export const STUNDE = 60 * MINUTE;
export const TAG = 24 * STUNDE;

// ---------- Aufzählungen ----------

export const Kategorie = {
  LEBENSMITTEL: { text: 'Lebensmittel', mehrzahl: 'Lebensmittel', symbol: '🍽', boost: false },
  SUPPLEMENT: { text: 'Supplement', mehrzahl: 'Supplements', symbol: '💊', boost: true },
  PROTEIN: { text: 'Protein', mehrzahl: 'Proteine', symbol: '🥤', boost: true },
  BOOSTER: { text: 'Booster', mehrzahl: 'Booster', symbol: '⚡', boost: true },
};
export const KATEGORIEN = Object.keys(Kategorie);
export const istBoost = (k) => (Kategorie[k] || Kategorie.LEBENSMITTEL).boost;

export const Zeitpunkt = {
  MORGENS: { text: 'Morgens', symbol: '🌅', training: false },
  VOR_TRAINING: { text: 'Vor dem Training', symbol: '🏋', training: true },
  NACH_TRAINING: { text: 'Beim / nach dem Training', symbol: '💪', training: true },
  TAGSUEBER: { text: 'Über den Tag', symbol: '☀', training: false },
  ABENDS: { text: 'Abends', symbol: '🌙', training: false },
};
export const ZEITPUNKTE = Object.keys(Zeitpunkt);

export const Geschlecht = { MANN: 'männlich', FRAU: 'weiblich' };
export const WasserMethode = { WATSON: 'Watson (Standard)', KFA: 'aus Körperfettanteil' };

// ---------- Datenklassen (mit Vorgaben) ----------

export function koerper(o = {}) {
  return { gewichtKg: 75, groesseCm: 178, geburtsjahr: 1995, geschlecht: 'MANN', kfaProzent: 18, ...o };
}

export function einstellungen(o = {}) {
  return {
    wasserMethode: 'WATSON', abbauPromilleProH: 0.15, resorptionsdefizitProzent: 0, alkoholAufnahmeMin: 45,
    koffeinHalbwertszeitH: 5, koffeinAufnahmeMin: 45, koffeinSchlafgrenzeMg: 50, koffeinTageslimitMg: 400,
    aktivitaetsfaktor: 1.5, kcalZielManuell: 0, eiweissProKg: 1.6, fettAnteilProzent: 30, ballaststoffZielG: 30,
    trainingEinrechnen: false, grundfaktorMitTraining: 1.5, trinkenMlProKg: 35,
    ...o,
  };
}

export function naehrwerte(o = {}) {
  return { kcal: 0, fett: 0, gesaettigt: 0, kohlenhydrate: 0, zucker: 0, ballaststoffe: 0, eiweiss: 0, salz: 0, mikros: {}, ...o, mikros: { ...(o.mikros || {}) } };
}

const NW_FELDER = ['kcal', 'fett', 'gesaettigt', 'kohlenhydrate', 'zucker', 'ballaststoffe', 'eiweiss', 'salz'];

export function nwPlus(a, b) {
  const r = naehrwerte();
  for (const k of NW_FELDER) r[k] = (a[k] || 0) + (b[k] || 0);
  const m = { ...a.mikros };
  for (const [k, v] of Object.entries(b.mikros || {})) m[k] = (m[k] || 0) + v;
  r.mikros = m;
  return r;
}

export function nwMal(a, f) {
  const r = naehrwerte();
  for (const k of NW_FELDER) r[k] = (a[k] || 0) * f;
  r.mikros = Object.fromEntries(Object.entries(a.mikros || {}).map(([k, v]) => [k, v * f]));
  return r;
}

export const nwLeer = (n) => !n.kcal && !n.fett && !n.kohlenhydrate && !n.eiweiss && !n.salz && Object.keys(n.mikros || {}).length === 0;

export function produkt(o = {}) {
  return {
    id: '', name: '', fluessig: false, portion: 100, volProzent: 0, koffeinMgPro100: 0, favorit: false, zuletzt: 0,
    ean: '', kategorie: 'LEBENSMITTEL', portionName: '', vorrat: 0, vorratSeit: 0, pruefen: false, plan: [], planMenge: 0,
    kurWochen: 0,
    ...o,
    naehrwerte: naehrwerte(o.naehrwerte),
    plan: [...(o.plan || [])],
  };
}

export const einheit = (p) => (p.fluessig ? 'ml' : 'g');
export const portionText = (p) => (p.portionName || '').trim() || 'Portion';
export const einnahme = (p) => (p.planMenge > 0 ? p.planMenge : p.portion);
export const stueckig = (p) => p.portion > 0 && /kapsel|tablette|softgel|dragee|cap/i.test(p.portionName || '');

export function eintragObj(o = {}) {
  return {
    id: '', zeit: 0, name: '', produktId: null, menge: 0, fluessig: false, alkoholG: 0, koffeinMg: 0, mitEssen: false,
    kategorie: 'LEBENSMITTEL', ...o, naehrwerte: naehrwerte(o.naehrwerte),
  };
}

/** Eintrag für [menge] g/ml. Ohne Nährwertangabe zählt bei Alkohol die Energie des Alkohols. */
export function eintragAus(p, id, zeit, menge, mitEssen = false) {
  const alk = Pegel.alkoholGramm(menge, p.volProzent);
  const nw = nwLeer(p.naehrwerte) && alk > 0 ? naehrwerte({ kcal: alk * Pegel.KCAL_PRO_G_ALKOHOL }) : nwMal(p.naehrwerte, menge / 100);
  return eintragObj({
    id, zeit, name: p.name, produktId: p.id, menge, fluessig: p.fluessig, alkoholG: alk,
    koffeinMg: (p.koffeinMgPro100 * menge) / 100, naehrwerte: nw, mitEssen, kategorie: p.kategorie,
  });
}

/** Eintrag als Produkt mit genau diesen Werten (zum Ändern der Menge). */
export function eintragAlsProdukt(e) {
  const m = e.menge > 0 ? e.menge : 100;
  const f = 100 / m;
  return produkt({
    id: e.produktId || '', name: e.name, fluessig: e.fluessig, portion: m,
    volProzent: e.alkoholG > 0 ? (e.alkoholG / (m * Pegel.DICHTE_ALKOHOL)) * 100 : 0,
    koffeinMgPro100: e.koffeinMg * f, naehrwerte: nwMal(e.naehrwerte, f), kategorie: e.kategorie,
  });
}

export function eintragAendern(e, menge, zeit, mitEssen) {
  return { ...eintragAus(eintragAlsProdukt(e), e.id, zeit, menge, mitEssen), produktId: e.produktId };
}

// ---------- Stand ----------

export const STAND_VERSION = 2;

export function neuerStand() {
  return { version: STAND_VERSION, koerper: koerper(), einstellungen: einstellungen(), produkte: Vorgaben.produkte(), eintraege: [], eingerichtet: false, profil: false };
}

/** Gelesenen Stand (Sicherung, auch aus der Android-App) mit Vorgaben auffüllen. */
export function standLesen(o) {
  if (!o || typeof o !== 'object' || !Array.isArray(o.produkte) || !Array.isArray(o.eintraege)) {
    throw new Error('Die Datei ist keine Food-&-Boost-Sicherung.');
  }
  return {
    version: STAND_VERSION,
    koerper: koerper(o.koerper),
    einstellungen: einstellungen(o.einstellungen),
    produkte: o.produkte.map(produkt),
    eintraege: o.eintraege.map(eintragObj).sort((a, b) => a.zeit - b.zeit),
    eingerichtet: o.eingerichtet !== false,
    /** Körperdaten wurden im gemeinsamen Profil eingetragen (gelten auch fürs Training). */
    profil: !!o.profil,
  };
}

/** Körperdaten gelten als eingetragen (für Training und Übersicht). */
export const profilGesetzt = (s) => !!(s.eingerichtet || s.profil);

export const S = {
  produkt: (s, id) => s.produkte.find((p) => p.id === id) || null,
  produktMitEan(s, code) {
    const n = Barcode.normal(code);
    return n ? s.produkte.find((p) => p.ean && Barcode.normal(p.ean) === n) || null : null;
  },
  speichern(s, p) {
    const da = s.produkte.some((x) => x.id === p.id);
    return { ...s, produkte: da ? s.produkte.map((x) => (x.id === p.id ? p : x)) : [...s.produkte, p] };
  },
  /** Speichert p und rechnet Einträge dieses Produkts ab [ab] neu. Gibt [stand, anzahl] zurück. */
  speichernMitEintraegen(s, p, ab) {
    let n = 0;
    const neu = s.eintraege.map((e) => {
      if (e.produktId !== p.id || e.zeit < ab) return e;
      const x = eintragAus(p, e.id, e.zeit, e.menge, e.mitEssen);
      if (JSON.stringify(x) !== JSON.stringify(e)) n++;
      return x;
    });
    return [{ ...S.speichern(s, p), eintraege: neu }, n];
  },
  produktLoeschen: (s, id) => ({ ...s, produkte: s.produkte.filter((p) => p.id !== id) }),
  eintragen: (s, e) => ({
    ...s,
    eintraege: [...s.eintraege, e].sort((a, b) => a.zeit - b.zeit),
    produkte: s.produkte.map((p) => (p.id === e.produktId ? { ...p, zuletzt: Math.max(p.zuletzt, e.zeit) } : p)),
  }),
  eintragAendern: (s, e) => ({ ...s, eintraege: s.eintraege.map((x) => (x.id === e.id ? e : x)).sort((a, b) => a.zeit - b.zeit) }),
  eintragLoeschen: (s, id) => ({ ...s, eintraege: s.eintraege.filter((e) => e.id !== id) }),
  eintraege: (s, von, bis) => s.eintraege.filter((e) => e.zeit >= von && e.zeit < bis),
};

// ---------- Pegel ----------

export const Pegel = {
  DICHTE_ALKOHOL: 0.789,
  KCAL_PRO_G_ALKOHOL: 7.1,
  RUECKBLICK: 48 * STUNDE,

  alkoholGramm: (ml, vol) => (ml * vol) / 100 * 0.789,
  alter: (k, jahr) => Math.min(120, Math.max(14, jahr - k.geburtsjahr)),

  koerperwasser(k, e, jahr) {
    let w;
    if (e.wasserMethode === 'KFA') w = 0.73 * k.gewichtKg * (1 - Math.min(60, Math.max(3, k.kfaProzent)) / 100);
    else if (k.geschlecht === 'FRAU') w = -2.097 + 0.1069 * k.groesseCm + 0.2466 * k.gewichtKg;
    else w = 2.447 - 0.09516 * Pegel.alter(k, jahr) + 0.1074 * k.groesseCm + 0.3362 * k.gewichtKg;
    return Math.max(10, w);
  },
  rFaktor: (k, e, jahr) => (1.055 * Pegel.koerperwasser(k, e, jahr)) / (0.8 * k.gewichtKg),
  promilleProGramm: (k, e, jahr) =>
    ((1 - Math.min(50, Math.max(0, e.resorptionsdefizitProzent)) / 100) * 0.8) / (1.055 * Pegel.koerperwasser(k, e, jahr)),

  _anteil(start, dauer, a, b) {
    if (dauer <= 0) return start >= a && start < b ? 1 : 0;
    const von = Math.max(a, start), bis = Math.min(b, start + dauer);
    return bis <= von ? 0 : (bis - von) / dauer;
  },

  _simuliere(erster, von, bis, raster, schritt) {
    const r = Math.max(MINUTE, raster);
    const aus = [];
    let wert = 0;
    let t = erster == null || erster >= von ? von : von - (Math.floor((von - erster) / MINUTE) + 1) * MINUTE;
    while (t <= bis) {
      if (t >= von && (t - von) % r === 0) aus.push({ zeit: t, wert });
      wert = schritt(wert, t, t + MINUTE);
      t += MINUTE;
    }
    return aus;
  },

  alkoholVerlauf(s, von, bis, jahr, raster = MINUTE) {
    const ein = s.einstellungen;
    const rel = s.eintraege.filter((e) => e.alkoholG > 0 && e.zeit >= von - Pegel.RUECKBLICK && e.zeit < bis);
    const proG = Pegel.promilleProGramm(s.koerper, ein, jahr);
    const abbau = Math.max(0, ein.abbauPromilleProH) / 60;
    const erster = rel.length ? Math.min(...rel.map((e) => e.zeit)) : null;
    return Pegel._simuliere(erster, von, bis, raster, (c, a, b) => {
      let zu = 0;
      for (const e of rel) zu += e.alkoholG * Pegel._anteil(e.zeit, ein.alkoholAufnahmeMin * MINUTE * (e.mitEssen ? 2 : 1), a, b);
      return Math.max(0, c + zu * proG - abbau);
    });
  },

  koffeinVerlauf(s, von, bis, raster = MINUTE) {
    const ein = s.einstellungen;
    const rel = s.eintraege.filter((e) => e.koffeinMg > 0 && e.zeit >= von - Pegel.RUECKBLICK && e.zeit < bis);
    const faktor = Math.exp(-Math.LN2 / (Math.max(0.5, ein.koffeinHalbwertszeitH) * 60));
    const dauer = ein.koffeinAufnahmeMin * MINUTE;
    const erster = rel.length ? Math.min(...rel.map((e) => e.zeit)) : null;
    return Pegel._simuliere(erster, von, bis, raster, (m, a, b) => {
      let zu = 0;
      for (const e of rel) zu += e.koffeinMg * Pegel._anteil(e.zeit, dauer, a, b);
      return m * faktor + zu;
    });
  },

  lage(s, jetzt, jahr, vorschau = 48 * STUNDE) {
    const alk = Pegel.alkoholVerlauf(s, jetzt, jetzt + vorschau, jahr);
    const kof = Pegel.koffeinVerlauf(s, jetzt, jetzt + vorschau);
    const maxBy = (l) => l.reduce((m, p) => (p.wert > m.wert ? p : m), l[0]);
    const lastWo = (l, f) => { for (let i = l.length - 1; i >= 0; i--) if (f(l[i])) return l[i]; return null; };
    const as = maxBy(alk), ks = maxBy(kof);
    const la = lastWo(alk, (p) => p.wert > 0);
    const g = s.einstellungen.koffeinSchlafgrenzeMg;
    const lk = lastWo(kof, (p) => p.wert >= g);
    return {
      promille: alk[0].wert, promilleSpitze: as.wert, promilleSpitzeUm: as.zeit, nuechternUm: la ? la.zeit + MINUTE : null,
      koffeinMg: kof[0].wert, koffeinSpitzeMg: ks.wert, koffeinSpitzeUm: ks.zeit, schlafgrenzeUm: lk ? lk.zeit + MINUTE : null,
    };
  },

  koffeinSumme: (s, von, bis) => S.eintraege(s, von, bis).reduce((a, e) => a + e.koffeinMg, 0),
};

// ---------- Mikros, Wirkstoffe, Ziele ----------

const mk = (key, name, einheit, referenzMann, referenzFrau, namen, wirkstoff = false, dosis = 0) => ({ key, name, einheit, referenzMann, referenzFrau, namen, wirkstoff, dosis });
const w = (key, name, einheit, dosis, ...namen) => mk('w_' + key, name, einheit, 0, 0, namen, true, dosis);

export const Wirkstoffe = [
  w('kreatin', 'Kreatin', 'g', 5, 'kreatin', 'creatin', 'creatine', 'kreatin-monohydrat', 'creapure'),
  w('betaalanin', 'Beta-Alanin', 'g', 3.2, 'beta-alanin', 'beta alanin', 'beta-alanine'),
  w('citrullin', 'Citrullin', 'g', 6, 'citrullin', 'l-citrullin', 'citrullin-malat', 'citrulline'),
  w('arginin', 'Arginin (AAKG)', 'g', 3, 'arginin', 'l-arginin', 'aakg', 'arginin-alpha-ketoglutarat'),
  w('taurin', 'Taurin', 'g', 2, 'taurin', 'taurine'),
  w('tyrosin', 'Tyrosin', 'g', 1, 'tyrosin', 'l-tyrosin', 'n-acetyl-l-tyrosin'),
  w('glycin', 'Glycin', 'g', 3, 'glycin', 'glycine'),
  w('kollagen', 'Kollagen', 'g', 10, 'kollagen', 'collagen', 'kollagenpeptide', 'kollagenhydrolysat'),
  w('hmb', 'HMB', 'g', 3, 'hmb', 'beta-hydroxy-beta-methylbutyrat'),
  w('carnitin', 'Acetyl-L-Carnitin', 'mg', 1500, 'carnitin', 'l-carnitin', 'acetyl-l-carnitin', 'alcar'),
  w('daa', 'D-Asparaginsäure', 'g', 3, 'd-asparaginsaure', 'd-asparaginsäure'),
  w('tryptophan', 'L-Tryptophan', 'mg', 1000, 'tryptophan', 'l-tryptophan'),
  w('nac', 'N-Acetyl-L-Cystein', 'mg', 600, 'n-acetyl-l-cystein', 'acetylcystein'),
  w('htp', '5-HTP', 'mg', 100, '5-htp', '5-hydroxytryptophan'),
  w('ashwagandha', 'Ashwagandha', 'mg', 600, 'ashwagandha', 'ksm-66', 'withania'),
  w('bcaa', 'BCAA / EAA', 'g', 5, 'bcaa', 'essentielle aminosauren', 'leucin'),
  w('natrium', 'Natrium', 'mg', 0, 'natrium', 'sodium'),
];

export const MIKROS = [
  mk('vitA', 'Vitamin A', 'µg', 850, 700, ['vitamin a', 'retinol']),
  mk('vitD', 'Vitamin D', 'µg', 20, 20, ['vitamin d', 'vitamin d3', 'cholecalciferol']),
  mk('vitE', 'Vitamin E', 'mg', 14, 11, ['vitamin e', 'tocopherol']),
  mk('vitK', 'Vitamin K', 'µg', 80, 65, ['vitamin k', 'vitamin k1', 'vitamin k2']),
  mk('vitC', 'Vitamin C', 'mg', 110, 95, ['vitamin c', 'ascorbinsaure', 'ascorbinsäure']),
  mk('b1', 'Vitamin B1', 'mg', 1.2, 1.0, ['vitamin b1', 'thiamin']),
  mk('b2', 'Vitamin B2', 'mg', 1.4, 1.1, ['vitamin b2', 'riboflavin']),
  mk('niacin', 'Niacin', 'mg', 15, 12, ['niacin', 'vitamin b3']),
  mk('b5', 'Pantothensäure', 'mg', 5, 5, ['pantothensaure', 'pantothensäure', 'vitamin b5']),
  mk('b6', 'Vitamin B6', 'mg', 1.6, 1.4, ['vitamin b6', 'pyridoxin']),
  mk('biotin', 'Biotin', 'µg', 40, 40, ['biotin', 'vitamin b7']),
  mk('folat', 'Folat', 'µg', 300, 300, ['folsaure', 'folsäure', 'folat', 'vitamin b9']),
  mk('b12', 'Vitamin B12', 'µg', 4, 4, ['vitamin b12', 'cobalamin']),
  mk('calcium', 'Calcium', 'mg', 1000, 1000, ['calcium', 'kalzium']),
  mk('magnesium', 'Magnesium', 'mg', 350, 300, ['magnesium']),
  mk('kalium', 'Kalium', 'mg', 4000, 4000, ['kalium']),
  mk('eisen', 'Eisen', 'mg', 11, 14, ['eisen']),
  mk('zink', 'Zink', 'mg', 14, 8, ['zink']),
  mk('phosphor', 'Phosphor', 'mg', 550, 550, ['phosphor']),
  mk('jod', 'Jod', 'µg', 200, 150, ['jod', 'iod']),
  mk('selen', 'Selen', 'µg', 70, 60, ['selen']),
  mk('kupfer', 'Kupfer', 'mg', 1.5, 1.2, ['kupfer']),
  mk('mangan', 'Mangan', 'mg', 3, 3, ['mangan']),
  mk('chlorid', 'Chlorid', 'mg', 2300, 2300, ['chlorid']),
  mk('fluorid', 'Fluorid', 'mg', 3.8, 3.1, ['fluorid']),
  mk('omega3', 'Omega-3-Fettsäuren', 'g', 1.6, 1.1, ['omega-3', 'omega 3', 'omega-3-fettsauren', 'omega-3-fettsäuren']),
  mk('koffein', 'Koffein (lt. Etikett)', 'mg', 0, 0, ['koffein', 'coffein']),
  ...Wirkstoffe,
];

export const Mikros = {
  alle: MIKROS,
  vitamineUndMineralien: MIKROS.filter((m) => !m.wirkstoff),
  mikro: (key) => MIKROS.find((m) => m.key === key) || null,
  referenz: (m, g) => (g === 'FRAU' ? m.referenzFrau : m.referenzMann),
  ergaenzungsmittel: (name) => /tablette|kapsel|dragee|nahrungserg|supplement|brause|multivitamin|softgel|tropfen/i.test(name),
  plausibel(key, pro100, ergaenzung = false) {
    const m = Mikros.mikro(key);
    if (!m) return true;
    const ref = Math.max(m.referenzMann, m.referenzFrau);
    if (ref <= 0) return true;
    const gramm = m.einheit === 'µg' ? pro100 / 1e6 : m.einheit === 'mg' ? pro100 / 1e3 : pro100;
    if (gramm > 100) return false;
    return ergaenzung || pro100 <= 50 * ref;
  },
  auffaellig(eintraege, g) {
    const r = [];
    for (const m of MIKROS) {
      const ref = Mikros.referenz(m, g);
      if (ref <= 0) continue;
      const summe = eintraege.reduce((a, e) => a + (e.naehrwerte.mikros[m.key] || 0), 0);
      if (summe <= 20 * ref) continue;
      const e = eintraege.reduce((best, x) => ((x.naehrwerte.mikros[m.key] || 0) > (best?.naehrwerte.mikros[m.key] || 0) ? x : best), null);
      if (e) r.push({ mikro: m, summe, eintrag: e });
    }
    return r;
  },
};

export const Ziele = {
  grundumsatz: (k, jahr) => 10 * k.gewichtKg + 6.25 * k.groesseCm - 5 * Pegel.alter(k, jahr) + (k.geschlecht === 'MANN' ? 5 : -161),
  berechnen(k, e, jahr, trainingKcal = 0) {
    const gu = Ziele.grundumsatz(k, jahr);
    const training = e.trainingEinrechnen ? trainingKcal : 0;
    const kcal = e.kcalZielManuell > 0 ? e.kcalZielManuell + training : e.trainingEinrechnen ? gu * e.grundfaktorMitTraining + training : gu * e.aktivitaetsfaktor;
    const eiweiss = e.eiweissProKg * k.gewichtKg;
    const fett = (kcal * e.fettAnteilProzent) / 100 / 9;
    const kh = Math.max(0, (kcal - eiweiss * 4 - fett * 9) / 4);
    return { grundumsatz: gu, kcal, eiweiss, fett, kohlenhydrate: kh, ballaststoffe: e.ballaststoffZielG, salzMax: 6, zuckerMax: (kcal * 0.1) / 4, gesaettigtMax: (kcal * 0.1) / 9 };
  },
  ABSCHNITTE: [['morgens', 10], ['mittags', 14], ['nachmittags', 18], ['abends', 24]],
  eiweissVerteilung(eintraege, k, stunde) {
    const je = Ziele.ABSCHNITTE.map(([n]) => [n, 0]);
    for (const e of eintraege) {
      let i = Ziele.ABSCHNITTE.findIndex(([, h]) => stunde(e.zeit) < h);
      if (i < 0) i = 0;
      je[i][1] += e.naehrwerte.eiweiss;
    }
    return { abschnitte: je, zielJeMahlzeit: 0.4 * k.gewichtKg };
  },
  trinken: (eintraege, k, e, trainiert) => [
    eintraege.filter((x) => x.fluessig && x.alkoholG <= 0).reduce((a, x) => a + x.menge, 0),
    e.trinkenMlProKg * k.gewichtKg + (trainiert ? 500 : 0),
  ],
  summe: (s, von, bis) => S.eintraege(s, von, bis).reduce((a, e) => nwPlus(a, e.naehrwerte), naehrwerte()),
};

// ---------- Format ----------

export const Format = {
  zahl(d, stellen = 1) {
    if (!Number.isFinite(d)) return '–';
    const f = 10 ** stellen;
    const r = Math.round(d * f) / f;
    return String(Object.is(r, -0) ? 0 : r).replace('.', ',');
  },
  wert(d, stellen = 1) {
    if (!Number.isFinite(d) || Math.abs(d) < 10000) return Format.zahl(d, stellen);
    let exp = Math.floor(Math.floor(Math.log10(Math.abs(d))) / 3) * 3;
    let man = Math.round((d / 10 ** exp) * 100) / 100;
    if (Math.abs(man) >= 1000) { man /= 1000; exp += 3; }
    return `${Format.zahl(man, 2)} × 10${String(exp).split('').map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join('')}`;
  },
  promille: (d) => d.toFixed(2).replace('.', ',') + ' ‰',
  parse(t) {
    const s = String(t ?? '').trim().replace(',', '.');
    if (s === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    return parseFloat(s);
  },
  tausend: (n) => Math.round(n).toLocaleString('de-DE'),
};

// ---------- Boost ----------

export const Boost = {
  plan(s, von, bis) {
    const heute = S.eintraege(s, von, bis);
    const r = [];
    for (const p of s.produkte.filter((p) => p.plan.length)) {
      const genommen = heute.filter((e) => e.produktId === p.id).length;
      [...p.plan].sort((a, b) => ZEITPUNKTE.indexOf(a) - ZEITPUNKTE.indexOf(b))
        .forEach((z, i) => r.push({ produkt: p, zeitpunkt: z, nr: i + 1, erledigt: i < genommen }));
    }
    return r.sort((a, b) => ZEITPUNKTE.indexOf(a.zeitpunkt) - ZEITPUNKTE.indexOf(b.zeitpunkt) || a.produkt.name.toLowerCase().localeCompare(b.produkt.name.toLowerCase()));
  },
  vorrat(s, p) {
    if (!p.vorratSeit) return null;
    const weg = s.eintraege.filter((e) => e.produktId === p.id && e.zeit >= p.vorratSeit).reduce((a, e) => a + e.menge, 0);
    return Math.max(0, p.vorrat - weg);
  },
  verbrauchProTag(s, p, jetzt, tage = 14) {
    const ab = Math.max(jetzt - tage * TAG, p.vorratSeit);
    const e = s.eintraege.filter((x) => x.produktId === p.id && x.zeit >= ab && x.zeit <= jetzt);
    if (!e.length) return null;
    const spanne = (jetzt - Math.min(...e.map((x) => x.zeit))) / TAG + 1;
    return e.reduce((a, x) => a + x.menge, 0) / spanne;
  },
  reichweiteTage(s, p, jetzt) {
    const rest = Boost.vorrat(s, p);
    if (rest == null) return null;
    const proTag = Boost.verbrauchProTag(s, p, jetzt) ?? (p.plan.length ? p.plan.length * einnahme(p) : null);
    if (proTag == null || proTag <= 0) return null;
    return Math.floor(rest / proTag);
  },
  mengeText: (p, menge) => (stueckig(p) ? `${Format.zahl(menge / p.portion, 1)} × ${portionText(p)}` : `${Format.zahl(menge, 1)} ${einheit(p)}`),
  tageAmStueck(s, p, jetzt, tagBeginn) {
    const tage = new Set(s.eintraege.filter((e) => e.produktId === p.id && e.zeit <= jetzt).map((e) => tagBeginn(e.zeit)));
    let t = tagBeginn(jetzt);
    if (!tage.has(t)) t = tagBeginn(t - 1);
    let n = 0;
    while (tage.has(t)) { n++; t = tagBeginn(t - 1); }
    return n;
  },
  warnungen(s, von, bis, tagBeginn) {
    const heute = S.eintraege(s, von, bis);
    const summe = (k) => heute.reduce((a, e) => a + (e.naehrwerte.mikros[k] || 0), 0);
    const w = [];
    if (summe('w_htp') > 0 && summe('w_tryptophan') > 0) {
      w.push('5-HTP und L-Tryptophan am selben Tag: gleicher Serotonin-Weg, das kann Übelkeit und Kopfschmerzen machen. Nimm nur eines von beiden, und keines zusammen mit SSRI oder MAO-Hemmern.');
    }
    // Höchstmengen aus dem Wissen, gezählt über Supplements, Proteine und Booster (Essen hat oft keine Mikros).
    const boost = heute.filter((e) => istBoost(e.kategorie));
    for (const i of Object.values(Wissen.infos).filter((i) => i.maxTag > 0 && i.key !== 'koffein')) {
      const v = boost.reduce((a, e) => a + (e.naehrwerte.mikros[i.key] || 0), 0);
      if (v > i.maxTag * 1.0001) {
        const m = Mikros.mikro(i.key);
        const ie = i.key === 'vitD' ? ` (${Format.zahl(v * 40, 0)} IE)` : '';
        w.push(`${m?.name || i.key} heute ${Format.zahl(v, v < 10 ? 2 : 0)} ${m?.einheit || ''}${ie} aus Supplements, mehr als ${i.maxText}.`);
      }
    }
    const koffeinTag = heute.reduce((a, e) => a + e.koffeinMg, 0);
    if (koffeinTag > 400.5) w.push(`Koffein heute ${Format.zahl(koffeinTag, 0)} mg, mehr als 400 mg pro Tag (EFSA).`);
    const spaet = boost.filter((e) => e.koffeinMg > 0 && Math.floor((e.zeit - tagBeginn(e.zeit)) / STUNDE) >= 17);
    if (spaet.length) w.push(`Koffein am Abend (${spaet.map((e) => e.name).join(', ')}): stört den Schlaf und beißt sich mit Magnesium, Glycin und 5-HTP.`);
    for (const p of s.produkte.filter((p) => p.kurWochen > 0)) {
      const n = Boost.tageAmStueck(s, p, bis - 1, tagBeginn);
      if (n > p.kurWochen * 7) w.push(`${p.name}: seit ${n} Tagen am Stück. Empfohlen sind höchstens ${p.kurWochen} Wochen, dann eine Pause.`);
    }
    return w;
  },
};

// ---------- Wissen: Höchstmengen, Wechselwirkungen, Kur und Zeitpunkt (wie Wissen.kt) ----------

/**
 * Grundlage: EFSA-Höchstmengen (Tolerable Upper Intake Level), BfR-Empfehlungen für Nahrungsergänzungsmittel.
 * Orientierung, keine Beratung. [maxTag] in der Einheit aus [Mikros] (0 = keine feste Grenze).
 */
export const Wissen = (() => {
  const M = 'MORGENS', V = 'VOR_TRAINING', N = 'NACH_TRAINING', T = 'TAGSUEBER', A = 'ABENDS';
  const i = (key, tipp, maxTag = 0, maxText = '', o = {}) => ({ key, tipp, maxTag, maxText, kurWochen: o.kur || 0, zeitpunkte: o.zeit || [] });
  const infos = Object.fromEntries([
    // Vitamine und Mineralstoffe
    i('vitD', 'Fettlöslich, am besten zu einer Mahlzeit. 1 µg = 40 IE.', 100, '100 µg (4000 IE) pro Tag (EFSA)', { zeit: [M] }),
    i('vitA', 'Fettlöslich, reichert sich an. Viel davon steckt schon in Leber und Multivitaminen.', 3000, '3000 µg pro Tag (EFSA)'),
    i('vitE', 'Fettlöslich, zu einer Mahlzeit.', 300, '300 mg pro Tag (EFSA)'),
    i('b6', 'Zu viel über längere Zeit kann Nerven schädigen.', 12, '12 mg pro Tag (EFSA 2023)'),
    i('folat', 'Grenze gilt für Folsäure aus Supplements.', 1000, '1000 µg Folsäure pro Tag (EFSA)'),
    i('zink', 'Zu einer Mahlzeit, nicht zusammen mit Eisen oder Calcium. Dauerhaft viel Zink senkt Kupfer.', 25, '25 mg pro Tag (EFSA)', { zeit: [T] }),
    i('magnesium', 'Abends gut verträglich; zu viel auf einmal macht weichen Stuhl, besser aufteilen.', 250, '250 mg pro Tag aus Supplements (EFSA)', { zeit: [A] }),
    i('calcium', 'Nicht zusammen mit Zink oder Eisen einnehmen.', 2500, '2500 mg pro Tag (EFSA)'),
    i('selen', 'Schmaler Bereich zwischen Bedarf und zu viel.', 255, '255 µg pro Tag (EFSA 2023)'),
    i('jod', 'Bei Schilddrüsenerkrankungen nur nach Rücksprache.', 600, '600 µg pro Tag (EFSA)'),
    i('kupfer', 'Wird von viel Zink verdrängt.', 5, '5 mg pro Tag (EFSA)'),
    i('eisen', 'Nur bei nachgewiesenem Mangel; nicht mit Calcium, Kaffee oder Tee.', 0),
    i('omega3', 'Zu einer Mahlzeit. EPA und DHA zusammen bis 5 g pro Tag gelten als unbedenklich (EFSA).', 5, '5 g EPA + DHA pro Tag (EFSA)'),
    i('koffein', 'Nicht nach etwa 16 Uhr, sonst leidet der Schlaf.', 400, '400 mg pro Tag, 200 mg auf einmal (EFSA)', { zeit: [M, V] }),
    // Wirkstoffe
    i('w_kreatin', 'Täglich, Zeitpunkt egal (nach dem Training praktisch). Mehr als 3 bis 5 g bringt nichts; viel trinken.', 10, '3–5 g reichen, mehr als 10 g sind unnötig', { zeit: [N] }),
    i('w_betaalanin', 'Kribbeln ist harmlos; in Portionen bis etwa 2,5 g aufteilen. Wirkt über Wochen, nicht akut.', 6.4, '3,2–6,4 g pro Tag, aufgeteilt', { zeit: [V, N] }),
    i('w_citrullin', '30 bis 60 Minuten vor dem Training.', 10, '6–8 g vor dem Training', { zeit: [V] }),
    i('w_arginin', 'Vor dem Training. Senkt den Blutdruck leicht: Vorsicht mit Blutdruckmitteln und Potenzmitteln.', 9, '3–6 g pro Tag', { zeit: [V] }),
    i('w_taurin', 'Steckt oft schon in Energy Drinks und Boostern.', 3, '3 g pro Tag gelten als sicher (EFSA)'),
    i('w_tyrosin', 'Morgens oder vor dem Training, nüchtern. Nicht mit MAO-Hemmern oder Schilddrüsenhormonen.', 2, '0,5–2 g pro Tag', { zeit: [M, V] }),
    i('w_glycin', 'Abends 30 bis 60 Minuten vor dem Schlafen; passt gut zu NAC.', 5, '3 g abends', { zeit: [A] }),
    i('w_kollagen', 'Zählt als Eiweiß, ist aber kein vollständiges Protein; mit Vitamin C kombinierbar.', 20, '10–15 g pro Tag', { zeit: [T] }),
    i('w_hmb', 'In 3 Portionen zu je 1 g über den Tag. Lohnt vor allem bei hartem Training oder im Defizit.', 3, '3 g pro Tag', { zeit: [N, T] }),
    i('w_carnitin', 'Morgens oder vor dem Training, gern nüchtern.', 2000, '1,5–2 g pro Tag', { zeit: [M] }),
    i('w_daa', 'Nur als Kur: 4 bis 6 Wochen, dann Pause; der Effekt lässt sonst nach.', 3, '3 g pro Tag', { kur: 6, zeit: [A] }),
    i('w_tryptophan', 'Abends. Nie am selben Tag wie 5-HTP und nicht mit Antidepressiva (SSRI, MAO-Hemmer).', 1000, '0,5–1 g abends', { zeit: [A] }),
    i('w_nac', 'Einmal täglich; gut kombinierbar mit Glycin.', 1200, '600–1200 mg pro Tag', { zeit: [M] }),
    i('w_htp', 'Abends, nüchtern. Nie am selben Tag wie L-Tryptophan und nicht mit Antidepressiva (SSRI, MAO-Hemmer).', 100, '50–100 mg abends', { zeit: [A] }),
    i('w_ashwagandha', 'Am besten als Kur von 8 bis 12 Wochen. Nicht bei Schilddrüsen- oder Lebererkrankungen, nicht in der Schwangerschaft.', 600, '300–600 mg Extrakt pro Tag', { kur: 12, zeit: [M, A] }),
    i('w_bcaa', 'Bei genug Eiweiß am Tag meist überflüssig.', 0),
    i('w_natrium', 'Elektrolyte vor allem bei viel Schweiß; Natrium kommt auch über Salz.', 0),
  ].map((x) => [x.key, x]));

  const menge = (key, wert) => `${Format.zahl(wert, wert < 10 ? 2 : 0)} ${Mikros.mikro(key)?.einheit || 'mg'}`;
  const name = (key) => (key === 'koffein' ? 'Koffein' : Mikros.mikro(key)?.name || key);
  const zuViel = (i, v) => i.maxTag > 0 && v > i.maxTag * 1.0001;
  const ohne = (andere, p) => [...andere.filter((x) => x.id !== p.id || !p.id), p];

  const W = {
    infos,
    info: (key) => infos[key] || null,
    name, menge, zuViel,

    /** Menge eines Stoffs pro Tag laut Plan (alle Einnahmen aller Produkte). Koffein kommt aus dem Koffeinwert. */
    planTageswerte(produkte) {
      const summe = {};
      for (const p of produkte.filter((p) => p.plan.length)) {
        const gramm = p.plan.length * einnahme(p);
        for (const [k, v] of Object.entries(p.naehrwerte.mikros)) if (k !== 'koffein') summe[k] = (summe[k] || 0) + (v * gramm) / 100;
        if (p.koffeinMgPro100 > 0) summe.koffein = (summe.koffein || 0) + (p.koffeinMgPro100 * gramm) / 100;
      }
      return summe;
    },

    /** Plan als Ganzes prüfen: Höchstmengen, Wechselwirkungen, Koffein am Abend, Kuren. Das Ernste zuerst. */
    planPruefen(produkte) {
      const geplant = produkte.filter((p) => p.plan.length);
      const werte = W.planTageswerte(geplant);
      const h = [];
      for (const [k, v] of Object.entries(werte)) {
        const i = infos[k];
        if (i && zuViel(i, v)) h.push({ text: `${name(k)}: ${menge(k, v)} pro Tag laut Plan, mehr als ${i.maxText}.`, ernst: true });
      }
      if ((werte.w_htp || 0) > 0 && (werte.w_tryptophan || 0) > 0) {
        h.push({ text: '5-HTP und L-Tryptophan stehen beide im Plan. Gleicher Serotonin-Weg: nur eines von beiden nehmen, nicht am selben Tag.', ernst: true });
      }
      if ((werte.w_htp || 0) > 0 || (werte.w_tryptophan || 0) > 0) {
        h.push({ text: '5-HTP und L-Tryptophan nicht mit Antidepressiva (SSRI, MAO-Hemmer) kombinieren.', ernst: false });
      }
      for (const p of geplant.filter((p) => p.koffeinMgPro100 > 0 && p.plan.includes('ABENDS'))) {
        h.push({ text: `${p.name} enthält Koffein und steht abends im Plan. Das beißt sich mit dem Schlaf und mit Magnesium, Glycin oder 5-HTP.`, ernst: true });
      }
      for (const p of geplant) {
        const je = (p.koffeinMgPro100 * einnahme(p)) / 100;
        if (je > 200.5) h.push({ text: `${p.name}: ${Format.zahl(je, 0)} mg Koffein auf einmal, mehr als 200 mg pro Einnahme (EFSA).`, ernst: true });
      }
      for (const p of geplant) {
        const kuren = Object.keys(p.naehrwerte.mikros).map((k) => infos[k]?.kurWochen || 0).filter((w) => w > 0);
        if (kuren.length && !p.kurWochen) h.push({ text: `${p.name} am besten als Kur: höchstens ${Math.min(...kuren)} Wochen am Stück. Beim Produkt eintragen, dann erinnert die App an die Pause.`, ernst: false });
      }
      if ((werte.zink || 0) > 0 && (werte.calcium || 0) > 0) {
        h.push({ text: 'Zink und Calcium nicht zur selben Zeit nehmen, sie behindern sich bei der Aufnahme.', ernst: false });
      }
      return h.filter((x) => x.ernst).concat(h.filter((x) => !x.ernst));
    },

    /** Tipps beim Bearbeiten eines Produkts [p] (Entwurf); [andere]: alle Produkte. */
    produktTipps(p, andere) {
      const keys = [...new Set([...Object.keys(p.naehrwerte.mikros).filter((k) => k in infos), ...(p.koffeinMgPro100 > 0 ? ['koffein'] : [])])];
      const alle = ohne(andere, p);
      const werte = W.planTageswerte(alle);
      const h = [];
      for (const k of keys) {
        const i = infos[k];
        const v = werte[k] || 0;
        const grenze = i.maxText ? ` Richtwert: ${i.maxText}.` : '';
        const plan = v > 0 ? ` Laut Plan ${menge(k, v)} pro Tag.` : '';
        h.push({ text: `${name(k)}: ${i.tipp}${grenze}${plan}`, ernst: zuViel(i, v) });
        if (p.plan.length && i.zeitpunkte.length && !p.plan.some((z) => i.zeitpunkte.includes(z))) {
          h.push({ text: `${name(k)} passt eher zu: ${i.zeitpunkte.map((z) => Zeitpunkt[z].text).join(' oder ')}.`, ernst: false });
        }
      }
      return h.concat(W.planPruefen(alle).filter((x) => x.ernst && !h.some((y) => y.text === x.text)));
    },
  };
  return W;
})();

// ---------- Barcode und Datenbank ----------

export const Barcode = {
  normal(code) {
    const z = String(code).replace(/\D/g, '');
    return z.length === 12 ? '0' + z : z;
  },
};

const MAKRO_KEYS = ['kcal', 'fett', 'gesaettigt', 'kohlenhydrate', 'zucker', 'ballaststoffe', 'eiweiss', 'salz'];

/** Ein Datensatz der Nährwert-Datenbank (Felder wie im Android-Format DACHNW01). */
export function dbLesen(ean, text) {
  const t = text.split('\t');
  const feld = (i) => t[i] ?? '';
  const zahl = (i) => { const v = parseFloat(feld(i)); return feld(i) === '' || Number.isNaN(v) ? null : v; };
  const werte = Object.fromEntries(MAKRO_KEYS.map((k, j) => [k, zahl(5 + j)]));
  const koffein = feld(13);
  const alle = {};
  for (const e of feld(14).split(';')) {
    const kv = e.split('=');
    if (kv.length !== 2 || !Mikros.mikro(kv[0])) continue;
    const v = parseFloat(kv[1]);
    if (!Number.isNaN(v)) alle[kv[0]] = v;
  }
  const erg = Mikros.ergaenzungsmittel(feld(0));
  const mikros = Object.fromEntries(Object.entries(alle).filter(([k, v]) => Mikros.plausibel(k, v, erg)));
  const nw = naehrwerte({ ...Object.fromEntries(MAKRO_KEYS.map((k) => [k, werte[k] ?? 0])), mikros });
  const kof = parseFloat(koffein.replace(/~$/, ''));
  return {
    ean, name: feld(0), marke: feld(1), menge: feld(2), fluessig: feld(3) === '1', portion: zahl(4), naehrwerte: nw,
    koffeinMgPro100: Number.isNaN(kof) ? null : kof,
    gefunden: new Set([...MAKRO_KEYS.filter((k) => werte[k] != null), ...Object.keys(mikros)]),
    koffeinGeschaetzt: koffein.endsWith('~'), koffeinFehlt: koffein === '?',
    verworfen: Object.keys(alle).filter((k) => !(k in mikros)),
  };
}

export function dbAnzeige(d) {
  const marke = d.marke.trim();
  const erstes = marke.split(/[ -]/)[0];
  const drin = d.name.toLowerCase().includes(marke.toLowerCase()) || (erstes.length >= 3 && d.name.toLowerCase().includes(erstes.toLowerCase()));
  return !marke || marke.length > 25 || drin ? d.name : `${marke} ${d.name}`;
}

export function dbAlsProdukt(d) {
  return produkt({
    name: dbAnzeige(d), fluessig: d.fluessig, portion: d.portion ?? (d.fluessig ? 250 : 100),
    koffeinMgPro100: d.koffeinMgPro100 ?? 0, naehrwerte: d.naehrwerte, ean: d.ean,
  });
}

/** Teil der Datenbank, in dem ein Code steht (100 Teile, damit nie die ganze Datei geladen werden muss). */
export function dbTeil(code) {
  const n = BigInt(Barcode.normal(code) || '0');
  return Number((n / 10n) % 100n);
}

// ---------- Nährwerttabelle lesen ----------

export function zeilenAusBoxen(boxen) {
  const mitte = (b) => Math.floor((b.oben + b.unten) / 2);
  const hoehe = (b) => Math.max(1, b.unten - b.oben);
  const reihen = [];
  for (const b of boxen.filter((b) => b.text.trim()).sort((a, c) => mitte(a) - mitte(c))) {
    const r = reihen[reihen.length - 1];
    if (r) {
      const m = Math.floor(r.reduce((a, x) => a + mitte(x), 0) / r.length);
      const h = Math.floor(r.reduce((a, x) => a + hoehe(x), 0) / r.length);
      if (Math.abs(mitte(b) - m) <= Math.max(h, hoehe(b)) / 2) { r.push(b); continue; }
    }
    reihen.push([b]);
  }
  return { reihen, mitte, hoehe };
}

export const Naehrwerttabelle = (() => {
  const makros = [
    { key: 'gesaettigt', muster: ['gesattigt', 'gesatt.'], aus: ['ungesatt'], einheit: 'g' },
    { key: 'zucker', muster: ['zucker'], aus: ['alkohol', 'zusatz'], einheit: 'g' },
    { key: 'kohlenhydrate', muster: ['kohlenhydrat'], aus: [], einheit: 'g' },
    { key: 'ballaststoffe', muster: ['ballaststoff'], aus: [], einheit: 'g' },
    { key: 'eiweiss', muster: ['eiweiss', 'eiweis', 'protein'], aus: [], einheit: 'g' },
    { key: 'salz', muster: ['salz'], aus: [], einheit: 'g' },
    { key: 'fett', muster: ['fett'], aus: ['ungesatt', 'fettsaure', 'omega'], einheit: 'g' },
  ];
  const normal = (s) => s.toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/(?<=[\s(<:/]|^)o(?=[,.]\d)/g, '0')
    .replace(/(?<=[\s(<:/]|^)o\s?g\b/g, '0 g')
    .replace(/(\d)\s*[,.]\s+(\d)/g, '$1,$2')
    .replace(/\s+/g, ' ')
    .trim();
  const mikroFelder = MIKROS.flatMap((m) => m.namen.map((n) => [normal(n), m])).sort((a, b) => b[0].length - a[0].length);
  const zahl = /(<\s*)?(\d+(?:[.,]\d+)?)\s*(kj|kcal|mg|µg|μg|ug|mcg|g|ml|%)?/g;
  const d = (s) => parseFloat(s.replace(',', '.'));
  const ersteMenge = (text) => {
    for (const m of text.matchAll(zahl)) {
      const e = m[3] || '';
      if (e === '%' || e === 'kj' || e === 'kcal') continue;
      return [d(m[2]), e.replace('μ', 'µ').replace(/^ug$/, 'µg').replace('mcg', 'µg')];
    }
    return null;
  };
  const faktor = (e) => ({ g: 1, mg: 1e-3, 'µg': 1e-6 })[e] ?? null;
  const umrechnen = (wert, von, nach) => { const a = faktor(von), b = faktor(nach); return a == null || b == null ? wert : (wert * a) / b; };
  const hatBezeichnung = (z) => makros.some((f) => f.muster.some((m) => z.includes(m)) && !f.aus.some((a) => z.includes(a))) ||
    mikroFelder.some(([n]) => z.includes(n)) || z.includes('brennwert') || z.includes('energie');

  function zeilen(boxen) {
    return zeilenAusBoxen(boxen).reihen.map((r) => r.sort((a, b) => a.links - b.links).map((b) => b.text.trim()).join(' '));
  }

  function lesen(roh) {
    const z = roh.map(normal).filter((x) => x);
    const gefunden = new Set();
    const werte = {};
    const mikros = {};
    const vergeben = z.map(() => false);
    const mengeAb = (i, ab) => ersteMenge(z[i].substring(ab)) ?? (z[i + 1] != null && !hatBezeichnung(z[i + 1]) ? ersteMenge(z[i + 1]) : null);

    const text = z.join('\n');
    let kcal = null;
    let m = text.match(/(\d+(?:[.,]\d+)?)\s*kcal/);
    if (m) kcal = d(m[1]);
    if (kcal == null) {
      const zeile = z.find((x) => x.replace(/ /g, '').includes('kj/kcal'));
      const p = zeile && zeile.match(/(\d+(?:[.,]\d+)?)\s*(?:kj)?\s*\/\s*(\d+(?:[.,]\d+)?)/);
      if (p) kcal = d(p[2]);
    }
    if (kcal == null) { m = text.match(/(\d+(?:[.,]\d+)?)\s*kj/); if (m) kcal = d(m[1]) / 4.184; }
    if (kcal != null) { werte.kcal = kcal; gefunden.add('kcal'); }

    z.forEach((zeile, i) => {
      for (const f of makros) {
        if (gefunden.has(f.key)) continue;
        const pos = f.muster.map((x) => zeile.indexOf(x)).filter((x) => x >= 0);
        if (!pos.length) continue;
        if (f.aus.some((a) => zeile.includes(a))) continue;
        const mm = mengeAb(i, Math.min(...pos));
        if (!mm) continue;
        const wert = umrechnen(mm[0], mm[1] || f.einheit, f.einheit);
        if (wert > 100) continue; // mehr als 100 g pro 100 g: falsch gelesen
        werte[f.key] = wert;
        gefunden.add(f.key);
        vergeben[i] = true;
        break;
      }
      if (vergeben[i]) return;
      const t = mikroFelder.find(([n]) => zeile.includes(n));
      if (!t) return;
      const mikro = t[1];
      if (gefunden.has(mikro.key)) return;
      const mm = mengeAb(i, zeile.indexOf(t[0]) + t[0].length);
      if (!mm) return;
      mikros[mikro.key] = umrechnen(mm[0], mm[1] || mikro.einheit, mikro.einheit);
      gefunden.add(mikro.key);
    });

    const alles = z.join(' ');
    const fluessig = /100\s?ml/.test(alles) ? true : /100\s?g\b/.test(alles) ? false : null;
    const pm = alles.match(/portion[^0-9]{0,20}(\d+(?:[.,]\d+)?)\s*(g|ml)/);
    let portion = pm ? d(pm[1]) : null;
    if (!(portion > 0 && portion !== 100)) portion = null;
    const koffein = mikros.koffein ?? null;
    delete mikros.koffein;
    return {
      naehrwerte: naehrwerte({ ...Object.fromEntries(MAKRO_KEYS.map((k) => [k, werte[k] ?? 0])), mikros }),
      gefunden, fluessig, portion, koffeinMgPro100: koffein,
    };
  }

  /**
   * Typische Lesefehler der Texterkennung im Browser (Tesseract): das „g“ hinter einer Zahl wird oft als „9“ gelesen
   * („78 g“ → „789“, „4,1 g“ → „4,19“), „1,.1“ statt „1,1“. Nur für erkannten Text, nicht für Eingaben.
   */
  const ocrKorrektur = (z) => z
    .replace(/(\d)[,.]{2,}(\d)/g, '$1,$2')
    .replace(/(\d+[,.]\d)9(?=\s|$|\))/g, '$1 g')
    .replace(/(?<![\d,.])(\d{1,2})9(?=\s|$|\))/g, '$1 g');

  return { normal, zeilen, lesen, ocrKorrektur, brauchbar: (e) => e.gefunden.size >= 2 };
})();

// ---------- Lebensmittel (BLS), Rezepte, Mahlzeiten ----------

export function lebensmittelLesen(text) {
  const zeilen = text.split('\n').filter((z) => z.trim());
  const kopf = (zeilen[0] || '').split('\t');
  if (kopf[0] !== '#DACHLM1') throw new Error('Die Datei ist keine Lebensmittel-Datei.');
  const liste = [];
  for (const zeile of zeilen.slice(1)) {
    const t = zeile.split('\t');
    if (t.length < 13 || !t[1].trim()) continue;
    const dd = (i) => { const v = parseFloat(t[i] ?? ''); return Number.isNaN(v) ? 0 : v; };
    const mikros = {};
    for (const e of (t[13] || '').split(';')) {
      const kv = e.split('=');
      if (kv.length === 2 && Mikros.mikro(kv[0])) { const v = parseFloat(kv[1]); if (!Number.isNaN(v)) mikros[kv[0]] = v; }
    }
    const st = parseFloat(t[4]);
    liste.push({
      id: t[0], name: t[1], gruppe: t[2], fluessig: t[3] === '1', stueckG: Number.isNaN(st) ? null : st, eigenes: false,
      naehrwerte: naehrwerte({ kcal: dd(5), fett: dd(6), gesaettigt: dd(7), kohlenhydrate: dd(8), zucker: dd(9), ballaststoffe: dd(10), eiweiss: dd(11), salz: dd(12), mikros }),
    });
  }
  return { stand: kopf[1] || '', quelle: kopf[2] || '', lebensmittel: liste };
}

export const produktAlsLebensmittel = (p) => ({
  id: 'p:' + p.id, name: p.name, gruppe: 'Eigene Produkte', fluessig: p.fluessig, naehrwerte: p.naehrwerte,
  stueckG: p.portion > 0 ? p.portion : null, eigenes: true,
});

const EINHEITEN = [
  ['GRAMM', 'g', ['g', 'gr', 'gramm'], 1, null],
  ['KILO', 'kg', ['kg', 'kilo', 'kilogramm'], 1000, null],
  ['MILLIGRAMM', 'mg', ['mg'], 0.001, null],
  ['MILLILITER', 'ml', ['ml', 'milliliter'], null, 1],
  ['ZENTILITER', 'cl', ['cl'], null, 10],
  ['DEZILITER', 'dl', ['dl'], null, 100],
  ['LITER', 'l', ['l', 'liter', 'ltr'], null, 1000],
  ['ESSLOEFFEL', 'EL', ['el', 'essloffel', 'essl', 'e.l.'], null, 15],
  ['TEELOEFFEL', 'TL', ['tl', 'teeloffel', 'teel', 't.l.'], null, 5],
  ['PRISE', 'Prise', ['prise', 'prisen'], 0.5, null],
  ['MESSERSPITZE', 'Msp.', ['msp', 'messerspitze'], 0.3, null],
  ['TASSE', 'Tasse', ['tasse', 'tassen', 'cup', 'cups'], null, 200],
  ['BECHER', 'Becher', ['becher'], 200, null],
  ['GLAS', 'Glas', ['glas', 'glaser'], null, 200],
  ['DOSE', 'Dose', ['dose', 'dosen'], 400, null],
  ['PAECKCHEN', 'Pck.', ['pck', 'pckg', 'packchen', 'paket', 'packung', 'pkg', 'tute'], null, null],
  ['SCHEIBE', 'Scheibe', ['scheibe', 'scheiben'], null, null],
  ['ZEHE', 'Zehe', ['zehe', 'zehen'], 4, null],
  ['BUND', 'Bund', ['bund'], 50, null],
  ['HANDVOLL', 'Handvoll', ['handvoll', 'hand voll'], 30, null],
  ['BLATT', 'Blatt', ['blatt', 'blatter'], 2, null],
  ['SCHUSS', 'Schuss', ['schuss', 'spritzer'], null, 10],
  ['PORTION', 'Portion', ['portion', 'portionen', 'teller', 'schale', 'schussel'], null, null],
  ['STUECK', 'Stück', ['stuck', 'stk', 'st'], null, null],
].map(([id, text, namen, g, ml]) => ({ id, text, namen, g, ml }));
const EINHEIT = Object.fromEntries(EINHEITEN.map((e) => [e.id, e]));

export const Zutaten = (() => {
  const brueche = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
  const zahlwoerter = { ein: 1, eine: 1, einen: 1, einem: 1, zwei: 2, drei: 3, vier: 4, funf: 5, halbe: 0.5, halber: 0.5, halbes: 0.5, halb: 0.5 };
  const einheiten = EINHEITEN.flatMap((e) => e.namen.map((n) => [n, e])).sort((a, b) => b[0].length - a[0].length);
  const zahlAnfang = /^(\d+(?:[.,]\d+)?)?(?:\s*([½¼¾⅓⅔⅛]))?(?:\s+(\d+)\s*\/\s*(\d+)|\s*\/\s*(\d+))?(?:\s*(?:-|–|bis)\s*(\d+(?:[.,]\d+)?))?/;
  const fuellwoerter = ['etwas', 'evtl.', 'evtl', 'ca.', 'ca', 'circa', 'etwa', 'nach belieben', 'nach geschmack', 'n. b.', 'nb', 'frisch gemahlener', 'frisch gemahlen'];
  const normal = (s) => s.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const isLetter = (c) => /\p{L}/u.test(c);

  function lesen(zeile) {
    let rest = zeile.trim().replace(/^[-•*·–○□▪]+/, '').trim();
    if (rest.length < 2 || ![...rest].some(isLetter)) return null;
    const original = rest;
    let menge = null;
    const m = rest.match(zahlAnfang);
    if (m && m[0].trim()) {
      const ganz = m[1] ? parseFloat(m[1].replace(',', '.')) : null;
      const bruch = m[2] ? brueche[m[2]] : null;
      const gemischt = m[3] ? +m[3] / Math.max(1, +m[4]) : null;
      const einfach = m[5] && ganz != null ? ganz / Math.max(1, +m[5]) : null;
      const bis = m[6] ? parseFloat(m[6].replace(',', '.')) : null;
      let wert = einfach != null ? einfach : (ganz ?? 0) + (bruch ?? 0) + (gemischt ?? 0);
      if (bis != null && bis > wert) wert = (wert + bis) / 2;
      if (wert > 0) { menge = wert; rest = rest.substring(m[0].length).trim(); }
    }
    if (menge == null) {
      const erstes = normal(rest.split(' ')[0]);
      if (erstes in zahlwoerter) { menge = zahlwoerter[erstes]; rest = rest.includes(' ') ? rest.substring(rest.indexOf(' ') + 1).trim() : ''; }
    }
    let einheit = EINHEIT.STUECK;
    const klein = normal(rest);
    for (const [name, e] of einheiten) {
      if (klein.startsWith(name) && (klein.length === name.length || !isLetter(klein[name.length]))) {
        einheit = e;
        rest = rest.substring(name.length).replace(/^[. ]+/, '');
        break;
      }
    }
    let text = rest.replace(/\(.*?\)/g, ' ').split(',')[0].split(';')[0];
    for (const f of fuellwoerter) text = text.replace(new RegExp(`(^|\\s)${esc(f)}(\\s|$)`, 'gi'), ' ');
    text = text.replace(/^(von|vom|der|die|das|dem|den)\s+/i, '').replace(/\s+/g, ' ').trim().replace(/^[ .:-]+|[ .:-]+$/g, '');
    if (![...text].some(isLetter)) return null;
    return { original, menge, einheit: einheit.id, text };
  }

  function portionen(zeilen) {
    const m1 = /(?:fur|ergibt|reicht fur)\s+(\d{1,2})\s*(?:-\s*\d+\s*)?(?:portionen|personen|pers\.|stuck|port\.)/;
    const m2 = /(\d{1,2})\s*(?:portionen|personen)/;
    for (const z of zeilen) {
      const n = normal(z);
      const t = n.match(m1) || n.match(m2);
      if (t) { const p = +t[1]; return p >= 1 && p <= 50 ? p : null; }
    }
    return null;
  }

  const nurMenge = (s) => { const t = s.trim(); return !!t && (/\d/.test(t[0]) || t[0] in brueche) && lesen(t) == null; };

  function ausFoto(boxen) {
    const { reihen, hoehe } = zeilenAusBoxen(boxen);
    return reihen.flatMap((r) => {
      const sortiert = [...r].sort((a, b) => a.links - b.links);
      const stuecke = [[sortiert[0]]];
      for (const b of sortiert.slice(1)) {
        const vorher = stuecke[stuecke.length - 1].slice(-1)[0];
        if (b.links - vorher.rechts > 3 * Math.max(hoehe(vorher), hoehe(b))) stuecke.push([b]); else stuecke[stuecke.length - 1].push(b);
      }
      const texte = stuecke.map((st) => st.map((b) => b.text.trim()).join(' '));
      if (texte.length >= 2 && nurMenge(texte[0])) { texte[1] = texte[0] + ' ' + texte[1]; texte.shift(); }
      return texte;
    });
  }

  function zutatenZeilen(zeilen) {
    return zeilen.filter((z) => {
      const t = z.trim().replace(/^[-•*·–]+/, '');
      const n = normal(t);
      const mitMenge = (t[0] && (/\d/.test(t[0]) || t[0] in brueche)) || n.split(' ')[0] in zahlwoerter;
      return mitMenge && t.length <= 70 && !n.startsWith('zutaten') && !/^\d+\s*(min|minuten|std|stunden|grad|°)/.test(n);
    });
  }

  return { lesen, portionen, ausFoto, zutatenZeilen, normal, EINHEIT };
})();

export const Mengen = (() => {
  const stueck = [['knoblauch', 4], ['ei', 60], ['eier', 60], ['eigelb', 18], ['eiweiss', 33], ['zwiebel', 80], ['schalotte', 25], ['kartoffel', 100], ['tomate', 80], ['kirschtomate', 15], ['apfel', 150], ['banane', 120], ['birne', 160], ['zitrone', 100], ['limette', 60], ['orange', 180], ['karotte', 70], ['mohre', 70], ['paprika', 150], ['gurke', 400], ['zucchini', 250], ['aubergine', 300], ['avocado', 150], ['brotchen', 60], ['semmel', 60], ['toast', 25], ['tortilla', 60], ['wrap', 60], ['brezel', 80], ['croissant', 60], ['lauch', 200], ['porree', 200], ['chili', 10], ['champignon', 20], ['salat', 300], ['kohlrabi', 300], ['hahnchenbrust', 150], ['hahnchenbrustfilet', 150], ['lachsfilet', 125], ['steak', 200], ['wurstchen', 50], ['bratwurst', 120], ['frikadelle', 90], ['schnitzel', 150], ['muffin', 80], ['keks', 10], ['riegel', 40], ['ingwer', 20], ['mozzarella', 125], ['baguette', 250], ['pizza', 350], ['doner', 350], ['burger', 220]];
  const scheibe = [['toast', 25], ['brot', 45], ['kase', 25], ['schinken', 15], ['salami', 8], ['wurst', 15], ['speck', 10], ['zitrone', 10]];
  const portion = [['doner', 350], ['pommes', 150], ['pizza', 350], ['burger', 220], ['suppe', 350], ['eintopf', 400], ['salat', 250], ['nudel', 350], ['pasta', 350], ['spaghetti', 350], ['lasagne', 400], ['reis', 200], ['kartoffel', 250], ['pommes frites', 150], ['currywurst', 300], ['schnitzel', 150], ['gyros', 250], ['brot', 50], ['musli', 60], ['joghurt', 150], ['quark', 250], ['kuchen', 120], ['torte', 130], ['eis', 100], ['sosse', 80], ['sauce', 80], ['dressing', 30]];
  const dichte = [['ol', 0.92], ['mehl', 0.55], ['zucker', 0.85], ['puderzucker', 0.6], ['reis', 0.8], ['honig', 1.4], ['sirup', 1.3], ['butter', 0.95], ['salz', 1.2], ['haferflocken', 0.4], ['kakao', 0.5], ['backpulver', 0.9], ['senf', 1.05]];
  const paeckchen = [['backpulver', 15], ['vanillezucker', 8], ['vanillinzucker', 8], ['hefe', 7], ['trockenhefe', 7], ['gelatine', 9], ['sahne', 200], ['pudding', 37], ['tofu', 200], ['feta', 200]];
  const sortiert = (t) => [...t].sort((a, b) => b[0].length - a[0].length);
  const [S1, S2, S3, S4, S5] = [stueck, scheibe, portion, dichte, paeckchen].map(sortiert);
  function suche(tab, name) {
    const woerter = Zutaten.normal(name).split(/[^a-z]+/).filter((x) => x);
    const t = tab.find(([k]) => woerter.some((w) => w === k || (k.length >= 4 && (w.startsWith(k) || w.endsWith(k))) || (k.length >= 2 && k.length <= 3 && w.endsWith(k) && w.length >= k.length + 3)));
    return t ? t[1] : null;
  }
  const dichteVon = (l) => (l.fluessig ? 1 : suche(S4, l.name) ?? 1);
  const portionG = (l, text = l.name) => suche(S3, text) ?? suche(S3, l.name) ?? (l.fluessig ? 250 : /gericht/i.test(l.gruppe) ? 350 : 150);
  const stueckG = (l, text = l.name) => l.stueckG ?? suche(S1, text) ?? suche(S1, l.name) ?? (l.fluessig ? portionG(l, text) : 100);
  function unbestimmt(z, l) {
    const n = Zutaten.normal(z.text);
    if (l.eigenes && l.stueckG != null) return l.stueckG;
    if (['salz', 'pfeffer', 'gewurz', 'zimt', 'muskat', 'paprikapulver', 'curry', 'oregano', 'basilikum', 'petersilie', 'schnittlauch'].some((x) => n.includes(x))) return 1;
    if (['ol', 'butter'].some((x) => n === x || n.endsWith(' ' + x))) return 5;
    if (suche(S1, z.text) != null && suche(S3, z.text) == null) return stueckG(l, z.text);
    return portionG(l, z.text);
  }
  function gramm(z, l) {
    const n = z.menge;
    if (n == null) return (z.einheit === 'PORTION' || z.einheit === 'STUECK') && !z.text.trim() ? 0 : unbestimmt(z, l);
    const e = EINHEIT[z.einheit];
    if (e.g != null) return n * e.g;
    if (e.ml != null) return n * e.ml * dichteVon(l);
    if (e.id === 'SCHEIBE') return n * (suche(S2, z.text) ?? suche(S2, l.name) ?? 30);
    if (e.id === 'PAECKCHEN') return n * (suche(S5, z.text) ?? suche(S5, l.name) ?? 100);
    if (e.id === 'PORTION') return n * portionG(l, z.text);
    return n * stueckG(l, z.text);
  }
  return { gramm, portionG, stueckG };
})();

export class Zuordnung {
  static synonyme = {
    eier: 'huhnerei', ei: 'huhnerei', eiern: 'huhnerei', mehl: 'weizen mehl 405', weizenmehl: 'weizen mehl 405',
    nudeln: 'teigwaren eifrei', pasta: 'teigwaren eifrei', spaghetti: 'teigwaren eifrei', penne: 'teigwaren eifrei',
    makkaroni: 'teigwaren eifrei', fusilli: 'teigwaren eifrei', bandnudeln: 'eierteigwaren',
    hack: 'hackfleisch', gehacktes: 'hackfleisch', rinderhack: 'rind hackfleisch', sahne: 'schlagsahne',
    hahnchen: 'hahnchen fleisch', hahnchenbrust: 'hahnchen brustfilet', hahnchenbrustfilet: 'hahnchen brustfilet',
    huhnchen: 'hahnchen fleisch', putenbrust: 'pute brust', mohren: 'mohre', karotte: 'mohre', karotten: 'mohre',
    kartoffeln: 'kartoffel', zwiebeln: 'zwiebel', tomaten: 'tomate', paprika: 'gemusepaprika', paprikaschote: 'gemusepaprika',
    paprikaschoten: 'gemusepaprika', knoblauchzehe: 'knoblauch', knoblauchzehen: 'knoblauch', brokkoli: 'broccoli',
    champignons: 'champignon', pilze: 'champignon', ol: 'rapsol', pflanzenol: 'rapsol', speiseol: 'rapsol',
    pommes: 'pommes frites', fritten: 'pommes frites', kebab: 'doner', brotchen: 'weizenbrotchen',
    semmel: 'weizenbrotchen', schrippe: 'weizenbrotchen', quark: 'speisequark', magerquark: 'speisequark magerstufe',
    haferflocken: 'hafer flocken', milch: 'vollmilch', schinken: 'kochschinken', salz: 'speisesalz',
    wasser: 'trinkwasser', cola: 'colagetrank koffeinhaltig', bier: 'pilsner bier', pils: 'pilsner bier',
    apfelschorle: 'fruchtsaftschorle apfel', bolognese: 'bologneser', kasespatzle: 'spatzle kase',
    toast: 'weizentoastbrot', toastbrot: 'weizentoastbrot', pfeffer: 'pfeffer schwarz', speck: 'schwein speck',
    lasagne: 'lasagne al forno',
  };
  static phrasen = {
    'spaghetti bolognese': 'eierteigwaren bologneser', 'nudeln bolognese': 'eierteigwaren bologneser',
    'spaghetti bolognaise': 'eierteigwaren bologneser', 'spaghetti carbonara': 'teigwaren carbonara',
  };
  static ignorieren = new Set(['und', 'mit', 'oder', 'in', 'im', 'vom', 'von', 'der', 'die', 'das', 'zum', 'fur', 'frisch', 'frische', 'frischer', 'gehackt', 'gehackte', 'gewurfelt', 'gewurfelte', 'fein', 'grob', 'klein', 'kleine', 'grosse', 'gross', 'mittelgross', 'mittelgrosse', 'gerieben', 'geriebener', 'geschalt', 'zimmerwarm', 'weich', 'kalt', 'warm', 'etwa', 'ca', 'tk', 'bio', 'mind', 'max', 'fett', 'tr', 'type']);
  static sonderfall = new Set(['pulver', 'glutenfrei', 'laktosefrei', 'tiefgefroren', 'konserve', 'getrocknet', 'angereichert', 'sussungsmitteln', 'vegan', 'vegetarisch', 'alkoholfrei', 'koffeinfrei', 'entkoffeiniert', 'koffeinreduziert', 'kohlenhydratreduziert', 'gesalzen', 'gezuckert', 'instant', 'trockenprodukt', 'eingelegt', 'gerauchert', 'selbstgemacht', 'dip', 'dressing']);
  static zubereitet = new Set(['gebraten', 'gedunstet', 'gebacken', 'uberbacken', 'frittiert', 'gegrillt', 'geschmort', 'gekocht', 'pochiert', 'gedampft', 'paniert', 'zubereitet', 'gegart']);
  static woerter(s) {
    return Zutaten.normal(s).replace(/(?<=[a-z])-(?=[a-z])/g, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !Zuordnung.ignorieren.has(w));
  }

  constructor(lebensmittel) {
    this.eintraege = lebensmittel.map((l) => ({ l, woerter: Zuordnung.woerter(l.name) }));
  }

  static wortPunkte(q, w) {
    if (q === w) return 3;
    if (q.length >= 4 && w.length >= 4 && (w.startsWith(q) || q.startsWith(w))) return 2.2;
    if (q.length >= 4 && w.length >= 4 && (w.endsWith(q) || q.endsWith(w))) return 1.8;
    if (q.length >= 5 && w.includes(q)) return 1.2;
    return 0;
  }

  punkte(frage, e, roh) {
    if (!frage.length || !e.woerter.length) return 0;
    const wp = Zuordnung.wortPunkte;
    let summe = 0;
    for (const q of frage) summe += Math.max(...e.woerter.map((w) => wp(q, w)));
    if (summe <= 0) return 0;
    summe += (0.6 * Math.max(...frage.map((q) => wp(q, e.woerter[0])))) / 3;
    summe -= 0.25 * Math.max(0, e.woerter.length - frage.length);
    if (roh && e.woerter.some((w) => w === 'roh' || w === 'frisch')) summe += 0.4;
    summe -= 0.6 * e.woerter.filter((w) => (Zuordnung.sonderfall.has(w) || w.endsWith('pulver')) && !frage.includes(w)).length;
    if (roh) {
      summe -= 0.35 * e.woerter.filter((w) => Zuordnung.zubereitet.has(w) && !frage.includes(w)).length;
      if (/gericht/i.test(e.l.gruppe)) summe -= 0.5;
    }
    if (!roh && /gericht/i.test(e.l.gruppe)) summe += 0.3;
    if (e.l.eigenes) summe += 0.5;
    return summe;
  }

  frage(text) {
    let t = Zutaten.normal(text);
    for (const [k, v] of Object.entries(Zuordnung.phrasen)) t = t.split(k).join(v);
    return [...new Set(Zuordnung.woerter(t).flatMap((w) => (Zuordnung.synonyme[w] ?? w).split(' ')))];
  }

  suchen(text, anzahl = 5, roh = false) {
    const f = this.frage(text);
    if (!f.length) return [];
    const mindest = 1.5 * Math.min(f.length, 2);
    const r = [];
    for (const e of this.eintraege) { const p = this.punkte(f, e, roh); if (p >= mindest) r.push([e.l, p]); }
    return r.sort((a, b) => b[1] - a[1]).slice(0, anzahl).map((x) => x[0]);
  }

  zeile(z, roh) {
    const t = this.suchen(z.text, 6, roh);
    const l = t[0] || null;
    return { zutat: z, lebensmittel: l, gramm: l ? Mengen.gramm(z, l) : 0, alternativen: t.slice(1) };
  }

  rezept(zeilen) { return zeilen.map(Zutaten.lesen).filter(Boolean).map((z) => this.zeile(z, true)); }

  freitext(text) {
    return text.split(/\s*(?:,|;|\+|\bund\b|\bmit\b|\bdazu\b|\n)\s*/i).filter((x) => x.trim()).map(Zutaten.lesen).filter(Boolean).map((z) => this.zeile(z, false));
  }
}

export const Mahlzeiten = {
  zeileNw: (z) => (z.lebensmittel ? nwMal(z.lebensmittel.naehrwerte, z.gramm / 100) : naehrwerte()),
  summe: (zeilen) => zeilen.reduce((a, z) => nwPlus(a, Mahlzeiten.zeileNw(z)), naehrwerte()),
  gewicht: (zeilen) => zeilen.filter((z) => z.lebensmittel).reduce((a, z) => a + z.gramm, 0),
  alsProdukt(name, zeilen, portionen, garGewicht = null) {
    const gesamt = Math.max(1, garGewicht > 0 ? garGewicht : Mahlzeiten.gewicht(zeilen));
    return produkt({ name: name.trim() || 'Mahlzeit', portion: gesamt / Math.max(1, portionen), naehrwerte: nwMal(Mahlzeiten.summe(zeilen), 100 / gesamt) });
  },
};

// ---------- Zeitachse ----------

export const Zeitachse = {
  HALBE_STUNDE: 30 * MINUTE,
  versatz: (t) => -new Date(t).getTimezoneOffset() * MINUTE,
  aufrunden(t) {
    const v = Zeitachse.versatz(t);
    const h = Zeitachse.HALBE_STUNDE;
    return Math.floor((t + v + h - 1) / h) * h - v;
  },
  marken(von, bis) { const r = []; for (let t = Zeitachse.aufrunden(von); t <= bis; t += Zeitachse.HALBE_STUNDE) r.push(t); return r; },
  beschriftet(t, alle) { const d = new Date(t); return d.getMinutes() === 0 && d.getHours() % alle === 0; },
  einrasten(t, von, bis) {
    const unten = Zeitachse.aufrunden(t - Zeitachse.HALBE_STUNDE + 1);
    const oben = unten + Zeitachse.HALBE_STUNDE;
    return Math.min(bis, Math.max(von, t - unten <= oben - t ? unten : oben));
  },
  wert(p, t) {
    if (!p.length) return 0;
    if (t <= p[0].zeit) return p[0].wert;
    if (t >= p[p.length - 1].zeit) return p[p.length - 1].wert;
    const i = p.findIndex((x) => x.zeit >= t);
    const a = p[i - 1], b = p[i];
    return a.wert + ((b.wert - a.wert) * (t - a.zeit)) / (b.zeit - a.zeit);
  },
};

// ---------- Vorgaben (ohne persönliche Daten) ----------

export const Vorgaben = (() => {
  const g = (id, name, ml, o = {}) => produkt({
    id, name, fluessig: true, portion: ml, volProzent: o.vol || 0, koffeinMgPro100: o.koffein || 0, favorit: !!o.fav,
    naehrwerte: { kcal: o.kcal || 0, kohlenhydrate: o.kh || 0, zucker: o.zucker || 0, fett: o.fett || 0, eiweiss: o.eiweiss || 0 },
  });
  const nw = (kcal, fett, gesaettigt, kohlenhydrate, zucker, ballaststoffe, eiweiss, salz, mikros = {}) => ({ kcal, fett, gesaettigt, kohlenhydrate, zucker, ballaststoffe, eiweiss, salz, mikros });
  const basis = () => [
    g('bier05', 'Bier 0,5 l', 500, { vol: 4.9, kcal: 42, kh: 3, eiweiss: 0.5, fav: true }),
    g('bier033', 'Bier 0,33 l', 330, { vol: 4.9, kcal: 42, kh: 3, eiweiss: 0.5 }),
    g('weizen', 'Weizen 0,5 l', 500, { vol: 5.4, kcal: 46, kh: 3.2, eiweiss: 0.5 }),
    g('radler', 'Radler 0,5 l', 500, { vol: 2.5, kcal: 40, kh: 6, zucker: 5.5 }),
    g('weisswein', 'Weißwein 0,2 l', 200, { vol: 12, kcal: 82, kh: 2.6, zucker: 1, fav: true }),
    g('rotwein', 'Rotwein 0,2 l', 200, { vol: 13, kcal: 85, kh: 2.6, zucker: 0.6 }),
    g('sekt', 'Sekt 0,1 l', 100, { vol: 11, kcal: 80, kh: 4, zucker: 4 }),
    g('schnaps', 'Schnaps 2 cl (40 %)', 20, { vol: 40, kcal: 231, fav: true }),
    g('longdrink', 'Longdrink (4 cl + Cola)', 240, { vol: 6.7, koffein: 8.3, kcal: 73, kh: 8.8, zucker: 8.8 }),
    g('espresso', 'Espresso', 30, { koffein: 233, kcal: 2, fav: true }),
    g('doppio', 'Doppelter Espresso', 60, { koffein: 233, kcal: 2 }),
    g('kaffee', 'Kaffee (Tasse)', 200, { koffein: 45, kcal: 2, fav: true }),
    g('cappuccino', 'Cappuccino', 200, { koffein: 35, kcal: 45, kh: 3.6, zucker: 3.6, fett: 2.6, eiweiss: 2.5, fav: true }),
    g('latte', 'Latte Macchiato', 300, { koffein: 23, kcal: 50, kh: 4, zucker: 4, fett: 2.8, eiweiss: 2.7 }),
    g('schwarztee', 'Schwarzer Tee', 250, { koffein: 18, kcal: 1 }),
    g('gruentee', 'Grüner Tee', 250, { koffein: 12, kcal: 1 }),
    g('cola', 'Cola 0,33 l', 330, { koffein: 10, kcal: 42, kh: 10.6, zucker: 10.6 }),
    g('colazero', 'Cola Zero 0,33 l', 330, { koffein: 10, kcal: 0.3 }),
    g('energy', 'Energy Drink 0,25 l', 250, { koffein: 32, kcal: 45, kh: 11, zucker: 11, fav: true }),
    g('mate', 'Mate-Limonade 0,5 l', 500, { koffein: 20, kcal: 20, kh: 5, zucker: 5 }),
    g('wasser', 'Wasser 0,5 l', 500, {}),
    produkt({ id: 'koffeintablette', name: 'Koffeintablette 200 mg', portion: 1, koffeinMgPro100: 20000 }),
    produkt({ id: 'haferflocken', name: 'Haferflocken', portion: 60, naehrwerte: nw(372, 7, 1.3, 59, 1, 10, 13.5, 0.01, { magnesium: 130, eisen: 4.2, zink: 3.5, b1: 0.6 }) }),
    produkt({ id: 'banane', name: 'Banane', portion: 120, naehrwerte: nw(93, 0.2, 0.1, 20, 17, 1.8, 1.1, 0, { kalium: 370, magnesium: 30, b6: 0.36 }) }),
    produkt({ id: 'ei', name: 'Ei (Größe M)', portion: 60, naehrwerte: nw(140, 9.5, 3, 0.7, 0.7, 0, 12.5, 0.35, { vitD: 2.9, b12: 1, vitA: 270 }) }),
    produkt({ id: 'magerquark', name: 'Magerquark', portion: 250, naehrwerte: nw(67, 0.3, 0.1, 4, 4, 0, 12, 0.1, { calcium: 90 }) }),
    produkt({ id: 'haehnchen', name: 'Hähnchenbrust (roh)', portion: 150, naehrwerte: nw(110, 1.5, 0.4, 0, 0, 0, 23.5, 0.15, { niacin: 10, b6: 0.5 }) }),
    produkt({ id: 'reis', name: 'Reis (gekocht)', portion: 200, naehrwerte: nw(130, 0.3, 0.1, 28, 0.1, 0.4, 2.7, 0) }),
    produkt({ id: 'vollmilch', name: 'Vollmilch 3,5 %', fluessig: true, portion: 250, naehrwerte: nw(64, 3.5, 2.3, 4.8, 4.8, 0, 3.3, 0.1, { calcium: 120, b12: 0.4 }) }),
  ];
  return { produkte: () => basis() };
})();

// ---------- Vorlagen: gängige Supplements, Proteine und Booster zum Übernehmen ----------

/**
 * Werte je Portion nach Hersteller- und Händlerangaben (Stand 11/2026), gespeichert pro 100 g. Sorten weichen ab,
 * darum ist alles als Richtwert markiert ([Produkt.pruefen]), bis das Etikett gescannt ist. Fehlt eine gesicherte
 * Angabe, bleibt das Feld leer statt geraten. [plan] nach Verzehrempfehlung des Herstellers, änderbar.
 */
export const Vorlagen = (() => {
  const v = (id, marke, name, kategorie, gramm, portionName, o = {}) => {
    const f = 100 / gramm;
    return {
      marke,
      produkt: produkt({
        id: 'v_' + id, name: `${marke === 'Allgemein' ? '' : marke + ' '}${name}`, kategorie, portion: gramm, portionName,
        koffeinMgPro100: (o.koffein || 0) * f, pruefen: true, plan: o.plan || [], planMenge: o.planMenge || 0, kurWochen: o.kur || 0,
        naehrwerte: {
          kcal: (o.kcal || 0) * f, eiweiss: (o.eiweiss || 0) * f, kohlenhydrate: (o.kh || 0) * f, zucker: (o.zucker || 0) * f, fett: (o.fett || 0) * f,
          mikros: Object.fromEntries(Object.entries(o.mikros || {}).map(([k, x]) => [k, x * f])),
        },
      }),
      notiz: o.notiz || '',
    };
  };
  const S_ = 'SUPPLEMENT', P = 'PROTEIN', B = 'BOOSTER';
  return [
    // ESN
    v('esn_designer', 'ESN', 'Designer Whey', P, 30, 'Messlöffel', { kcal: 115, eiweiss: 23.5, kh: 1.8, zucker: 1.2, fett: 1.4, plan: ['NACH_TRAINING'] }),
    v('esn_isoclear', 'ESN', 'Isoclear Whey Isolate', P, 30, 'Messlöffel', { kcal: 105, eiweiss: 25, kh: 0.5, fett: 0.1, plan: ['NACH_TRAINING'] }),
    v('esn_flexpresso', 'ESN', 'Flexpresso Protein Coffee', P, 30, 'Portion', { kcal: 110, eiweiss: 22.5, kh: 2.5, zucker: 1.1, fett: 0.6, koffein: 80 }),
    v('esn_kollagen', 'ESN', 'Collagen Peptide', P, 10, 'Portion', { kcal: 36, eiweiss: 9, mikros: { w_kollagen: 9 } }),
    v('esn_crank', 'ESN', 'Crank Booster', B, 15, 'Portion', { koffein: 200, mikros: { w_citrullin: 4.1 }, plan: ['VOR_TRAINING'], notiz: 'Portion laut Dose prüfen.' }),
    v('esn_guarana', 'ESN', 'Guarana Giga Caps', B, 1.2, 'Kapsel', { koffein: 100, plan: ['VOR_TRAINING'] }),
    v('esn_creapure', 'ESN', 'Creapure', S_, 3.5, 'Messlöffel', { mikros: { w_kreatin: 3.5 }, plan: ['NACH_TRAINING'] }),
    v('esn_zink', 'ESN', 'Zinc', S_, 0.5, 'Kapsel', { mikros: { zink: 25 }, plan: ['TAGSUEBER'] }),
    v('esn_magnesium', 'ESN', 'Magnesium', S_, 1, 'Kapsel', { mikros: { magnesium: 150 }, plan: ['MORGENS', 'ABENDS'] }),
    v('esn_vitaminstack', 'ESN', 'Vitamin Stack', S_, 1, 'Kapsel', { mikros: { vitD: 20, vitC: 250, vitA: 800, vitE: 10, vitK: 100, niacin: 48, folat: 600, biotin: 150 }, plan: ['MORGENS'] }),
    // MORE Nutrition
    v('more_total', 'MORE', 'Total Protein', P, 30, 'Portion', { kcal: 114, eiweiss: 22, notiz: 'Werte für das Pulver, ohne Milch oder Drink.' }),
    v('more_every', 'MORE', 'Every Workout', B, 18, 'Portion', { kcal: 35, koffein: 150, plan: ['VOR_TRAINING'] }),
    // Bodylab
    v('bodylab_whey', 'Bodylab', 'Whey Protein', P, 30, 'Messlöffel', { kcal: 120, eiweiss: 24, plan: ['NACH_TRAINING'] }),
    v('bodylab_coffee', 'Bodylab', 'Protein Coffee', P, 30, 'Portion', { kcal: 110, eiweiss: 22, koffein: 69 }),
    // Bodybuilding Depot
    v('bbd_wpc80', 'Bodybuilding Depot', 'WPC-80 Whey', P, 30, 'Portion', { kcal: 120, eiweiss: 22.5, kh: 2, fett: 2, plan: ['NACH_TRAINING'] }),
    v('bbd_wpi90', 'Bodybuilding Depot', 'WPI-90 Isolat', P, 30, 'Portion', { kcal: 112, eiweiss: 27, kh: 0.5, fett: 0.3 }),
    v('bbd_kreatin', 'Bodybuilding Depot', 'Creatin Monohydrat', S_, 5, 'Portion', { mikros: { w_kreatin: 5 }, plan: ['NACH_TRAINING'] }),
    // MyProtein
    v('mp_impact', 'MyProtein', 'Impact Whey Protein', P, 25, 'Messlöffel', { kcal: 103, eiweiss: 21, kh: 1, zucker: 1, fett: 1.9, plan: ['NACH_TRAINING'] }),
    v('mp_vitd3', 'MyProtein', 'Vitamin D3 Elite', S_, 0.3, 'Softgel', { mikros: { vitD: 62.5 }, plan: ['MORGENS'] }),
    v('mp_ashwagandha', 'MyProtein', 'Ashwagandha KSM-66', S_, 0.6, 'Kapsel', { mikros: { w_ashwagandha: 500 }, plan: ['MORGENS'], kur: 12 }),
    // Allgemein (ohne Marke)
    v('kreatin', 'Allgemein', 'Kreatin Monohydrat', S_, 5, 'Messlöffel', { mikros: { w_kreatin: 5 }, plan: ['TAGSUEBER'] }),
    v('casein', 'Allgemein', 'Casein Protein', P, 30, 'Messlöffel', { kcal: 110, eiweiss: 24, kh: 1.5, fett: 0.6, plan: ['ABENDS'] }),
    v('vegan', 'Allgemein', 'Veganes Protein', P, 30, 'Messlöffel', { kcal: 115, eiweiss: 21, kh: 2, fett: 2 }),
    v('betaalanin', 'Allgemein', 'Beta-Alanin', S_, 3.2, 'Portion', { mikros: { w_betaalanin: 3.2 }, plan: ['VOR_TRAINING'] }),
    v('citrullin', 'Allgemein', 'Citrullin Malat', S_, 6, 'Portion', { mikros: { w_citrullin: 6 }, plan: ['VOR_TRAINING'] }),
    v('omega3', 'Allgemein', 'Omega-3 Kapseln (1000 mg Fischöl)', S_, 1.4, 'Kapsel', { kcal: 9, fett: 1, mikros: { omega3: 0.3 } }),
    v('vitd3', 'Allgemein', 'Vitamin D3 1000 IE', S_, 0.25, 'Tablette', { mikros: { vitD: 25 }, plan: ['MORGENS'] }),
    v('magnesium', 'Allgemein', 'Magnesium 300 mg', S_, 1, 'Kapsel', { mikros: { magnesium: 300 }, plan: ['ABENDS'] }),
    v('zink', 'Allgemein', 'Zink 10 mg', S_, 0.4, 'Tablette', { mikros: { zink: 10 } }),
    v('koffein200', 'Allgemein', 'Koffeinkapsel 200 mg', B, 0.5, 'Kapsel', { koffein: 200, plan: ['VOR_TRAINING'] }),
  ];
})();

// ---------- Plan-Vorlagen (wie Vorlagen.kt) ----------

/**
 * Vorlagen zum Plan-Erstellen: ein paar typische Kapseln und je Wirkstoff ein reines Pulver (Portion 1 g, Menge je
 * Einnahme = übliche Dosis). Beim Hinzufügen wird ein eigenes Produkt angelegt; Werte bleiben als Richtwert markiert,
 * bis sie mit dem Etikett abgeglichen sind. { name, beschreibung, produkt, keys }
 */
export const PlanVorlagen = (() => {
  const pulver = (m) => {
    const proGramm = m.einheit === 'g' ? 1 : m.einheit === 'mg' ? 1000 : 1_000_000;
    const dosisG = m.dosis / proGramm;
    const p = produkt({
      id: '', name: m.name, portion: 1, kategorie: 'SUPPLEMENT', pruefen: true, planMenge: dosisG > 0 ? dosisG : 1,
      naehrwerte: { mikros: { [m.key]: proGramm * 100 } }, kurWochen: Wissen.info(m.key)?.kurWochen || 0,
    });
    return { name: m.name, beschreibung: `Pulver, Feinwaage · üblich ${Format.zahl(m.dosis, 2)} ${m.einheit} pro Tag`, produkt: p, keys: [m.key] };
  };
  const kapsel = (name, gramm, portionName, kategorie, mikros, koffeinMg, beschreibung) => {
    const f = 100 / gramm;
    const p = produkt({
      id: '', name, portion: gramm, portionName, kategorie, pruefen: true, koffeinMgPro100: koffeinMg * f,
      naehrwerte: { mikros: Object.fromEntries(Object.entries(mikros).map(([k, v]) => [k, v * f])) },
    });
    return { name, beschreibung, produkt: p, keys: [...Object.keys(mikros), ...(koffeinMg > 0 ? ['koffein'] : [])] };
  };
  return [
    kapsel('Vitamin D3 1000 IE', 0.3, 'Kapsel', 'SUPPLEMENT', { vitD: 25 }, 0, '25 µg je Kapsel'),
    kapsel('Magnesium', 1, 'Kapsel', 'SUPPLEMENT', { magnesium: 150 }, 0, '150 mg je Kapsel'),
    kapsel('Zink', 0.5, 'Kapsel', 'SUPPLEMENT', { zink: 10 }, 0, '10 mg je Kapsel'),
    kapsel('Omega-3', 1, 'Kapsel', 'SUPPLEMENT', { omega3: 0.3 }, 0, '0,3 g EPA + DHA je Kapsel'),
    kapsel('Koffein 200 mg', 0.5, 'Tablette', 'BOOSTER', {}, 200, '200 mg je Tablette'),
    {
      name: 'Whey Protein', beschreibung: 'Messlöffel 30 g, Durchschnittswerte', keys: [],
      produkt: produkt({
        id: '', name: 'Whey Protein', portion: 30, portionName: 'Messlöffel', kategorie: 'PROTEIN', pruefen: true,
        naehrwerte: { kcal: 380, fett: 5, kohlenhydrate: 6, zucker: 4, eiweiss: 78, salz: 0.5 },
      }),
    },
    ...Wirkstoffe.filter((m) => m.dosis > 0).map(pulver),
  ];
})();

// ---------- Suche (wie Suchtext in der Android-App) ----------

/** Suchtext ohne Groß-/Kleinschreibung, Umlaute (auch „ae/oe/ue“), Akzente und Satzzeichen. */
export const Suchtext = {
  normal: (s) => String(s).toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/\p{M}+/gu, '').replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ').trim(),
  /** Suchwörter (mindestens 2 Zeichen), längstes zuerst. */
  woerter: (s) => [...new Set(Suchtext.normal(s).split(' ').filter((w) => w.length >= 2))].sort((a, b) => b.length - a.length),
  /** Eingabe ist ein Barcode (nur Ziffern und Leerzeichen, mindestens 8 Ziffern); 12 Stellen (UPC-A) mit führender 0. */
  barcode(s) {
    const t = String(s).trim();
    if (!/^[\d ]+$/.test(t)) return null;
    const z = t.replace(/ /g, '');
    return z.length >= 8 ? Barcode.normal(z) : null;
  },
  passt(text, woerter) {
    if (!woerter.length) return false;
    const n = Suchtext.normal(text);
    return woerter.every((w) => n.includes(w));
  },
  /** Bewertung wie NamenIndex: Wortanfänge zuerst, dann kürzere Namen. */
  punkte(n, woerter) {
    const anfang = woerter.filter((w) => n.startsWith(w) || n.includes(' ' + w)).length;
    return anfang * 2 + (n.startsWith(woerter[0]) ? 1 : 0) - n.length / 100;
  },
  /** Liste nach [frage] filtern und sortieren; [text] liefert den Suchtext eines Elements. */
  filtern(liste, frage, text, max = Infinity) {
    const w = Suchtext.woerter(frage);
    if (!w.length) return [];
    return liste.map((x) => [x, Suchtext.normal(text(x))]).filter(([, n]) => w.every((x) => n.includes(x)))
      .map(([x, n]) => [x, Suchtext.punkte(n, w)]).sort((a, b) => b[1] - a[1]).slice(0, max).map(([x]) => x);
  },
};
