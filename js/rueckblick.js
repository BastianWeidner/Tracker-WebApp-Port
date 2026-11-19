// Seite „Rückblick“ der Übersicht (wie WochenrueckblickScreen.kt): Woche bis Jahr, blätterbar, mit den Beiträgen
// von Training und Food & Boost. Rechnet nur mit den Daten auf dem Gerät.
import { useState, useEffect } from '../vendor/preact-htm.js';
import { standLaden, trainingLaden } from './speicher.js';
import { html, Page, Klein, Chips, Chip } from './teile.js';
import * as R from './rueckblick-logik.js';

export function RueckblickSeite({ schliessen }) {
  const [daten, setDaten] = useState(null);
  const [heute] = useState(() => R.tagVon(Date.now()));
  const [art, setArt] = useState('WOCHE');
  const [zurueck, setZurueck] = useState(() => R.anfang('WOCHE', heute));
  useEffect(() => { Promise.all([standLaden(), trainingLaden()]).then(([f, t]) => setDaten({ f, t })); }, []);

  const z = R.verschieben(R.zeitraumUm(art, heute), -zurueck);
  const b = daten ? R.beitraege(daten.f, daten.t, z, Date.now()) : null;
  const wahl = (a) => { if (a !== art) { setArt(a); setZurueck(R.anfang(a, heute)); } };

  return html`
    <div class="app"><div class="bildschirm">
      <${Page} titel="Rückblick" zurueck=${schliessen}>
        <${Chips}>${R.ARTEN.map((a) => html`<${Chip} an=${a === art} onClick=${() => wahl(a)}>${R.Art[a].titel}<//>`)}<//>
        <div class="rb-blaettern">
          <button class="rb-pfeil" onClick=${() => setZurueck(zurueck + 1)} disabled=${zurueck >= 520} aria-label=${`${R.Art[art].titel} davor`}>‹</button>
          <div class="rb-wann"><strong>${R.wann(art, zurueck)}</strong><span class="klein leise">${R.titel(z)}</span></div>
          <button class="rb-pfeil" onClick=${() => setZurueck(zurueck - 1)} disabled=${zurueck <= 0} aria-label=${`${R.Art[art].titel} danach`}>›</button>
        </div>
        ${b == null ? html`<div class="laden">Lädt …</div>`
          : !b.length ? html`<${Klein} leise>In diesem Zeitraum ist noch nichts eingetragen. Trainings, Essen und Supplements erscheinen hier, sobald du sie erfasst.<//>`
            : html`
              <section class="karte rb-kopf">
                <h2>${R.ueberschrift(b, art)}</h2>
                ${R.erfolge(b, art) && html`<strong>${R.erfolge(b, art)}</strong>`}
                <p>„${R.spruch(z)}“</p>
              </section>
              ${b.map((x) => html`<${Beitrag} b=${x} />`)}`}
        <${Klein} leise>Eine Erinnerung am Ende jedes Zeitraums gibt es nur in der Android-App. Hier schaust du einfach rein, wann du willst.<//>
      <//>
    </div></div>`;
}

function Beitrag({ b }) {
  return html`
    <section class="karte rb-abschnitt">
      <h2>${b.symbol} ${b.titel}</h2>
      ${b.kennzahlen.map((k) => html`<${Zahl} k=${k} />`)}
      ${b.lob.length > 0 && html`<div class="rb-lob">${b.lob.map((t) => html`<p>${t}</p>`)}</div>`}
      ${b.tipps.length > 0 && html`<div class="rb-tipps">${b.tipps.map((t) => html`<p class="klein leise">💡 ${t}</p>`)}</div>`}
    </section>`;
}

function Zahl({ k }) {
  const pfeil = k.trend === 1 ? ' ↑' : k.trend === -1 ? ' ↓' : '';
  return html`
    <div class="rb-zahl">
      <div class="balken-zeile"><span>${k.name}</span><strong class=${k.trend === 1 ? 'rb-gut' : k.trend === -1 ? 'rb-schlecht' : ''}>${k.wert}${pfeil}</strong></div>
      ${k.anteil != null && html`<div class="balken-bahn"><div class="balken-fuell" style=${{ width: Math.round(k.anteil * 100) + '%' }}></div></div>`}
      ${k.unter && html`<span class="klein leise rb-unter">${k.unter}</span>`}
    </div>`;
}
