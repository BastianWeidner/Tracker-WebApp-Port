// Speicher auf dem Gerät (IndexedDB). Alles bleibt im Browser, nichts geht ins Netz.
import { neuerStand, standLesen } from './logik.js';

const DB = 'food-boost';
const STORE = 'kv';

function oeffnen() {
  return new Promise((ok, fehler) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fehler(r.error);
  });
}

let dbPromise = null;
const db = () => (dbPromise ??= oeffnen());

async function lesen(key) {
  const d = await db();
  return new Promise((ok, fehler) => {
    const r = d.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fehler(r.error);
  });
}

async function schreiben(key, wert) {
  const d = await db();
  return new Promise((ok, fehler) => {
    const t = d.transaction(STORE, 'readwrite');
    t.objectStore(STORE).put(wert, key);
    t.oncomplete = () => ok();
    t.onerror = () => fehler(t.error);
  });
}

export async function standLaden() {
  try {
    const roh = await lesen('stand');
    return roh ? standLesen(JSON.parse(roh)) : neuerStand();
  } catch (e) {
    console.error(e);
    return neuerStand();
  }
}

let warte = null;
let naechster = null;
/** Speichert gebündelt (höchstens alle 300 ms), damit schnelles Tippen nicht jedes Mal schreibt. */
export function standSpeichern(s) {
  naechster = s;
  if (warte) return;
  warte = setTimeout(async () => {
    warte = null;
    try { await schreiben('stand', JSON.stringify(naechster)); } catch (e) { console.error('Speichern fehlgeschlagen', e); }
  }, 300);
}

export async function meta(key, wert) {
  if (wert === undefined) return lesen('meta:' + key);
  return schreiben('meta:' + key, wert);
}

/** Bittet den Browser, die Daten nicht von selbst zu löschen (Safari löscht sonst nach Wochen ohne Nutzung). */
export async function dauerhaftBitten() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
    return await navigator.storage?.persisted?.();
  } catch { return false; }
}
