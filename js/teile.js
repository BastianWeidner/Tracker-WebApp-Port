// Gemeinsame Bausteine der Oberfläche (wie core/module-api/Bausteine.kt in der Android-App).
import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { Format } from './logik.js';

export { html };

/** Bildschirm mit Kopfzeile, scrollbarem Inhalt und optional festen Knöpfen unten. */
export function Page({ titel, zurueck, aktionen, unten, children }) {
  return html`
    <div class="page">
      <header class="kopf">
        ${zurueck && html`<button class="kopf-zurueck" onClick=${zurueck} aria-label="Zurück">‹</button>`}
        <h1>${titel}</h1>
        <div class="kopf-aktionen">${aktionen}</div>
      </header>
      <main class="inhalt">${children}</main>
      ${unten && html`<footer class="unten">${unten}</footer>`}
    </div>`;
}

export const Abschnitt = ({ titel, children, klasse = '' }) => html`
  <section class=${'karte ' + klasse}>${titel && html`<h2>${titel}</h2>`}${children}</section>`;

export const Hinweis = ({ children, art = 'fehler' }) => html`<div class=${'hinweis ' + art}>${children}</div>`;

export const Klein = ({ children, leise }) => html`<p class=${'klein' + (leise ? ' leise' : '')}>${children}</p>`;

export const Leer = ({ children }) => html`<p class="leer">${children}</p>`;

export function Knopf({ onClick, children, art = 'gross', deaktiviert, klasse = '' }) {
  return html`<button class=${`knopf ${art} ${klasse}`} onClick=${onClick} disabled=${deaktiviert}>${children}</button>`;
}

/** Wert gegen Ziel. [obergrenze]: Überschreiten ist rot (Zucker, Salz …), sonst ist Erreichen gut. */
export function Balken({ name, wert, ziel, einheit, obergrenze, gross }) {
  const anteil = ziel > 0 ? wert / ziel : 0;
  const ueber = obergrenze && anteil > 1;
  return html`
    <div class=${'balken' + (gross ? ' gross' : '') + (ueber ? ' ueber' : '')}>
      <div class="balken-zeile"><span>${name}</span><span>${Format.wert(wert, wert < 10 ? 1 : 0)} / ${Format.wert(ziel, ziel < 10 ? 1 : 0)} ${einheit}</span></div>
      <div class="balken-bahn"><div class="balken-fuell" style=${{ width: Math.min(100, Math.max(0, anteil * 100)) + '%' }}></div></div>
    </div>`;
}

let feldNr = 0;
const neueId = () => 'f' + ++feldNr;

export function Eingabe({ label, wert, onInput, hilfe, mehrzeilig, pflicht, platzhalter, autofocus }) {
  const [id] = useState(neueId);
  const leer = pflicht && !String(wert || '').trim();
  const ref = useRef();
  useEffect(() => { if (autofocus) ref.current?.focus(); }, []);
  return html`
    <label class=${'feld' + (leer ? ' pflicht-leer' : '')} for=${id}>
      <span class="feld-label">${label}${pflicht ? ' *' : ''}</span>
      ${mehrzeilig
        ? html`<textarea id=${id} ref=${ref} rows="6" value=${wert} placeholder=${platzhalter} onInput=${(e) => onInput(e.target.value)}></textarea>`
        : html`<input id=${id} ref=${ref} type="text" value=${wert} placeholder=${platzhalter} onInput=${(e) => onInput(e.target.value)} />`}
      ${hilfe && html`<span class="feld-hilfe">${hilfe}</span>`}
    </label>`;
}

/** Zahl mit Komma oder Punkt; leer = 0. Der Text bleibt beim Tippen stehen, gemeldet wird die Zahl. */
export function ZahlFeld({ label, wert, onWert, hilfe, klasse = '' }) {
  const [id] = useState(neueId);
  const zeigen = (w) => (w ? Format.zahl(w, 6) : '');
  const [text, setText] = useState(zeigen(wert));
  const zuletzt = useRef(wert);
  useEffect(() => {
    if (wert !== zuletzt.current) { setText(zeigen(wert)); zuletzt.current = wert; }
  }, [wert]);
  const falsch = text.trim() !== '' && Format.parse(text) == null;
  return html`
    <label class=${'feld ' + klasse + (falsch ? ' falsch' : '')} for=${id}>
      <span class="feld-label">${label}</span>
      <input id=${id} type="text" inputmode="decimal" value=${text} onInput=${(e) => {
        const t = e.target.value;
        setText(t);
        const v = t.trim() === '' ? 0 : Format.parse(t);
        if (v != null) { zuletzt.current = v; onWert(v); }
      }} />
      ${(falsch || hilfe) && html`<span class="feld-hilfe">${falsch ? 'Keine Zahl' : hilfe}</span>`}
    </label>`;
}

export function Auswahl({ label, optionen, wert, text, onWahl }) {
  const [id] = useState(neueId);
  const i = optionen.indexOf(wert);
  return html`
    <label class="feld" for=${id}>
      <span class="feld-label">${label}</span>
      <select id=${id} value=${String(i)} onChange=${(e) => onWahl(optionen[+e.target.value])}>
        ${optionen.map((o, j) => html`<option value=${String(j)}>${text(o)}</option>`)}
      </select>
    </label>`;
}

export function Schalter({ label, an, onWechsel, hilfe }) {
  return html`
    <label class="schalter">
      <span class="schalter-text"><span>${label}</span>${hilfe && html`<span class="feld-hilfe">${hilfe}</span>`}</span>
      <input type="checkbox" role="switch" checked=${an} onChange=${(e) => onWechsel(e.target.checked)} />
      <span class="schalter-bahn" aria-hidden="true"></span>
    </label>`;
}

export function Zaehler({ label, wert, minus, plus, minusAn, plusAn }) {
  return html`
    <div class="zaehler">
      <span>${label}</span>
      <button class="rund" onClick=${minus} disabled=${!minusAn} aria-label="weniger">−</button>
      <span class="zaehler-wert">${wert}</span>
      <button class="rund" onClick=${plus} disabled=${!plusAn} aria-label="mehr">+</button>
    </div>`;
}

export const Chips = ({ children }) => html`<div class="chips">${children}</div>`;
export const Chip = ({ onClick, children, an }) => html`<button class=${'chip' + (an ? ' an' : '')} onClick=${onClick}>${children}</button>`;

export function Dialog({ text, ja, nein, jaText = 'OK', neinText = 'Abbrechen', children }) {
  return html`
    <div class="dialog-hintergrund" onClick=${(e) => e.target === e.currentTarget && (nein || ja)()}>
      <div class="dialog" role="dialog" aria-modal="true">
        ${text && html`<p>${text}</p>`}
        ${children}
        <div class="dialog-knoepfe">
          ${nein && html`<button class="knopf text" onClick=${nein}>${neinText}</button>`}
          ${ja && html`<button class="knopf text stark" onClick=${ja}>${jaText}</button>`}
        </div>
      </div>
    </div>`;
}
