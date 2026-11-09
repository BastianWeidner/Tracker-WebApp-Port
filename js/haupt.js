// Einstieg: Übersicht mit den Bereichen Training und Food & Boost (wie die Kachel-Übersicht der Dach-App).
import { render, useState, useEffect } from '../vendor/preact-htm.js';
import { Ziele, Format as FFormat } from './logik.js';
import * as T from './training-logik.js';
import { standLaden, trainingLaden, meta } from './speicher.js';
import { html, Page, Klein } from './teile.js';
import { FoodApp, InstallHinweis } from './app.js';
import { TrainingApp } from './training.js';
import { ProfilSeite, profilAbgleichen, profilKurz } from './profil.js';
import { profilGesetzt } from './logik.js';

const VERSION = '1.3.3';

const BEREICHE = {
  training: { titel: 'Training', symbol: '🏋️', farbe: '#C2185B', text: 'Workouts mit Sätzen und Gewichten, Fortschritt je Übung, Belastung je Muskelgruppe, Import aus Stronger.' },
  food: { titel: 'Food & Boost', symbol: '🍽️', farbe: '#E53935', text: 'Kalorien, Makros und Mikros, Supplements mit Einnahmeplan, Koffein und Alkohol.' },
};

const istIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const installiert = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function Haupt() {
  // Zuletzt geöffneter Bereich aus der Adresse (#training, #food), sonst die Übersicht.
  const [bereich, setBereich] = useState(() => (location.hash.slice(1) in BEREICHE ? location.hash.slice(1) : null));
  const [profil, setProfil] = useState(false);
  const [bereit, setBereit] = useState(false);
  useEffect(() => { profilAbgleichen().catch((e) => console.warn(e)).finally(() => setBereit(true)); }, []);

  useEffect(() => {
    document.documentElement.dataset.bereich = bereich || 'start';
    document.title = bereich ? `${BEREICHE[bereich].titel} · Gym` : 'Gym';
  }, [bereich]);

  const oeffnen = (b) => {
    history.pushState({ bereich: b }, '', '#' + b);
    setBereich(b);
  };
  const zurUebersicht = () => {
    history.replaceState(null, '', location.pathname + location.search);
    setBereich(null);
  };

  // Profil liegt über dem offenen Bereich; die Zurück-Geste schließt es.
  const profilOeffnen = () => { history.pushState({ profil: true }, ''); setProfil(true); };
  useEffect(() => {
    if (!profil) return undefined;
    const pop = (ev) => { ev.stopImmediatePropagation(); setProfil(false); };
    window.addEventListener('popstate', pop, { capture: true });
    return () => window.removeEventListener('popstate', pop, { capture: true });
  }, [profil]);

  if (!bereit) return html`<div class="laden">Lädt …</div>`;
  if (profil) return html`<${ProfilSeite} schliessen=${() => history.back()} />`;
  if (bereich === 'training') return html`<${TrainingApp} zurUebersicht=${zurUebersicht} profilOeffnen=${profilOeffnen} />`;
  if (bereich === 'food') return html`<${FoodApp} zurUebersicht=${zurUebersicht} profilOeffnen=${profilOeffnen} />`;
  return html`<${Uebersicht} oeffnen=${oeffnen} profilOeffnen=${profilOeffnen} />`;
}

function Uebersicht({ oeffnen, profilOeffnen }) {
  const [info, setInfo] = useState({});
  useEffect(() => {
    (async () => {
      const [f, t, letzte] = await Promise.all([standLaden(), trainingLaden(), meta('letzteSicherung')]);
      const jetzt = Date.now();
      const heute = new Date(jetzt).setHours(0, 0, 0, 0);
      const morgen = new Date(heute + 36 * 3_600_000).setHours(0, 0, 0, 0);
      const d = new Date(heute);
      const montag = d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const woche = t.workouts.filter((w) => w.start >= montag).length;
      const training = t.laufend
        ? `Training läuft seit ${Math.floor((jetzt - t.laufend.start) / 60_000)} min`
        : t.workouts.length ? `Diese Woche ${T.anzahl(woche, 'Training', 'Trainings')}` : 'Noch keine Trainings';
      let food = 'Noch nicht eingerichtet';
      if (f.eingerichtet) {
        const buch = T.Verbrauch.buch(t, f.koerper.gewichtKg, jetzt, 2).filter((w) => w.start >= heute && w.start < morgen);
        const ziel = Ziele.berechnen(f.koerper, f.einstellungen, new Date().getFullYear(), buch.reduce((a, w) => a + w.kcal, 0)).kcal;
        food = `Heute ${FFormat.zahl(Ziele.summe(f, heute, morgen).kcal, 0)} von ${FFormat.zahl(ziel, 0)} kcal`;
      }
      setInfo({ training, food, laeuft: !!t.laufend, letzte, leer: !t.workouts.length && !f.eintraege.length, profil: profilGesetzt(f) ? profilKurz(f.koerper) : null });
    })().catch((e) => console.warn(e));
  }, []);

  return html`
    <div class="app"><div class="bildschirm">
      <${Page} titel="Gym">
        ${Object.entries(BEREICHE).map(([id, b]) => html`
          <button class=${'kachel' + (id === 'training' && info.laeuft ? ' laeuft' : '')} style=${{ '--kachel': b.farbe }} onClick=${() => oeffnen(id)}>
            <span class="kachel-symbol" aria-hidden="true">${b.symbol}</span>
            <span class="kachel-text">
              <strong>${b.titel}</strong>
              <span class="klein">${b.text}</span>
              ${info[id] && html`<span class="kachel-stand">${info[id]}</span>`}
            </span>
          </button>`)}
        <button class="profil-zeile" onClick=${profilOeffnen}>
          <span class="profil-symbol" aria-hidden="true">👤</span>
          <span class="zeile-mitte"><strong>Profil</strong><span class="klein">${info.profil || 'Gewicht, Größe und Alter für Training und Food & Boost eintragen'}</span></span>
          <span aria-hidden="true">›</span>
        </button>
        <${Klein} leise>Alles bleibt auf diesem Gerät, es gibt kein Konto. Eine Sicherung beider Bereiche gibt es unter Training → Daten oder Food & Boost → Profil.${info.letzte ? ` Letzte Sicherung: ${new Date(info.letzte).toLocaleDateString('de-DE')}.` : ''}<//>
        ${istIOS() && !installiert() && html`<${InstallHinweis} />`}
        <${Klein} leise>Version ${VERSION}<//>
      <//>
    </div></div>`;
}

render(html`<${Haupt} />`, document.getElementById('app'));

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service Worker', e));
}
