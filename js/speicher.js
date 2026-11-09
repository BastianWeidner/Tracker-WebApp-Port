// Speicher auf dem Gerät (IndexedDB). Alles bleibt im Browser, nichts geht ins Netz.
import { neuerStand, standLesen } from './logik.js';
import * as T from './training-logik.js';
import * as E from './einkauf-logik.js';

const DB = 'food-boost'; // Name bleibt, damit vorhandene Daten erhalten bleiben.
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

const warte = {};
const naechste = {};

/** Speichert gebündelt (höchstens alle 300 ms je Schlüssel), damit schnelles Tippen nicht jedes Mal schreibt. */
function speichern(key, s) {
  naechste[key] = s;
  if (warte[key]) return;
  warte[key] = setTimeout(() => wegschreiben(key), 300);
}

async function wegschreiben(key) {
  clearTimeout(warte[key]);
  warte[key] = null;
  if (!(key in naechste)) return;
  const s = naechste[key];
  delete naechste[key];
  try { await schreiben(key, JSON.stringify(s)); } catch (e) { console.error('Speichern fehlgeschlagen', e); }
}

/** Liest einen Stand; noch nicht geschriebene Änderungen gehen vorher auf die Platte. */
async function laden(key, lesenFn, neuFn) {
  if (warte[key]) await wegschreiben(key);
  try {
    const roh = await lesen(key);
    return roh ? lesenFn(JSON.parse(roh)) : neuFn();
  } catch (e) {
    console.error(e);
    return neuFn();
  }
}

/** Ausstehende Änderungen sofort schreiben (z. B. bevor die Seite in den Hintergrund geht). */
export const alleSchreiben = () => Promise.all(Object.keys(naechste).map(wegschreiben));
addEventListener('pagehide', () => { alleSchreiben(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') alleSchreiben(); });

// Food & Boost (Schlüssel „stand“, wie in Version 1.0).
export const standLaden = () => laden('stand', standLesen, neuerStand);
export const standSpeichern = (s) => speichern('stand', s);

// Training (Schlüssel „training“).
export const trainingLaden = () => laden('training', T.standLesen, T.neuerStand);
export const trainingSpeichern = (s) => speichern('training', s);

// Einkaufsliste (Schlüssel „einkauf“, seit 1.4.0).
export const einkaufLaden = () => laden('einkauf', E.datenLesen, E.neueDaten);
export const einkaufSpeichern = (s) => speichern('einkauf', s);

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
