// Mitgelieferte Datenbanken: Barcode-Nährwerte (Open Food Facts) und Lebensmittel (BLS 4.0). Beides liegt als Datei
// neben der App und wird vom Service Worker für den Offline-Betrieb gespeichert.
import { Barcode, Suchtext, dbLesen, dbTeil, lebensmittelLesen } from './logik.js';

async function gzText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const strom = r.body.pipeThrough(new DecompressionStream('gzip'));
  return new Response(strom).text();
}

const teile = new Map();

async function teil(nr) {
  if (!teile.has(nr)) {
    const p = gzText(`daten/naehrwerte/${String(nr).padStart(2, '0')}.tsv.gz`).then((text) => {
      const m = new Map();
      for (const zeile of text.split('\n')) {
        const i = zeile.indexOf('\t');
        if (i > 0) m.set(zeile.slice(0, i), zeile.slice(i + 1));
      }
      return m;
    });
    teile.set(nr, p);
    p.catch(() => teile.delete(nr));
    if (teile.size > 6) teile.delete(teile.keys().next().value);
  }
  return teile.get(nr);
}

/** Produkt zum Barcode aus der Datenbank, oder null. */
export async function dbSuchen(code) {
  const n = Barcode.normal(code);
  if (!n) return null;
  const key = BigInt(n).toString();
  const m = await teil(dbTeil(n));
  const t = m.get(key);
  return t == null ? null : dbLesen(n, t);
}

let info = null;
export async function dbInfo() {
  info ??= fetch('daten/naehrwerte/info.json').then((r) => r.json()).catch(() => null);
  return info;
}

let bls = null;
export function lebensmittel() {
  bls ??= gzText('daten/lebensmittel.tsv.gz').then(lebensmittelLesen).catch((e) => { bls = null; throw e; });
  return bls;
}

// ---------- Namenssuche in der Barcode-Datenbank ----------

let namen = null;
function namenLaden() {
  namen ??= gzText('daten/namen.tsv.gz').catch((e) => { namen = null; throw e; });
  return namen;
}

/**
 * Produkte der Datenbank zu einem Suchtext (alle Wörter müssen in Name oder Marke vorkommen), beste zuerst.
 * Barcode-Eingaben (nur Ziffern) gehen direkt in die Tabelle. Gibt die vollständigen Datensätze zurück.
 */
export async function dbNamenSuchen(frage, max = 25) {
  const code = Suchtext.barcode(frage);
  if (code) { const d = await dbSuchen(code); return d ? [d] : []; }
  const w = Suchtext.woerter(frage);
  if (!w.length) return [];
  const text = await namenLaden();
  const treffer = [];
  const gesehen = new Set();
  let pos = 0;
  while (treffer.length < 5000) {
    pos = text.indexOf(w[0], pos);
    if (pos < 0) break;
    const a = text.lastIndexOf('\n', pos) + 1;
    let e = text.indexOf('\n', pos);
    if (e < 0) e = text.length;
    if (!gesehen.has(a)) {
      gesehen.add(a);
      const zeile = text.slice(a, e);
      const tab = zeile.indexOf('\t');
      const n = zeile.slice(0, tab);
      if (w.every((x) => n.includes(x))) treffer.push([zeile.slice(tab + 1), Suchtext.punkte(n, w)]);
    }
    pos = e + 1;
  }
  treffer.sort((x, y) => y[1] - x[1]);
  const r = await Promise.all(treffer.slice(0, max).map(([ean]) => dbSuchen(ean).catch(() => null)));
  return r.filter(Boolean);
}
