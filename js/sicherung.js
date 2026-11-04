// Eine Sicherungsdatei für beide Bereiche. Ältere Dateien (nur Food & Boost) und Sicherungen der Android-Apps
// (Tracker-Stand bzw. krafttraining.json) lassen sich weiter laden.
import * as L from './logik.js';
import * as T from './training-logik.js';
import { standLaden, trainingLaden, standSpeichern, trainingSpeichern, alleSchreiben, meta } from './speicher.js';

export const FORMAT = 'gym-sicherung';

/** Inhalt einer Datei: { food, training }, jeweils ein Stand oder null. Wirft bei unbekannten Dateien. */
export function sicherungLesen(o) {
  if (o && o.format === FORMAT) {
    return { food: o.food ? L.standLesen(o.food) : null, training: o.training ? T.standLesen(o.training) : null };
  }
  if (T.istTrainingStand(o)) return { food: null, training: T.standLesen(o) };
  try {
    return { food: L.standLesen(o), training: null };
  } catch {
    throw new Error('Die Datei ist keine Sicherung dieser App, von Food & Boost oder vom Krafttraining.');
  }
}

export async function dateiLesen(datei) {
  return sicherungLesen(JSON.parse(await datei.text()));
}

/** Kurzbeschreibung für die Rückfrage vor dem Übernehmen. */
export function inhaltText(x) {
  const t = [];
  if (x.food) t.push(`Food & Boost mit ${T.anzahl(x.food.eintraege.length, 'Eintrag', 'Einträgen')} und ${T.anzahl(x.food.produkte.length, 'Produkt', 'Produkten')}`);
  if (x.training) t.push(`Training mit ${T.anzahl(x.training.workouts.length, 'Training', 'Trainings')}`);
  return t.join(' und ');
}

/** Übernimmt eine gelesene Sicherung in den Speicher. Der Bereich, der gerade offen ist, setzt seinen Stand selbst. */
export function uebernehmen(x) {
  if (x.food) standSpeichern({ ...x.food, eingerichtet: true });
  if (x.training) trainingSpeichern(x.training);
  return alleSchreiben();
}

/** Beide Stände als Datei teilen oder herunterladen. [food]/[training]: aktueller Stand des offenen Bereichs. */
export async function sicherungSpeichern({ food, training } = {}) {
  await alleSchreiben();
  const inhalt = { format: FORMAT, version: 1, erstellt: new Date().toISOString(), food: food || (await standLaden()), training: training || (await trainingLaden()) };
  const datum = new Date().toISOString().slice(0, 10);
  const name = `gym-sicherung-${datum}.json`;
  const datei = new File([JSON.stringify(inhalt)], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [datei] })) {
      await navigator.share({ files: [datei], title: 'Gym-Sicherung' });
      await meta('letzteSicherung', Date.now());
      return true;
    }
  } catch (e) {
    if (e.name === 'AbortError') return false;
  }
  const url = URL.createObjectURL(datei);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  await meta('letzteSicherung', Date.now());
  return true;
}
