// Einkaufsliste (Port von features/einkauf/logic der Android-App, ohne Läden, Erinnerungen und Scan) mit Vorschlägen
// aus Food & Boost: was oft eingetragen wird, kommt gerundet auf übliche Gebinde als Vorschlag (wie Nachkauf.kt).
// Das Datenformat entspricht der Android-Sicherung „dach-einkauf“, soweit die Felder hier vorkommen.
import { istBoost } from './logik.js';

export const FORMAT = 'dach-einkauf';
const TAG = 86_400_000;
const neueId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, '').slice(0, 12);
/** „Nie mehr vorschlagen“ (Android nimmt Long.MAX_VALUE; JSON-Zahlen sind hier ungenau, darum eine feste Grenze). */
export const NIE = 9e15;

export const Einheit = {
  STUECK: { kurz: 'Stk' }, PACKUNG: { kurz: 'Pck' }, KG: { kurz: 'kg' }, G: { kurz: 'g' }, L: { kurz: 'l' }, ML: { kurz: 'ml' },
};

export function einstellungen(o = {}) {
  return { nachkaufAktiv: true, nachkaufTage: 7, ...o };
}

export function neueDaten() {
  return { format: FORMAT, version: 1, laeden: [], produkte: [], eintraege: [], erinnerungen: [], vorrat: [], einstellungen: einstellungen(), ausgeblendet: {} };
}

/** Gespeicherte Daten oder eine Android-Sicherung lesen; fehlende Felder auffüllen. */
export function datenLesen(o) {
  if (!o || typeof o !== 'object' || o.format !== FORMAT) throw new Error('Die Datei ist keine Einkaufslisten-Sicherung.');
  const n = neueDaten();
  return {
    ...n, ...o,
    produkte: (o.produkte || []).map((p) => ({ barcodes: [], einheit: 'STUECK', groesse: '', kategorie: '', preise: {}, benutzt: 0, zuletzt: 0, letzterKauf: null, ...p })),
    eintraege: (o.eintraege || []).map(eintrag),
    vorrat: o.vorrat || [],
    einstellungen: einstellungen(o.einstellungen),
    ausgeblendet: Object.fromEntries(Object.entries(o.ausgeblendet || {}).map(([k, v]) => [k, v > NIE ? NIE : v])),
  };
}

export const istEinkauf = (o) => !!o && typeof o === 'object' && o.format === FORMAT;

function eintrag(o = {}) {
  return { id: neueId(), name: '', produktId: null, menge: 1, einheit: 'STUECK', groesse: '', preisCent: null, ladenId: null, kategorie: '', notiz: '', erledigt: false, angelegt: 0, erledigtAm: null, ...o };
}

export const schluessel = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
export const offen = (d) => d.eintraege.filter((e) => !e.erledigt);

// ---------- Format ----------

export const Format = {
  euro(cent) {
    const v = cent < 0 ? '-' : '';
    const c = Math.abs(cent);
    return `${v}${Math.floor(c / 100)},${String(c % 100).padStart(2, '0')} €`;
  },
  preis(text) {
    const t = String(text).trim().replace('€', '').replace(/eur(o)?/i, '').replace('–', '-').trim();
    let m = /^(\d{1,5})(?:[.,](\d{1,2}|-+))?$/.exec(t);
    if (m) {
      const nach = m[2] || '';
      const cent = !nach || nach.startsWith('-') ? 0 : nach.length === 1 ? +nach * 10 : +nach;
      return +m[1] * 100 + cent;
    }
    m = /^-?[.,](\d{2})$/.exec(t);
    return m ? +m[1] : null;
  },
  zahl(d) {
    const r = Math.round(d * 1000) / 1000;
    return String(r).replace('.', ',');
  },
  zahlLesen(t) {
    const v = parseFloat(String(t).trim().replace(',', '.'));
    return Number.isFinite(v) && v > 0 ? v : null;
  },
  /** "2 × Milch (1 l)", "500 g Hackfleisch", "1 Pck Bier (20 × 0,5 l Flasche)". */
  eintrag(e) {
    const menge = e.einheit === 'STUECK' ? (e.menge === 1 ? '' : `${Format.zahl(e.menge)} × `)
      : e.einheit === 'PACKUNG' ? `${Format.zahl(e.menge)} Pck ` : `${Format.zahl(e.menge)} ${Einheit[e.einheit].kurz} `;
    return menge + e.name + (e.groesse ? ` (${e.groesse})` : '');
  },
  gesamtCent(e) {
    if (e.preisCent == null) return null;
    const f = e.einheit === 'G' || e.einheit === 'ML' ? 0.001 : 1;
    return Math.round(e.preisCent * e.menge * f);
  },
};

