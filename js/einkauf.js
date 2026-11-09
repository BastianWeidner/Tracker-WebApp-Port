// Oberfläche der Einkaufsliste (vereinfachter Port von features/einkauf/ui der Android-App): Schnelleingabe, Liste zum
// Abhaken und oben Vorschläge aus Food & Boost, gerundet auf übliche Gebinde (Palette, Kasten, 6er-Pack).
import { useState, useEffect, useRef, useMemo } from '../vendor/preact-htm.js';
import * as E from './einkauf-logik.js';
import { Nachkauf, Format } from './einkauf-logik.js';
import { einkaufLaden, einkaufSpeichern, standLaden } from './speicher.js';
import { sicherungSpeichern, dateiLesen, inhaltText, uebernehmen } from './sicherung.js';
import { html, Page, Abschnitt, Klein, Leer, Knopf, Schalter, Zaehler, Chip, Dialog } from './teile.js';

const TABS = [
  { id: 'start', titel: 'Start', symbol: '🏠' },
  { id: 'liste', titel: 'Liste', symbol: '🛒' },
  { id: 'mehr', titel: 'Mehr', symbol: '⚙' },
];

export function EinkaufApp({ zurUebersicht }) {
  const [d, setD] = useState(null);
  const [verbrauch, setVerbrauch] = useState([]);
  const [tab, setTab] = useState('liste');
  const [meldung, setMeldung] = useState(null);
  const [sicherung, setSicherung] = useState(null);
  const ref = useRef(null);

  const neuLesen = async () => {
    const [x, food] = await Promise.all([einkaufLaden(), standLaden()]);
    ref.current = x;
    setD(x);
    setVerbrauch(E.verbrauchAus(food, Date.now()));
  };
  useEffect(() => {
    neuLesen().catch((e) => console.warn(e));
    // Zurück in die App: Food & Boost kann inzwischen neue Einträge haben.
    const sicht = () => { if (document.visibilityState === 'visible') standLaden().then((f) => setVerbrauch(E.verbrauchAus(f, Date.now()))); };
    document.addEventListener('visibilitychange', sicht);
    return () => document.removeEventListener('visibilitychange', sicht);
  }, []);
  if (!d) return html`<div class="laden">Lädt …</div>`;

  const aendern = (f) => {
    try {
      const neu = f(ref.current);
      ref.current = neu;
      setD(neu);
      einkaufSpeichern(neu);
      return true;
    } catch (e) {
      setMeldung(e.message);
      return false;
    }
  };
  const vm = { d, verbrauch, aendern, meldung: setMeldung, sicherungAnbieten: setSicherung };

  return html`
    <div class="app">
      <div class="bildschirm">${tab === 'mehr' ? html`<${MehrSeite} vm=${vm} />` : html`<${ListeSeite} vm=${vm} />`}</div>
      <nav class="tabs">
        ${TABS.map((t) => html`<button class=${'tab' + (tab === t.id ? ' an' : '')} onClick=${() => (t.id === 'start' ? zurUebersicht() : setTab(t.id))}>
          <span class="tab-symbol">${t.symbol}</span><span>${t.titel}</span></button>`)}
      </nav>
      ${sicherung && html`<${Dialog} text=${`Sicherung übernehmen (${inhaltText(sicherung)})? Der jetzige Stand wird dabei ersetzt.`}
        jaText="Übernehmen" nein=${() => setSicherung(null)}
        ja=${async () => { await uebernehmen(sicherung); setSicherung(null); await neuLesen(); setMeldung('Sicherung übernommen.'); }} />`}
      ${meldung && html`<${Dialog} text=${meldung} ja=${() => setMeldung(null)} />`}
    </div>`;
}