// ---------- Schnelleingabe ----------

const ZAHL = '(\\d+(?:[.,]\\d+)?)';
const EINHEITEN = [
  ['kg', 'KG'], ['g', 'G'], ['gr', 'G'], ['l', 'L'], ['ltr', 'L'], ['liter', 'L'], ['ml', 'ML'], ['stk', 'STUECK'], ['st', 'STUECK'],
  ['stück', 'STUECK'], ['pck', 'PACKUNG'], ['pkg', 'PACKUNG'], ['packung', 'PACKUNG'], ['packungen', 'PACKUNG'], ['x', 'STUECK'], ['×', 'STUECK'], ['mal', 'STUECK'],
];
const EM = EINHEITEN.map((e) => e[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length).join('|');
const einheitFuer = (s) => (EINHEITEN.find((e) => e[0] === String(s).toLowerCase()) || [0, 'STUECK'])[1];

/** "2x Milch", "Milch x2", "500 g Hack", "Butter 1,99 €", "2 Joghurt à 0,49" → { name, menge, einheit, preisCent }. */
export function zeile(text) {
  let t = String(text).trim().replace(/\s+/g, ' ');
  if (!t) return null;
  let preis = null;
  const pm = /\s+(?:à|a|je|@|für|zu)?\s*(\d{1,4}[.,](?:\d{2}|-+))\s*(?:€|eur|euro)?$/i.exec(t) || /\s+(?:à|je|@|für|zu)?\s*€\s*(\d{1,4}[.,]\d{2})$/i.exec(t);
  if (pm) {
    const p = Format.preis(pm[1]);
    if (p != null) { preis = p; t = t.slice(0, pm.index).trim(); }
  }
  let menge = 1, einheit = 'STUECK';
  const vx = new RegExp(`^${ZAHL}(x|×)(.+)$`, 'i').exec(t);
  const vo = vx ? [vx[1], 'x', vx[3]] : (() => { const m = new RegExp(`^${ZAHL}\\s*(${EM})?\\.?\\s+(.+)$`, 'i').exec(t); return m ? [m[1], m[2] || '', m[3]] : null; })();
  if (vo && /\p{L}/u.test(vo[2])) {
    menge = Format.zahlLesen(vo[0]) || 1; einheit = einheitFuer(vo[1]); t = vo[2].trim();
  } else {
    const h = new RegExp(`^(.+?)\\s+(?:(?:x|×)\\s*${ZAHL}|${ZAHL}\\s*(${EM})\\.?)$`, 'i').exec(t);
    if (h && /\p{L}/u.test(h[1])) {
      menge = Format.zahlLesen(h[2] || h[3]) || 1; einheit = h[2] ? 'STUECK' : einheitFuer(h[4]); t = h[1].trim();
    } else {
      const z = /^(.+?)\s+(\d{1,2})$/.exec(t);
      if (z && /\p{L}/u.test(z[1])) { menge = +z[2]; t = z[1].trim(); }
    }
  }
  t = t.replace(/^[\s,\-:]+|[\s,\-:]+$/g, '');
  if (!/\p{L}/u.test(t)) return null;
  return { name: t[0].toUpperCase() + t.slice(1), menge, einheit, preisCent: preis, groesse: '' };
}

// ---------- Liste ----------

export function produktZuName(d, name) {
  const k = schluessel(name);
  return d.produkte.find((p) => schluessel(p.name) === k) || null;
}

export function produktFuerBarcode(d, code) {
  const n = String(code).replace(/\D/g, '');
  return n ? d.produkte.find((p) => (p.barcodes || []).some((b) => String(b).replace(/\D/g, '') === n)) || null : null;
}

/** Eintrag aus der Schnelleingabe: Einheit, Größe und Preis wie beim letzten Mal, wenn nichts angegeben ist. */
export function ausVorlage(d, v) {
  const p = produktZuName(d, v.name);
  return eintrag({
    name: p?.name || v.name, produktId: p?.id || null, menge: v.menge,
    einheit: v.einheit === 'STUECK' && v.menge === 1 && p ? p.einheit : v.einheit,
    groesse: v.groesse || p?.groesse || '', preisCent: v.preisCent ?? p?.preise?.['']?.cent ?? null, kategorie: p?.kategorie || '',
  });
}

/** Auf die Liste; gleiches offenes Produkt in gleicher Einheit wird aufgestockt. Das Produkt wird gemerkt. */
export function hinzufuegen(d, neu, jetzt) {
  const e0 = eintrag({ ...neu, name: neu.name.trim(), angelegt: neu.angelegt || jetzt });
  if (!e0.name) throw new Error('Bitte einen Namen eingeben.');
  const alt = d.produkte.find((p) => p.id === e0.produktId) || produktZuName(d, e0.name);
  const preise = { ...(alt?.preise || {}), ...(e0.preisCent != null ? { '': { cent: e0.preisCent, zeit: jetzt } } : {}) };
  const p = {
    barcodes: [], kategorie: '', letzterKauf: null, ...(alt || { id: neueId() }),
    name: e0.name, einheit: e0.einheit, groesse: e0.groesse || alt?.groesse || '', preise, benutzt: (alt?.benutzt || 0) + 1, zuletzt: jetzt,
  };
  const produkte = alt ? d.produkte.map((x) => (x.id === alt.id ? p : x)) : [...d.produkte, p];
  const e = { ...e0, produktId: p.id };
  const gleich = d.eintraege.find((x) => !x.erledigt && x.einheit === e.einheit && (x.produktId === e.produktId || schluessel(x.name) === schluessel(e.name)));
  if (gleich) {
    const z = { ...gleich, menge: gleich.menge + e.menge, preisCent: e.preisCent ?? gleich.preisCent, groesse: gleich.groesse || e.groesse, produktId: e.produktId };
    return { ...d, produkte, eintraege: d.eintraege.map((x) => (x.id === gleich.id ? z : x)) };
  }
  return { ...d, produkte, eintraege: [...d.eintraege, e] };
}

/** Abhaken merkt den Kauf beim Produkt (für die Vorschläge); Zurücknehmen löscht ihn wieder. */
export function abhaken(d, id, erledigt, jetzt) {
  const e = d.eintraege.find((x) => x.id === id);
  if (!e) return d;
  const eintraege = d.eintraege.map((x) => (x.id === id ? { ...x, erledigt, erledigtAm: erledigt ? jetzt : null } : x));
  const p = d.produkte.find((x) => x.id === e.produktId);
  if (!p) return { ...d, eintraege };
  let kauf;
  if (erledigt) kauf = { zeit: jetzt, menge: e.menge, einheit: e.einheit, groesse: e.groesse };
  else if (p.letzterKauf && p.letzterKauf.zeit === e.erledigtAm) kauf = null;
  else return { ...d, eintraege };
  return { ...d, eintraege, produkte: d.produkte.map((x) => (x.id === p.id ? { ...x, letzterKauf: kauf } : x)) };
}

export const loeschen = (d, id) => ({ ...d, eintraege: d.eintraege.filter((e) => e.id !== id) });
export const erledigteEntfernen = (d) => ({ ...d, eintraege: d.eintraege.filter((e) => !e.erledigt) });
export const mengeSetzen = (d, id, menge) => ({ ...d, eintraege: d.eintraege.map((e) => (e.id === id ? { ...e, menge: Math.max(1, menge) } : e)) });

/** Für Messenger: offene Einträge, je Zeile. */
export const alsText = (d) => offen(d).map((e) => '☐ ' + Format.eintrag(e)).join('\n');

/** Tipp-Vorschläge: gemerkte Produkte, die zum Text passen und nicht offen auf der Liste stehen. */
export function tippVorschlaege(d, text, max = 6) {
  const t = schluessel(text);
  const auf = new Set(offen(d).map((e) => schluessel(e.name)));
  return d.produkte.filter((p) => !auf.has(schluessel(p.name)) && (!t || schluessel(p.name).includes(t)))
    .sort((a, b) => b.benutzt - a.benutzt || b.zuletzt - a.zuletzt).slice(0, t ? max : 0);
}

// ---------- Verbrauch aus Food & Boost ----------

const ZUBEREITET = new Set(['espresso', 'doppio', 'kaffee', 'cappuccino', 'latte', 'schwarztee', 'gruentee', 'longdrink', 'schnaps', 'sekt', 'weisswein', 'rotwein', 'koffeintablette']);

/** Wie Nachkaufen.kt: Produkte mit mindestens 2 Einträgen in 60 Tagen, ohne Boost und ohne Zubereitetes. */
export function verbrauchAus(food, jetzt) {
  const ab = jetzt - 60 * TAG;
  const je = new Map();
  for (const e of food.eintraege) {
    if (!e.produktId || !(e.menge > 0) || e.zeit < ab || e.zeit > jetzt) continue;
    if (!je.has(e.produktId)) je.set(e.produktId, []);
    je.get(e.produktId).push([e.zeit, e.menge]);
  }
  const r = [];
  for (const [id, liste] of je) {
    const p = food.produkte.find((x) => x.id === id);
    if (!p || istBoost(p.kategorie) || ZUBEREITET.has(p.id) || liste.length < 2) continue;
    r.push({ name: p.name, ean: p.ean || '', fluessig: !!p.fluessig, portion: p.portion, packung: '', eintraege: liste });
  }
  return r;
}

// ---------- Nachkauf ----------

export const Nachkauf = {
  FENSTER_TAGE: 28, AB_EINTRAEGEN: 4, AB_TAGEN: 3, VORLAUF_TAGE: 3, SPAETER_TAGE: 7, KAUF_GILT_TAGE: 60,

  vorschlaege(d, verbrauch, jetzt) {
    if (!d.einstellungen.nachkaufAktiv) return [];
    const tage = Math.min(30, Math.max(2, d.einstellungen.nachkaufTage));
    const auf = offen(d);
    const imVorrat = new Set((d.vorrat || []).filter((v) => v.menge > 0).map((v) => schluessel(v.name)));
    return verbrauch.map((v) => this.vorschlag(d, v, jetzt, tage, auf, imVorrat)).filter(Boolean)
      .sort((a, b) => b.proTag * (b.rest == null ? 1 : 2) - a.proTag * (a.rest == null ? 1 : 2));
  },

  vorschlag(d, v, jetzt, tage, auf, imVorrat) {
    const name = this.nameOhneMenge(v.name);
    const key = schluessel(name);
    if (!key || (d.ausgeblendet[key] || 0) > jetzt) return null;
    const produkt = this.produktZu(d, v, name);
    const keys = new Set([key, schluessel(v.name), produkt && schluessel(produkt.name)].filter(Boolean));
    if (auf.some((e) => keys.has(schluessel(e.name)) || (produkt && e.produktId === produkt.id))) return null;
    if ([...keys].some((k) => imVorrat.has(k))) return null;

    const ab = jetzt - this.FENSTER_TAGE * TAG;
    const fenster = v.eintraege.filter(([z, m]) => z >= ab && z <= jetzt && m > 0);
    const tageSet = new Set(fenster.map(([z]) => Math.floor(z / TAG)));
    if (fenster.length < this.AB_EINTRAEGEN || tageSet.size < this.AB_TAGEN) return null;

    const bekannt = (produkt && this.inhalt(produkt.groesse)) || this.inhalt(v.packung);
    const behaelter = this.behaelter(name, v.fluessig, bekannt ? bekannt[1] : v.portion);
    let einheit = 0;
    if (bekannt) einheit = bekannt[1];
    else if (!v.fluessig) einheit = 0;
    else if (behaelter === 'KARTON' && v.portion < 900) einheit = 1000;
    else if (behaelter === 'PET' && v.portion < 450) einheit = 1000;
    else if (v.portion >= 150 && v.portion <= 2000) einheit = v.portion;
    const erster = Math.min(...fenster.map(([z]) => z));
    const spanne = Math.min(this.FENSTER_TAGE, Math.max(7, (jetzt - erster) / TAG));
    const kauf = produkt?.letzterKauf && jetzt - produkt.letzterKauf.zeit < this.KAUF_GILT_TAGE * TAG ? produkt.letzterKauf : null;
    const basis = { schluessel: key, name: produkt?.name || name, ean: v.ean, behaelter, fluessig: v.fluessig, mal: fenster.length };

    if (einheit <= 0) {
      if (kauf && jetzt - kauf.zeit < tage * TAG) return null;
      return { ...basis, inhalt: 0, proTag: fenster.length / spanne, rest: null, optionen: [{ gebinde: { stueck: 1, name: 'Packung' }, anzahl: 1 }], empfohlen: 0 };
    }
    const proTag = fenster.reduce((a, [, m]) => a + m / einheit, 0) / spanne;
    const rest = kauf ? this.kaufEinheiten(kauf, einheit) - v.eintraege.filter(([z]) => z >= kauf.zeit).reduce((a, [, m]) => a + m / einheit, 0) : null;
    if (rest != null && rest > proTag * this.VORLAUF_TAGE) return null;

    const bedarf = Math.max(1, proTag * tage - Math.max(rest ?? 0, 0));
    const gemerktText = produkt && this.stueckAus(produkt.groesse) != null ? produkt.groesse : v.packung;
    const optionen = this.gebinde(behaelter, einheit, gemerktText).map((g) => ({ gebinde: g, anzahl: Math.max(1, Math.round(bedarf / g.stueck)) }));
    const gemerkt = this.stueckAus(gemerktText);
    let empfohlen = gemerkt != null ? optionen.findIndex((o) => o.gebinde.stueck === gemerkt) : -1;
    if (empfohlen < 0) {
      let best = Infinity;
      optionen.forEach((o, i) => {
        const s = Math.abs(o.gebinde.stueck * o.anzahl - bedarf) / bedarf + (o.gebinde.stueck === 1 && optionen.length > 1 ? 0.25 : 0) - o.gebinde.stueck * 1e-6;
        if (s < best) { best = s; empfohlen = i; }
      });
    }
    return { ...basis, inhalt: einheit, proTag, rest, optionen, empfohlen };
  },

  produktZu(d, v, name = this.nameOhneMenge(v.name)) {
    if (v.ean) { const p = produktFuerBarcode(d, v.ean); if (p) return p; }
    const k = new Set([schluessel(name), schluessel(v.name)]);
    return d.produkte.find((p) => k.has(schluessel(p.name))) || null;
  },

  behaelter(name, fluessig, ml) {
    if (!fluessig) return 'PACKUNG';
    if (/\bdose\b|\bcan\b/i.test(name)) return 'DOSE';
    if (/bier|pils|helles|radler|weizen|weißbier|weissbier|export|lager|alster|kellerbier|märzen|bock|mate/i.test(name)) return 'BIER';
    if (/\bglas\b|glasflasche|mehrweg glas/i.test(name)) return 'GLAS';
    if (/energy|monster|red ?bull|rockstar|burn\b|effect|28 ?black|relentless|reign|celsius|booster/i.test(name) && ml >= 200 && ml <= 568) return 'DOSE';
    if (/milch|milk|drink|hafer|soja|mandel|kakao|saft|nektar/i.test(name)) return 'KARTON';
    if (ml >= 240 && ml <= 360 && !/wasser|sprudel/i.test(name)) return 'DOSE';
    return 'PET';
  },

  gebinde(b, inhalt, gemerkt = '') {
    const G = (stueck, name) => ({ stueck, name });
    const liste = {
      DOSE: [G(1, 'einzeln'), G(6, '6er-Palette'), G(12, '12er-Palette'), G(24, '24er-Palette')],
      BIER: inhalt >= 1 && inhalt <= 400 ? [G(1, 'einzeln'), G(6, '6er-Träger'), G(24, 'Kasten')] : [G(1, 'einzeln'), G(6, '6er-Träger'), G(20, 'Kasten')],
      GLAS: [G(1, 'einzeln'), G(6, '6er-Kasten'), G(12, 'Kasten')],
      PET: inhalt >= 1 && inhalt <= 750 ? [G(1, 'einzeln'), G(6, '6er-Pack'), G(12, '12er-Kasten'), G(24, '24er-Kasten')] : [G(1, 'einzeln'), G(6, '6er-Pack'), G(9, '9er-Pack'), G(12, 'Kasten')],
      KARTON: [G(1, 'einzeln'), G(6, '6er-Karton'), G(12, '12er-Karton')],
      PACKUNG: [G(1, 'Packung')],
    }[b];
    const n = this.stueckAus(gemerkt);
    if (n == null || n <= 1 || liste.some((g) => g.stueck === n)) return liste;
    return [...liste, G(n, `${n}er-Pack`)].sort((a, c) => a.stueck - c.stueck);
  },

  stueckAus(groesse) {
    const m = /(\d{1,2})\s*(?:[x×*]|er)/i.exec(String(groesse || ''));
    const n = m ? +m[1] : null;
    return n >= 2 && n <= 48 ? n : null;
  },

  /** [Anzahl, Inhalt in ml bzw. g] aus "6 x 0,5 l", "1,5 l", "500 g"; null = keine Angabe. */
  inhalt(text) {
    if (!text || !String(text).trim()) return null;
    const n = this.stueckAus(text) || 1;
    const m = /(\d+(?:[.,]\d+)?)\s*(ml|cl|l|ltr|liter|g|gr|kg)\b/i.exec(text);
    if (!m) return null;
    const w = parseFloat(m[1].replace(',', '.'));
    const f = { l: 1000, ltr: 1000, liter: 1000, kg: 1000, cl: 10 }[m[2].toLowerCase()] || 1;
    return w > 0 ? [n, w * f] : null;
  },

  kaufEinheiten(k, inhalt) {
    const n = this.stueckAus(k.groesse);
    if (k.einheit === 'STUECK' || k.einheit === 'PACKUNG') return k.menge * (n || 1);
    if (k.einheit === 'KG' || k.einheit === 'L') return inhalt > 0 ? (k.menge * 1000) / inhalt : k.menge;
    return inhalt > 0 ? k.menge / inhalt : 1;
  },

  nameOhneMenge(name) {
    const r = String(name).replace(/\s*\(?\b\d+(?:[.,]\d+)?\s*(?:ml|cl|l|ltr|liter)\)?\s*$/i, '').trim();
    return r || String(name).trim();
  },

  inhaltText(inhalt, fluessig) {
    if (fluessig && inhalt >= 100) return Format.zahl(inhalt / 1000) + ' l';
    if (fluessig) return Format.zahl(inhalt) + ' ml';
    return inhalt >= 1000 ? Format.zahl(inhalt / 1000) + ' kg' : Format.zahl(inhalt) + ' g';
  },

  einheitText(v) {
    const t = { DOSE: 'Dose', PET: 'Flasche', GLAS: 'Glasflasche', BIER: 'Flasche', KARTON: 'Packung', PACKUNG: 'Packung' }[v.behaelter];
    return v.inhalt > 0 ? `${this.inhaltText(v.inhalt, v.fluessig)} ${t}` : t;
  },

  optionText(o) {
    if (o.gebinde.name === 'einzeln') return `${o.anzahl} einzeln`;
    if (o.gebinde.name === 'Packung') return o.anzahl === 1 ? '1 Packung' : `${o.anzahl} Packungen`;
    return `${o.anzahl} × ${o.gebinde.name}`;
  },

  grundText(v) {
    let rate;
    if (v.inhalt > 0) rate = v.proTag >= 1 ? `≈ ${Format.zahl(Math.round(v.proTag * 10) / 10)} am Tag` : `≈ ${Format.zahl(Math.ceil(v.proTag * 7 * 2) / 2)} pro Woche`;
    else rate = `${v.mal}× in 4 Wochen getrackt`;
    const rest = v.rest == null ? '' : v.rest <= 0.5 ? ' · vermutlich aufgebraucht' : ` · noch ca. ${Math.round(v.rest)}`;
    return rate + rest;
  },

  /** Eintrag für die Liste: "1 Pck Monster (12 × 0,5 l Dose)" bzw. "3 × Wasser (1,5 l)". */
  eintrag(v, o, jetzt) {
    const inh = v.inhalt > 0 ? this.inhaltText(v.inhalt, v.fluessig) : '';
    const t = this.einheitText({ ...v, inhalt: 0 });
    const einzeln = o.gebinde.stueck === 1;
    return eintrag({
      name: v.name, menge: o.anzahl, einheit: einzeln ? 'STUECK' : 'PACKUNG',
      groesse: einzeln ? inh : `${o.gebinde.stueck} × ${inh ? inh + ' ' : ''}${t}`, angelegt: jetzt,
    });
  },

  nehmen(d, v, o, jetzt) {
    let n = hinzufuegen(d, this.eintrag(v, o, jetzt), jetzt);
    if (v.ean && !produktFuerBarcode(n, v.ean)) {
      const p = produktZuName(n, v.name);
      if (p) n = { ...n, produkte: n.produkte.map((x) => (x.id === p.id ? { ...x, barcodes: [...(x.barcodes || []), v.ean] } : x)) };
    }
    return n;
  },

  spaeter(d, key, jetzt) {
    const a = Object.fromEntries(Object.entries(d.ausgeblendet).filter(([, b]) => b > jetzt));
    return { ...d, ausgeblendet: { ...a, [key]: jetzt + this.SPAETER_TAGE * TAG } };
  },
  nie: (d, key) => ({ ...d, ausgeblendet: { ...d.ausgeblendet, [key]: NIE } }),
  nieZuruecksetzen: (d) => ({ ...d, ausgeblendet: Object.fromEntries(Object.entries(d.ausgeblendet).filter(([, b]) => b < NIE)) }),
  nieAnzahl: (d) => Object.values(d.ausgeblendet).filter((b) => b >= NIE).length,
};