function ListeSeite({ vm }) {
  const { d, verbrauch, aendern } = vm;
  const [text, setText] = useState('');
  const jetzt = Date.now();
  const vorschlaege = useMemo(() => Nachkauf.vorschlaege(d, verbrauch, jetzt), [d, verbrauch]);
  const tipps = E.tippVorschlaege(d, text);
  const offen = E.offen(d);
  const erledigt = d.eintraege.filter((e) => e.erledigt);
  const summe = offen.reduce((a, e) => a + (Format.gesamtCent(e) || 0), 0);

  const schnell = () => {
    const v = E.zeile(text);
    if (v && aendern((x) => E.hinzufuegen(x, E.ausVorlage(x, v), Date.now()))) setText('');
  };
  const teilen = async () => {
    const t = E.alsText(d);
    try {
      if (navigator.share) await navigator.share({ text: t, title: 'Einkaufsliste' });
      else { await navigator.clipboard.writeText(t); vm.meldung('Liste in die Zwischenablage kopiert.'); }
    } catch (e) { if (e.name !== 'AbortError') vm.meldung('Teilen ging nicht.'); }
  };

  return html`
    <${Page} titel="Einkaufsliste" aktionen=${html`
      <button class="knopf text" onClick=${teilen} disabled=${!offen.length}>Teilen</button>`}>
      <div class="schnell">
        <input type="text" value=${text} placeholder="z. B. 2x Milch 1,29" enterkeyhint="done"
          onInput=${(e) => setText(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') schnell(); }} />
        <button class="knopf rund gross-plus" onClick=${schnell} disabled=${!text.trim()} aria-label="Hinzufügen">+</button>
      </div>
      ${tipps.length > 0 && html`<div class="chips scroll">${tipps.map((p) => html`
        <${Chip} onClick=${() => { aendern((x) => E.hinzufuegen(x, E.ausVorlage(x, { name: p.name, menge: 1, einheit: 'STUECK', preisCent: null, groesse: '' }), Date.now())); setText(''); }}>${p.name}<//>`)}</div>`}

      ${vorschlaege.length > 0 && html`
        <h3 class="zwischen">Vorschläge aus Food & Boost</h3>
        ${vorschlaege.map((v) => html`<${NachkaufKarte} key=${v.schluessel} v=${v} aendern=${aendern} />`)}`}

      ${!offen.length && !erledigt.length && html`<${Leer}>Noch nichts auf der Liste. Oben eintippen, z. B. „2x Milch“, „500 g Hack“ oder „Butter 1,99“.<//>`}
      ${offen.length > 0 && html`
        <${Abschnitt} titel=${`Offen (${offen.length})` + (summe > 0 ? ` · ca. ${Format.euro(summe)}` : '')}>
          ${offen.map((e) => html`<${EintragZeile} key=${e.id} e=${e} aendern=${aendern} />`)}
        <//>`}
      ${erledigt.length > 0 && html`
        <${Abschnitt} titel="Erledigt">
          ${erledigt.map((e) => html`<${EintragZeile} key=${e.id} e=${e} aendern=${aendern} />`)}
          <${Knopf} art="umriss" onClick=${() => aendern(E.erledigteEntfernen)}>Erledigte entfernen<//>
        <//>`}
    <//>`;
}

function NachkaufKarte({ v, aendern }) {
  const [wahl, setWahl] = useState(v.empfohlen);
  const o = v.optionen[wahl] || v.optionen[v.empfohlen];
  // Das vorgewählte Gebinde sichtbar machen, auch wenn es rechts außerhalb der Chip-Reihe liegt.
  const reihe = useRef();
  useEffect(() => {
    const r = reihe.current, c = r?.querySelector('.chip.an');
    if (r && c) r.scrollLeft = Math.max(0, c.offsetLeft - r.offsetLeft - 16);
  }, []);
  return html`
    <section class="karte nachkauf">
      <div class="nachkauf-kopf">
        <div class="zeile-mitte">
          <strong>${v.name}</strong>
          <span class="klein leise">${Nachkauf.einheitText(v)} · ${Nachkauf.grundText(v)}</span>
        </div>
        <button class="knopf flach" onClick=${() => aendern((x) => Nachkauf.nehmen(x, v, o, Date.now()))}>+ Liste</button>
      </div>
      ${v.optionen.length > 1 && html`<div class="chips scroll" ref=${reihe}>${v.optionen.map((x, i) => html`
        <${Chip} an=${i === wahl} onClick=${() => setWahl(i)}>${Nachkauf.optionText(x)}${x.gebinde.stueck > 1 ? ` (${x.gebinde.stueck * x.anzahl})` : ''}<//>`)}</div>`}
      <div class="nachkauf-knoepfe">
        <button class="knopf text" onClick=${() => aendern((x) => Nachkauf.spaeter(x, v.schluessel, Date.now()))}>Später</button>
        <button class="knopf text" onClick=${() => aendern((x) => Nachkauf.nie(x, v.schluessel))}>Nicht mehr vorschlagen</button>
      </div>
    </section>`;
}

function EintragZeile({ e, aendern }) {
  const preis = Format.gesamtCent(e);
  return html`
    <div class=${'einkauf-zeile' + (e.erledigt ? ' erledigt' : '')}>
      <button class="haken" onClick=${() => aendern((x) => E.abhaken(x, e.id, !e.erledigt, Date.now()))} aria-label=${e.erledigt ? 'Nicht erledigt' : 'Abhaken'}>${e.erledigt ? '☑' : '☐'}</button>
      <span class="zeile-mitte"><span class="name">${Format.eintrag(e)}</span>${preis != null && html`<span class="klein leise">${Format.euro(preis)}</span>`}</span>
      ${!e.erledigt && html`
        <button class="knopf text eng" onClick=${() => aendern((x) => E.mengeSetzen(x, e.id, e.menge - 1))} disabled=${e.menge <= 1} aria-label="weniger">−</button>
        <button class="knopf text eng" onClick=${() => aendern((x) => E.mengeSetzen(x, e.id, e.menge + 1))} aria-label="mehr">+</button>`}
      <button class="knopf text eng" onClick=${() => aendern((x) => E.loeschen(x, e.id))} aria-label="Löschen">✕</button>
    </div>`;
}

function MehrSeite({ vm }) {
  const { d, aendern } = vm;
  const s = d.einstellungen;
  const setz = (o) => aendern((x) => ({ ...x, einstellungen: { ...x.einstellungen, ...o } }));
  const nie = Nachkauf.nieAnzahl(d);
  const datei = useRef();
  return html`
    <${Page} titel="Mehr">
      <${Abschnitt} titel="Vorschläge aus Food & Boost">
        <${Klein}>Was du in Food & Boost oft einträgst (mindestens 4-mal an 3 Tagen in 4 Wochen), erscheint oben auf der Liste, gerundet auf übliche Gebinde: Dosen als 6er-, 12er- oder 24er-Palette, Plastikflaschen im 6er- oder 9er-Pack, Bier im Kasten. Abgehakte Käufe zählen mit: Solange vom letzten Kauf noch genug da sein müsste, kommt kein Vorschlag. Supplements und Proteine haben ihren eigenen Vorrat unter Boost.<//>
        <${Schalter} label="Vorschläge zeigen" an=${s.nachkaufAktiv} onWechsel=${(an) => setz({ nachkaufAktiv: an })} />
        ${s.nachkaufAktiv && html`
          <${Zaehler} label="Menge reicht für" wert=${`${s.nachkaufTage} Tage`} minus=${() => setz({ nachkaufTage: s.nachkaufTage - 1 })} plus=${() => setz({ nachkaufTage: s.nachkaufTage + 1 })}
            minusAn=${s.nachkaufTage > 2} plusAn=${s.nachkaufTage < 30} />
          ${nie > 0 && html`<${Knopf} art="umriss" onClick=${() => aendern(Nachkauf.nieZuruecksetzen)}>${nie} ausgeblendete wieder vorschlagen<//>`}`}
      <//>
      <${Abschnitt} titel="Sicherung">
        <${Klein}>Die Sicherung enthält Training, Food & Boost und die Einkaufsliste in einer Datei. Eine Einkaufslisten-Sicherung der Android-App lässt sich auch laden.<//>
        <${Knopf} art="umriss" onClick=${() => sicherungSpeichern({ einkauf: d })}>Sicherung speichern<//>
        <${Knopf} art="umriss" onClick=${() => datei.current.click()}>Sicherung laden<//>
        <input ref=${datei} type="file" accept=".json,application/json" hidden onChange=${async (ev) => {
          const f = ev.target.files[0];
          ev.target.value = '';
          if (!f) return;
          try { vm.sicherungAnbieten(await dateiLesen(f)); } catch (e) { vm.meldung(e.message); }
        }} />
      <//>
      <${Klein} leise>Läden, Erinnerungen am Laden und der Barcode-Scan gibt es nur in der Android-App.<//>
    <//>`;
}
