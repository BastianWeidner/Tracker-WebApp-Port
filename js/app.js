// Oberfläche von „Food & Boost“ als Web-App. Aufbau wie in der Android-App (TrackerSubApp, *Screen.kt):
// Tabs Pegel/Koffein, Essen, Boost, Produkte, Profil und darüber ein Stapel von Ansichten (Eintragen, Produkt, Scan …).
import { useState, useEffect, useMemo, useRef } from '../vendor/preact-htm.js';
import * as L from './logik.js';
import { Boost, Format, Kategorie, KATEGORIEN, Mikros, Pegel, S, Wirkstoffe, Zeitpunkt, ZEITPUNKTE, Ziele, Zeitachse, MINUTE, STUNDE } from './logik.js';
import { standLaden, standSpeichern, trainingLaden, meta, dauerhaftBitten } from './speicher.js';
import * as T from './training-logik.js';
import { sicherungSpeichern as dateiSichern, dateiLesen, inhaltText, uebernehmen as sicherungInDenSpeicher } from './sicherung.js';
import { dbSuchen, dbInfo, lebensmittel, dbNamenSuchen } from './daten.js';
import * as Scan from './scan.js';
import { profilKurz } from './profil.js';
import { html, Page, Abschnitt, Hinweis, Klein, Leer, Knopf, Balken, Eingabe, ZahlFeld, Auswahl, Schalter, Zaehler, Chips, Chip, Dialog } from './teile.js';

const VERSION = '1.6.1';

// ---------- Zeit ----------

const tagBeginn = (ms) => new Date(ms).setHours(0, 0, 0, 0);
const tagPlus = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.setHours(0, 0, 0, 0); };
const heute = () => tagBeginn(Date.now());
const mittag = (t) => new Date(t).setHours(12, 0, 0, 0);
const zwei = (n) => String(n).padStart(2, '0');
const hhmm = (t) => { const d = new Date(t); return `${zwei(d.getHours())}:${zwei(d.getMinutes())}`; };
const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function uhr(t, jetzt = Date.now()) {
  const tag = tagBeginn(t), h = tagBeginn(jetzt);
  const d = new Date(t);
  const zusatz = tag === h ? '' : tag === tagPlus(h, 1) ? ' (morgen)' : tag === tagPlus(h, -1) ? ' (gestern)' : ` (${d.getDate()}.${d.getMonth() + 1}.)`;
  return hhmm(t) + zusatz;
}
function dauer(ms) {
  const min = Math.max(0, Math.floor(ms / MINUTE));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${zwei(min % 60)} min`;
}
function tagText(t) {
  if (t === heute()) return 'Heute';
  if (t === tagPlus(heute(), -1)) return 'Gestern';
  const d = new Date(t);
  return `${TAGE[d.getDay()]}, ${d.getDate()}. ${MONATE[d.getMonth()]}`;
}
const neueId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)).replace(/-/g, '').slice(0, 12);
const istIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const installiert = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// ---------- App ----------

const TABS = [
  { id: 'start', titel: 'Start', symbol: '🏠' },
  { id: 'pegel', titel: 'Pegel', symbol: '🍺' },
  { id: 'essen', titel: 'Essen', symbol: '🍽️' },
  { id: 'boost', titel: 'Boost', symbol: '💊' },
  { id: 'produkte', titel: 'Produkte', symbol: '📦' },
  { id: 'profil', titel: 'Profil', symbol: '⚙️' },
];

export function FoodApp({ zurUebersicht, profilOeffnen }) {
  const [stand, setStand] = useState(null);
  const [ui, setUi] = useState({ tab: 'pegel', stapel: [], tag: heute(), jetzt: Date.now(), letzter: null, meldung: null, sicherung: null, mahlzeit: null, scanEan: null });
  const [letzteSicherung, setLetzteSicherung] = useState(null);
  const [trainings, setTrainings] = useState([]);
  const standRef = useRef(null);
  const uiRef = useRef(ui);
  uiRef.current = ui;
  standRef.current = stand;

  useEffect(() => {
    standLaden().then((st) => {
      setStand(st);
      // Trainings aus dem Bereich Training (wie das Trainingsbuch der Android-App) für das Tagesziel.
      trainingLaden().then((t) => setTrainings(T.Verbrauch.buch(t, st.koerper.gewichtKg))).catch(() => {});
    });
    meta('letzteSicherung').then((v) => setLetzteSicherung(v || null));
    const vorladen = setTimeout(() => Scan.vorladen(), 3000);
    const t = setInterval(() => setUi((u) => ({ ...u, jetzt: Date.now() })), 30_000);
    const sichtbar = () => document.visibilityState === 'visible' && setUi((u) => ({ ...u, jetzt: Date.now() }));
    document.addEventListener('visibilitychange', sichtbar);
    // Zurück-Geste des Browsers bzw. Android schließt die oberste Ansicht.
    const pop = () => { if (uiRef.current.stapel.length) setUi((u) => ({ ...u, stapel: u.stapel.slice(0, -1) })); else zurUebersicht(); };
    window.addEventListener('popstate', pop);
    return () => { clearTimeout(vorladen); clearInterval(t); document.removeEventListener('visibilitychange', sichtbar); window.removeEventListener('popstate', pop); };
  }, []);

  if (!stand) return html`<div class="laden">Lädt …</div>`;

  const aendern = (f) => {
    const neu = f(standRef.current);
    standRef.current = neu;
    setStand(neu);
    standSpeichern(neu);
  };
  const upd = (f) => setUi((u) => ({ ...u, ...f(u) }));
  const s = stand;
  const ansicht = ui.stapel[ui.stapel.length - 1] || null;

  const vm = {
    s, ui, ansicht, trainings, profilOeffnen,
    tab: (tab) => (tab === 'start' ? zurUebersicht() : upd(() => ({ tab, stapel: [] }))),
    oeffnen: (a) => { history.pushState({ n: uiRef.current.stapel.length + 1 }, ''); upd((u) => ({ stapel: [...u.stapel, a] })); },
    ersetzen: (a) => upd((u) => ({ stapel: [...u.stapel.slice(0, -1), a] })),
    zurueck: () => upd((u) => ({ stapel: u.stapel.slice(0, -1) })),
    fertig: () => upd(() => ({ stapel: [] })),
    tag: (t) => upd(() => ({ tag: t })),
    meldung: (text) => upd(() => ({ meldung: text })),
    aendern,

    schnell(p) {
      const e = L.eintragAus(p, neueId(), Date.now(), p.portion);
      aendern((x) => S.eintragen(x, e));
      upd(() => ({ letzter: e, jetzt: Date.now() }));
    },
    planEinnehmen(p) {
      const zeit = uiRef.current.tag === heute() ? Date.now() : mittag(uiRef.current.tag);
      const e = L.eintragAus(p, neueId(), zeit, L.einnahme(p));
      aendern((x) => S.eintragen(x, e));
      upd(() => ({ letzter: e, jetzt: Date.now() }));
    },
    eintragen(p, menge, zeit, mitEssen) {
      const e = L.eintragAus(p, neueId(), zeit, menge, mitEssen);
      aendern((x) => S.eintragen(x, e));
      upd(() => ({ letzter: e, jetzt: Date.now(), stapel: [] }));
    },
    eintragAendern(e, menge, zeit, mitEssen) {
      aendern((x) => S.eintragAendern(x, L.eintragAendern(e, menge, zeit, mitEssen)));
      upd(() => ({ stapel: [] }));
    },
    eintragLoeschen(id) {
      aendern((x) => S.eintragLoeschen(x, id));
      upd((u) => ({ stapel: [], letzter: u.letzter?.id === id ? null : u.letzter }));
    },
    rueckgaengig() {
      const e = uiRef.current.letzter;
      if (e) aendern((x) => S.eintragLoeschen(x, e.id));
      upd(() => ({ letzter: null }));
    },
    produktSpeichern(p, danachEintragen) {
      const mitId = p.id ? p : { ...p, id: neueId() };
      const [neu, n] = S.speichernMitEintraegen(standRef.current, mitId, heute());
      aendern(() => neu);
      if (danachEintragen) vm.ersetzen({ typ: 'eintragen', produktId: mitId.id }); else vm.zurueck();
      if (n > 0) vm.meldung(n === 1 ? 'Der heutige Eintrag wurde mit angepasst.' : `${n} heutige Einträge wurden mit angepasst.`);
    },
    favorit: (p) => aendern((x) => S.speichern(x, { ...p, favorit: !p.favorit })),
    produktLoeschen(id) { aendern((x) => S.produktLoeschen(x, id)); vm.zurueck(); },
    koerper: (f) => aendern((x) => ({ ...x, koerper: f(x.koerper) })),
    einstellungen: (f) => aendern((x) => ({ ...x, einstellungen: f(x.einstellungen) })),
    einrichten(k) { aendern((x) => ({ ...x, koerper: k, eingerichtet: true })); dauerhaftBitten(); },
    sicherungGespeichert() { const t = Date.now(); meta('letzteSicherung', t); setLetzteSicherung(t); },
    letzteSicherung,
    setMahlzeit: (m) => upd((u) => ({ mahlzeit: typeof m === 'function' ? m(u.mahlzeit) : m })),
    sicherungAnbieten: (st) => upd(() => ({ sicherung: st })),
    async sicherungUebernehmen(x) {
      upd(() => ({ sicherung: null }));
      await sicherungInDenSpeicher(x);
      if (x.food) aendern(() => ({ ...x.food, eingerichtet: true }));
      if (x.training) setTrainings(T.Verbrauch.buch(x.training, (x.food || standRef.current).koerper.gewichtKg));
      upd(() => ({ meldung: x.food ? 'Sicherung übernommen.' : 'Trainings übernommen. Food & Boost bleibt, wie es war.' }));
    },
    letzterWeg: () => upd(() => ({ letzter: null })),
    /** Scan schließen; liegt darunter das Formular, aus dem gescannt wurde, wird es durch [a] ersetzt. */
    zumFormular: (a) => upd((u) => {
      const ohne = u.stapel.slice(0, -1);
      return { stapel: [...(ohne[ohne.length - 1]?.typ === 'produkt' ? ohne.slice(0, -1) : ohne), a] };
    }),
    // Einnahmeplan selbst bauen (wie PlanScreen.kt)
    planEntfernen: (p, z) => aendern((x) => {
      const q = S.produkt(x, p.id);
      if (!q) return x;
      const i = q.plan.indexOf(z);
      return S.speichern(x, { ...q, plan: q.plan.filter((_, j) => j !== i) });
    }),
    planHinzufuegen(p, z) {
      aendern((x) => { const q = S.produkt(x, p.id); return q ? S.speichern(x, { ...q, plan: [...q.plan, z] }) : x; });
      vm.zurueck();
    },
    /** Aus einer Vorlage ein eigenes Produkt um [z] anlegen und gleich zum Anpassen öffnen. */
    vorlageAnlegen(v, z) {
      const neu = { ...L.produkt(v), id: neueId(), plan: [z] };
      aendern((x) => S.speichern(x, neu));
      vm.ersetzen({ typ: 'produkt', id: neu.id, schluessel: neueId() });
    },
    planNeu: (z) => vm.ersetzen({ typ: 'produkt', id: null, schluessel: neueId(), vorlage: L.produkt({ kategorie: 'SUPPLEMENT', plan: [z] }) }),
    vorlageUebernehmen(v) {
      const p = { ...L.produkt(v.produkt), id: neueId(), vorlage: v.produkt.id };
      aendern((x) => S.speichern(x, p));
      return p;
    },
  };

  if (!s.eingerichtet) return html`<${Willkommen} vm=${vm} />`;

  return html`
    <div class="app">
      <div class="bildschirm">${bildschirm(vm, ansicht)}</div>
      ${!ansicht && html`
        <nav class="tabs">
          ${TABS.map((t) => {
            const koffein = t.id === 'pegel' && !alkoholAktiv(s, ui.jetzt);
            return html`<button class=${'tab' + (ui.tab === t.id ? ' an' : '')} onClick=${() => vm.tab(t.id)}>
              <span class="tab-symbol">${koffein ? '⚡' : t.symbol}</span><span>${koffein ? 'Koffein' : t.titel}</span></button>`;
          })}
        </nav>`}
      ${ui.sicherung && html`<${Dialog}
        text=${`Sicherung übernehmen (${inhaltText(ui.sicherung)})? Der jetzige Stand wird dabei ersetzt.`}
        jaText="Übernehmen" ja=${() => vm.sicherungUebernehmen(ui.sicherung)}
        nein=${() => upd(() => ({ sicherung: null }))} />`}
      ${ui.meldung && html`<${Dialog} text=${ui.meldung} ja=${() => upd(() => ({ meldung: null }))} />`}
    </div>`;
}

const alkoholAktiv = (s, jetzt) => s.eintraege.some((e) => e.alkoholG > 0 && e.zeit >= jetzt - 24 * STUNDE);

function bildschirm(vm, a) {
  if (!a) {
    switch (vm.ui.tab) {
      case 'essen': return html`<${EssenTab} vm=${vm} />`;
      case 'boost': return html`<${BoostTab} vm=${vm} />`;
      case 'produkte': return html`<${ProdukteTab} vm=${vm} auswahl=${false} />`;
      case 'profil': return html`<${ProfilTab} vm=${vm} />`;
      default: return html`<${PegelTab} vm=${vm} />`;
    }
  }
  switch (a.typ) {
    case 'eintragen':
    case 'eintragBearbeiten': return html`<${EintragenScreen} key=${JSON.stringify(a)} vm=${vm} a=${a} />`;
    case 'produkt': return html`<${ProduktScreen} key=${a.schluessel || a.id || 'neu'} vm=${vm} a=${a} />`;
    case 'auswahl': return html`<${ProdukteTab} vm=${vm} auswahl=${true} />`;
    case 'scan': return html`<${ScanScreen} key=${a.schluessel || 'scan'} vm=${vm} a=${a} />`;
    case 'mahlzeitStart': return html`<${MahlzeitStart} vm=${vm} a=${a} />`;
    case 'mahlzeitPruefen': return html`<${MahlzeitPruefen} vm=${vm} />`;
    case 'vorlagen': return html`<${VorlagenScreen} vm=${vm} a=${a} />`;
    case 'planBearbeiten': return html`<${PlanBearbeitenScreen} vm=${vm} />`;
    case 'planHinzufuegen': return html`<${PlanHinzufuegenScreen} vm=${vm} a=${a} />`;
    default: return null;
  }
}

// ---------- Willkommen ----------

function Willkommen({ vm }) {
  const [k, setK] = useState(vm.s.koerper);
  const jahr = new Date().getFullYear();
  return html`
    <div class="app"><div class="bildschirm">
    <${Page} titel="Food & Boost" unten=${html`<${Knopf} onClick=${() => vm.einrichten(k)}>Los geht's<//>`}>
      <${Abschnitt}>
        <p>Kalorien, Makros und Mikros, Supplements mit Einnahmeplan und Vorrat sowie Koffein und Alkohol mit geschätztem Abbau.</p>
        <p><strong>Alles bleibt auf deinem Handy.</strong> Es gibt kein Konto, und nichts wird ins Internet geschickt. Die App funktioniert auch offline.</p>
      <//>
      <${Abschnitt} titel="Deine Körperdaten">
        <${Klein}>Damit rechnet die App Tagesziele und die Alkohol-Schätzung. Sie gelten auch fürs Training und sind später unter „Profil“ änderbar.<//>
        <${ZahlFeld} label="Gewicht (kg)" wert=${k.gewichtKg} onWert=${(v) => setK({ ...k, gewichtKg: v })} />
        <${ZahlFeld} label="Größe (cm)" wert=${k.groesseCm} onWert=${(v) => setK({ ...k, groesseCm: v })} />
        <${ZahlFeld} label="Geburtsjahr" wert=${k.geburtsjahr} onWert=${(v) => setK({ ...k, geburtsjahr: Math.round(v) })} hilfe=${`Alter: ${Pegel.alter(k, jahr)}`} />
        <${Auswahl} label="Geschlecht" optionen=${['MANN', 'FRAU']} wert=${k.geschlecht} text=${(g) => L.Geschlecht[g]} onWahl=${(g) => setK({ ...k, geschlecht: g })} />
      <//>
      <${Abschnitt} titel="Schon benutzt?">
        <${Klein}>Eine Sicherungsdatei (auch aus der Android-App) lässt sich hier oder später unter „Profil“ laden.<//>
        <${SicherungLaden} vm=${vm} />
      <//>
      ${istIOS() && !installiert() && html`<${InstallHinweis} />`}
    <//>
    </div>
    ${vm.ui.sicherung && html`<${Dialog} text=${`Sicherung übernehmen (${inhaltText(vm.ui.sicherung)})?`}
      jaText="Übernehmen" ja=${() => { vm.sicherungUebernehmen(vm.ui.sicherung); dauerhaftBitten(); }}
      nein=${() => vm.sicherungAnbieten(null)} />`}
    ${vm.ui.meldung && html`<${Dialog} text=${vm.ui.meldung} ja=${() => vm.meldung(null)} />`}
    </div>`;
}

export const InstallHinweis = () => html`
  <${Hinweis} art="info">
    <strong>Als App installieren:</strong> In Safari unten auf <span class="teilen">Teilen</span> tippen, dann „Zum Home-Bildschirm“.
    Danach startet die App wie eine App, auch ohne Internet, und Safari löscht die Daten nicht so schnell.
  <//>`;

// ---------- Pegel ----------

function SchaetzHinweis() {
  return html`<${Hinweis}>⚠ Nur Schätzwerte. Der echte Pegel kann deutlich höher liegen. Nicht geeignet, um zu entscheiden, ob du fahren darfst. Im Zweifel: nicht fahren.<//>`;
}

function PegelTab({ vm }) {
  const { s, ui } = vm;
  const jetzt = ui.jetzt;
  const minute = Math.floor(jetzt / MINUTE) * MINUTE;
  const jahr = new Date().getFullYear();
  const lage = useMemo(() => Pegel.lage(s, minute, jahr), [s, minute]);
  const von = minute - 6 * STUNDE, bis = minute + 12 * STUNDE;
  const alkKurve = useMemo(() => Pegel.alkoholVerlauf(s, von, bis, jahr, 5 * MINUTE), [s, minute]);
  const kofKurve = useMemo(() => Pegel.koffeinVerlauf(s, von, bis, 5 * MINUTE), [s, minute]);
  const h = heute();
  const koffeinHeute = Pegel.koffeinSumme(s, h, tagPlus(h, 1));
  const favoriten = s.produkte.filter((p) => p.favorit);
  const letzte = s.eintraege.filter((e) => (e.alkoholG > 0 || e.koffeinMg > 0) && e.zeit >= jetzt - 24 * STUNDE).reverse();
  const alkohol = alkoholAktiv(s, jetzt);
  const ein = s.einstellungen;

  return html`
    <${Page} titel=${alkohol ? 'Pegel' : 'Koffein'}>
      ${istIOS() && !installiert() && html`<${InstallHinweis} />`}
      ${alkohol && html`<${SchaetzHinweis} />`}
      ${ui.letzter && html`
        <div class="karte zuletzt"><span>✓ ${ui.letzter.name} eingetragen</span>
          <button class="knopf text" onClick=${vm.rueckgaengig}>Rückgängig</button>
          <button class="knopf text" aria-label="Schließen" onClick=${vm.letzterWeg}>✕</button></div>`}
      ${alkohol && html`
        <${Abschnitt} titel="Alkohol">
          <div class="riesig">${Format.promille(lage.promille)}</div>
          ${lage.promilleSpitze > lage.promille + 0.005 && html`<p>Steigt noch auf etwa ${Format.promille(lage.promilleSpitze)} um ${uhr(lage.promilleSpitzeUm, jetzt)}.</p>`}
          <p>${lage.nuechternUm == null ? 'Kein Alkohol im Blut (geschätzt).' : `0,0 ‰ etwa ab ${uhr(lage.nuechternUm, jetzt)} (in ${dauer(lage.nuechternUm - jetzt)}).`}</p>
          ${alkKurve.some((p) => p.wert > 0) && html`<${Kurve} punkte=${alkKurve} jetzt=${minute} farbe="var(--primary)" text=${Format.promille} />`}
        <//>`}
      <${Abschnitt} titel="Koffein">
        <div class="gross-wert">${Format.zahl(lage.koffeinMg, 0)} mg im Körper</div>
        ${lage.koffeinSpitzeMg > lage.koffeinMg + 2 && html`<p>Steigt noch auf etwa ${Format.zahl(lage.koffeinSpitzeMg, 0)} mg um ${uhr(lage.koffeinSpitzeUm, jetzt)}.</p>`}
        ${lage.schlafgrenzeUm != null && html`<p>Unter ${Format.zahl(ein.koffeinSchlafgrenzeMg, 0)} mg (Schlaf) etwa ab ${uhr(lage.schlafgrenzeUm, jetzt)}.</p>`}
        <p class=${koffeinHeute > ein.koffeinTageslimitMg ? 'rot' : ''}>Heute getrunken: ${Format.zahl(koffeinHeute, 0)} von ${Format.zahl(ein.koffeinTageslimitMg, 0)} mg${koffeinHeute > ein.koffeinTageslimitMg ? ' – über der Empfehlung' : ''}</p>
        ${kofKurve.some((p) => p.wert > 1) && html`<${Kurve} punkte=${kofKurve} jetzt=${minute} farbe="var(--tertiary)" text=${(v) => Format.zahl(v, 0) + ' mg'} />`}
      <//>
      <${Abschnitt} titel="Schnell eintragen (jetzt, eine Portion)">
        ${!favoriten.length && html`<${Klein}>Unter „Produkte“ mit ★ Favoriten wählen.<//>`}
        <${Chips}>${favoriten.map((p) => html`<${Chip} onClick=${() => vm.schnell(p)}>${p.name}<//>`)}<//>
        <${Knopf} art="umriss" onClick=${() => vm.oeffnen({ typ: 'auswahl' })}>Anderes Getränk oder Uhrzeit …<//>
      <//>
      ${letzte.length > 0 && html`<h3 class="zwischen">Letzte 24 Stunden</h3>${letzte.map((e) => html`<${EintragZeile} key=${e.id} e=${e} jetzt=${jetzt} onClick=${() => vm.oeffnen({ typ: 'eintragBearbeiten', id: e.id })} />`)}`}
      <${Klein} leise>
        ${alkohol ? `Alkohol nach Widmark mit Körperwasser (${L.WasserMethode[ein.wasserMethode]}), Abbau ${Format.zahl(ein.abbauPromilleProH, 2)} ‰/h. ` : 'Schätzwerte. Alkohol und Promille erscheinen hier, sobald du ein alkoholisches Getränk einträgst. '}
        Koffein mit Halbwertszeit ${Format.zahl(ein.koffeinHalbwertszeitH)} h. Einstellbar unter „Profil“.
      <//>
    <//>`;
}

function EintragZeile({ e, jetzt, onClick }) {
  const teile = [`${Format.zahl(e.menge, 0)} ${e.fluessig ? 'ml' : 'g'}`];
  if (e.alkoholG > 0) teile.push(`${Format.zahl(e.alkoholG)} g Alkohol`);
  if (e.koffeinMg > 0) teile.push(`${Format.zahl(e.koffeinMg, 0)} mg Koffein`);
  if (e.mitEssen) teile.push('mit Essen');
  return html`
    <button class="karte zeile" onClick=${onClick}>
      <span class="zeile-zeit">${uhr(e.zeit, jetzt).slice(0, 5)}</span>
      <span class="zeile-mitte"><span>${e.name}</span><span class="klein">${teile.join(' · ')}</span></span>
      <span>${Format.zahl(e.naehrwerte.kcal, 0)} kcal</span>
    </button>`;
}

/** Verlauf von −6 h bis +12 h, Raster alle 30 min, Uhrzeiten alle 3 h. Antippen oder Wischen zeigt Uhrzeit und Wert. */
function Kurve({ punkte, jetzt, farbe, text }) {
  const [gewaehlt, setGewaehlt] = useState(null);
  const W = 340, H = 150, U = 16;
  const max = Math.max(1e-6, ...punkte.map((p) => p.wert));
  const von = punkte[0].zeit, bis = punkte[punkte.length - 1].zeit;
  const x = (t) => ((t - von) / (bis - von)) * W;
  const y = (v) => H - (v / max) * (H - 6) - 2;
  const maxP = punkte.reduce((m, p) => (p.wert > m.wert ? p : m), punkte[0]);
  const marken = Zeitachse.marken(von, bis);
  const pfad = punkte.map((p, i) => `${i ? 'L' : 'M'}${x(p.zeit).toFixed(1)},${y(p.wert).toFixed(1)}`).join('');
  const zeitAus = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    return Zeitachse.einrasten(von + Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)) * (bis - von), von, bis);
  };
  const g = gewaehlt;
  return html`
    <div class="kurve">
      <div class=${'kurve-text' + (g ? ' an' : '')} style=${g ? { color: farbe } : {}}>
        ${g == null ? `höchstens ${text(max)} (${uhr(maxP.zeit, jetzt)}) · antippen für Uhrzeit` : `${uhr(g, jetzt)}: ${text(Zeitachse.wert(punkte, g))}`}
      </div>
      <svg viewBox=${`0 0 ${W} ${H + U}`} role="img" aria-label=${`Verlauf, höchster Wert ${text(max)} um ${uhr(maxP.zeit, jetzt)}`}
        onPointerDown=${(e) => { const t = zeitAus(e); setGewaehlt(g === t ? null : t); e.currentTarget.setPointerCapture?.(e.pointerId); }}
        onPointerMove=${(e) => e.buttons && setGewaehlt(zeitAus(e))}>
        ${marken.map((m) => {
          const gross = Zeitachse.beschriftet(m, 3);
          return html`<g>
            <line x1=${x(m)} x2=${x(m)} y1="0" y2=${H} class=${gross ? 'gitter stark' : 'gitter'} />
            ${gross && html`<text x=${Math.min(W - 14, Math.max(14, x(m)))} y=${H + 12} class="achse" text-anchor="middle">${hhmm(m)}</text>`}
          </g>`;
        })}
        ${[0, max / 2, max].map((v) => html`<g><line x1="0" x2=${W} y1=${y(v)} y2=${y(v)} class="gitter" />
          ${v > 0 && html`<text x="2" y=${Math.max(9, y(v) - 2)} class="achse">${text(v)}</text>`}</g>`)}
        <line x1=${x(jetzt)} x2=${x(jetzt)} y1="0" y2=${H} class="jetzt" />
        <path d=${pfad} fill="none" stroke=${farbe} stroke-width="2" stroke-linejoin="round" />
        <circle cx=${x(jetzt)} cy=${y(Zeitachse.wert(punkte, jetzt))} r="4" fill=${farbe} />
        ${g != null && html`<g>
          <line x1=${x(g)} x2=${x(g)} y1="0" y2=${H} stroke=${farbe} stroke-width="1.5" />
          <circle cx=${x(g)} cy=${y(Zeitachse.wert(punkte, g))} r="6" fill="var(--background)" stroke=${farbe} stroke-width="2.5" />
        </g>`}
      </svg>
    </div>`;
}

// ---------- Essen ----------

function EssenTab({ vm }) {
  const { s, ui } = vm;
  const von = ui.tag, bis = tagPlus(ui.tag, 1);
  const summe = useMemo(() => Ziele.summe(s, von, bis), [s, von]);
  const jahr = new Date().getFullYear();
  const trainings = vm.trainings.filter((t) => t.start >= von && t.start < bis);
  const trainingKcal = trainings.reduce((a, t) => a + t.kcal, 0);
  const ziele = Ziele.berechnen(s.koerper, s.einstellungen, jahr, trainingKcal);
  const eintraege = S.eintraege(s, von, bis);
  const alkohol = eintraege.reduce((a, e) => a + e.alkoholG, 0);
  const koffein = eintraege.reduce((a, e) => a + e.koffeinMg, 0);
  const [alleMikros, setAlleMikros] = useState(false);
  const boost = eintraege.filter((e) => L.istBoost(e.kategorie));
  const [getrunken, trinkZiel] = Ziele.trinken(eintraege, s.koerper, s.einstellungen, trainings.length > 0);
  const verteilung = Ziele.eiweissVerteilung(eintraege, s.koerper, (ms) => new Date(ms).getHours());
  const auffaellig = Mikros.auffaellig(eintraege, s.koerper.geschlecht);
  const g = s.koerper.geschlecht;
  const mitWert = Mikros.sortiert(Mikros.alle.filter((m) => Mikros.referenz(m, g) > 0 && (summe.mikros[m.key] || 0) > 0));
  const zeigen = alleMikros ? Mikros.sortiert(Mikros.alle.filter((m) => Mikros.referenz(m, g) > 0)) : mitWert;

  return html`
    <${Page} titel=${tagText(ui.tag)} aktionen=${html`<${TagWahl} vm=${vm} />`}
      unten=${html`<div class="reihe">
        <${Knopf} art="umriss" onClick=${() => vm.oeffnen({ typ: 'scan', eintragen: true, barcode: true })}>📷 Scan<//>
        <${Knopf} art="umriss" onClick=${() => vm.oeffnen({ typ: 'mahlzeitStart', eintragen: true })}>🍲 Mahlzeit<//>
        <${Knopf} onClick=${() => vm.oeffnen({ typ: 'auswahl' })}>+ Eintrag<//>
      </div>`}>
      <${SicherungsErinnerung} vm=${vm} />
      <${Abschnitt} titel="Energie und Makros">
        <${Balken} name="Kalorien" wert=${summe.kcal} ziel=${ziele.kcal} einheit="kcal" gross />
        ${trainings.length > 0 && html`<${Klein}>Training: ${trainings.map((t) => `${t.name || 'Training'} ~${t.kcal} kcal`).join(', ')}${s.einstellungen.trainingEinrechnen ? ' (im Ziel enthalten)' : ' (nicht eingerechnet, siehe Profil)'}<//>`}
        <${Balken} name="Eiweiß" wert=${summe.eiweiss} ziel=${ziele.eiweiss} einheit="g" />
        <${Balken} name="Kohlenhydrate" wert=${summe.kohlenhydrate} ziel=${ziele.kohlenhydrate} einheit="g" />
        <${Balken} name="Fett" wert=${summe.fett} ziel=${ziele.fett} einheit="g" />
        <${Balken} name="Ballaststoffe" wert=${summe.ballaststoffe} ziel=${ziele.ballaststoffe} einheit="g" />
        ${boost.length > 0 && html`<${Klein}>Davon aus Supplements, Proteinen und Boostern: ${Format.zahl(boost.reduce((a, e) => a + e.naehrwerte.kcal, 0), 0)} kcal, ${Format.zahl(boost.reduce((a, e) => a + e.naehrwerte.eiweiss, 0))} g Eiweiß (Details unter „Boost“)<//>`}
        <${Balken} name="Trinken (ohne Alkohol)" wert=${getrunken} ziel=${trinkZiel} einheit="ml" />
        ${summe.eiweiss > 0 && html`<${Klein}>Eiweiß über den Tag: ${verteilung.abschnitte.map(([n, v]) => `${n} ${Format.zahl(v, 0)} g${v >= verteilung.zielJeMahlzeit ? ' ✓' : ''}`).join(' · ')}. Gut sind 3 bis 4 Mahlzeiten mit je etwa ${Format.zahl(verteilung.zielJeMahlzeit, 0)} g.<//>`}
        <h3>Höchstens</h3>
        <${Balken} name="Zucker" wert=${summe.zucker} ziel=${ziele.zuckerMax} einheit="g" obergrenze />
        <${Balken} name="Gesättigte Fettsäuren" wert=${summe.gesaettigt} ziel=${ziele.gesaettigtMax} einheit="g" obergrenze />
        <${Balken} name="Salz" wert=${summe.salz} ziel=${ziele.salzMax} einheit="g" obergrenze />
        ${(alkohol > 0 || koffein > 0) && html`<p>${[alkohol > 0 && `Alkohol ${Format.zahl(alkohol)} g (${Format.zahl(alkohol * Pegel.KCAL_PRO_G_ALKOHOL, 0)} kcal)`, koffein > 0 && `Koffein ${Format.zahl(koffein, 0)} mg`].filter(Boolean).join(' · ')}</p>`}
      <//>
      ${auffaellig.length > 0 && html`
        <div class="hinweis fehler">
          <h2>Unplausibel hohe Werte</h2>
          ${auffaellig.map((a) => {
            const pid = s.produkte.some((p) => p.id === a.eintrag.produktId) ? a.eintrag.produktId : null;
            return html`<p>${a.mikro.name}: ${Format.wert(a.summe, 0)} ${a.mikro.einheit}, das ist mehr als das 20-Fache des Bedarfs. Fast immer ein Einheitenfehler (µg als mg oder g eingetragen), hier wohl bei „${a.eintrag.name}“.</p>
              ${pid && html`<${Knopf} art="umriss" onClick=${() => vm.oeffnen({ typ: 'produkt', id: pid })}>„${a.eintrag.name}“ prüfen<//>`}`;
          })}
          <p class="klein">Nach dem Korrigieren des Produkts werden die heutigen Einträge mit angepasst.</p>
        </div>`}
      <${Abschnitt} titel="Vitamine und Mineralstoffe">
        ${!mitWert.length && !alleMikros && html`<${Klein}>Noch keine Angaben. Mikros zählen, wenn sie auf dem Etikett stehen oder beim Produkt eingetragen sind.<//>`}
        ${zeigen.map((m) => html`<${Balken} name=${m.name} wert=${summe.mikros[m.key] || 0} ziel=${Mikros.referenz(m, g)} einheit=${m.einheit} />`)}
        <button class="knopf text" onClick=${() => setAlleMikros(!alleMikros)}>${alleMikros ? 'Nur vorhandene zeigen' : 'Alle Referenzwerte zeigen'}</button>
        <${Klein} leise>Referenzwerte der DGE für Erwachsene. Gezählt wird nur, was bei den Produkten angegeben ist; Obst, Gemüse und Co. ohne Etikett fehlen oft.<//>
      <//>
      <h3 class="zwischen">Einträge</h3>
      ${!eintraege.length && html`<${Leer}>Noch nichts eingetragen.<//>`}
      ${eintraege.map((e) => html`<${EintragZeile} key=${e.id} e=${e} jetzt=${ui.jetzt} onClick=${() => vm.oeffnen({ typ: 'eintragBearbeiten', id: e.id })} />`)}
    <//>`;
}

const TagWahl = ({ vm }) => html`
  <button class="knopf text" onClick=${() => vm.tag(tagPlus(vm.ui.tag, -1))}>‹ Tag</button>
  <button class="knopf text" disabled=${vm.ui.tag >= heute()} onClick=${() => vm.tag(tagPlus(vm.ui.tag, 1))}>Tag ›</button>`;

function SicherungsErinnerung({ vm }) {
  const n = vm.s.eintraege.length;
  const t = vm.letzteSicherung;
  const tage = t ? Math.floor((Date.now() - t) / L.TAG) : null;
  if (n < 10 || (tage != null && tage < 14)) return null;
  return html`<${Hinweis} art="info">
    ${t ? `Letzte Sicherung vor ${tage} Tagen.` : 'Noch keine Sicherung.'} Safari kann die Daten löschen, wenn die App ein paar Wochen nicht benutzt wird.
    <div><button class="knopf text stark" onClick=${() => sicherungSpeichern(vm)}>Jetzt sichern</button></div>
  <//>`;
}

// ---------- Boost ----------

function BoostTab({ vm }) {
  const { s, ui } = vm;
  const von = ui.tag, bis = tagPlus(ui.tag, 1);
  const plan = useMemo(() => Boost.plan(s, von, bis), [s, von]);
  const warnungen = useMemo(() => Boost.warnungen(s, von, bis, tagBeginn), [s, von]);
  const heuteE = S.eintraege(s, von, bis);
  const boostHeute = heuteE.filter((e) => L.istBoost(e.kategorie));
  const [training, setTraining] = useState(true);
  const summen = Mikros.sortiert(Wirkstoffe).map((m) => [m, boostHeute.reduce((a, e) => a + (e.naehrwerte.mikros[m.key] || 0), 0)]).filter(([, v]) => v > 0);
  const koffein = boostHeute.reduce((a, e) => a + e.koffeinMg, 0);
  const eiweiss = boostHeute.reduce((a, e) => a + e.naehrwerte.eiweiss, 0);
  const kcal = boostHeute.reduce((a, e) => a + e.naehrwerte.kcal, 0);
  const vitamine = Mikros.sortiert(Mikros.vitamineUndMineralien.filter((m) => boostHeute.some((e) => (e.naehrwerte.mikros[m.key] || 0) > 0)));
  const mitVorrat = s.produkte.filter((p) => L.istBoost(p.kategorie) && p.vorratSeit > 0)
    .map((p) => [p, Boost.reichweiteTage(s, p, ui.jetzt)]).sort((a, b) => (a[1] ?? 1e9) - (b[1] ?? 1e9));
  const pruefen = s.produkte.filter((p) => L.istBoost(p.kategorie) && p.pruefen).length;
  const offen = plan.filter((p) => !p.erledigt).length;

  return html`
    <${Page} titel=${tagText(ui.tag)} aktionen=${html`<${TagWahl} vm=${vm} />`}
      unten=${html`<${Knopf} art="umriss" onClick=${() => vm.oeffnen({ typ: 'auswahl', filter: 'boost' })}>+ Supplement, Protein oder Booster eintragen<//>`}>
      ${warnungen.length > 0 && html`<div class="hinweis fehler"><h2>Hinweise</h2>${warnungen.map((w) => html`<p>• ${w}</p>`)}</div>`}
      <${Abschnitt} titel=${plan.length ? `Einnahmeplan: ${plan.length - offen} von ${plan.length} erledigt` : 'Einnahmeplan'}>
        ${!plan.length && html`<${Klein}>Noch kein Einnahmeplan. Stell dir deinen Plan selbst zusammen, mit Hinweisen zu Höchstmengen und Wechselwirkungen.<//>
          <${Knopf} onClick=${() => vm.oeffnen({ typ: 'planBearbeiten' })}>Einnahmeplan erstellen<//>`}
        ${ZEITPUNKTE.map((z) => {
          const punkte = plan.filter((p) => p.zeitpunkt === z);
          if (!punkte.length || (Zeitpunkt[z].training && !training)) return null;
          const rest = [...new Map(punkte.filter((p) => !p.erledigt).map((p) => [p.produkt.id, p.produkt])).values()];
          return html`
            <div class="plan-kopf"><h3>${Zeitpunkt[z].symbol} ${Zeitpunkt[z].text}</h3>
              ${rest.length > 1 && html`<button class="knopf text" onClick=${() => rest.forEach(vm.planEinnehmen)}>Alle abhaken</button>`}</div>
            ${punkte.map((pp) => html`
              <button class=${'plan-punkt' + (pp.erledigt ? ' erledigt' : '')} disabled=${pp.erledigt} onClick=${() => vm.planEinnehmen(pp.produkt)}>
                <span class="haken">${pp.erledigt ? '☑' : '☐'}</span>
                <span class="zeile-mitte"><span class="name">${pp.produkt.name}</span><span class="klein">${Boost.mengeText(pp.produkt, L.einnahme(pp.produkt))}</span></span>
              </button>`)}`;
        })}
        ${plan.some((p) => Zeitpunkt[p.zeitpunkt].training) && html`<button class="knopf text" onClick=${() => setTraining(!training)}>${training ? 'Trainingspunkte ausblenden (Ruhetag)' : 'Trainingspunkte zeigen'}</button>`}
        ${plan.length > 0 && html`<${Klein} leise>Antippen trägt die geplante Menge jetzt ein. Ändern oder löschen unter „Heute genommen“.<//>
          <${Knopf} art="umriss" onClick=${() => vm.oeffnen({ typ: 'planBearbeiten' })}>Plan bearbeiten<//>`}
      <//>
      <${Abschnitt} titel="Wirkstoffe heute">
        ${!summen.length && !koffein && !eiweiss && html`<${Klein}>Heute noch nichts.<//>`}
        ${summen.map(([m, v]) => (m.dosis > 0 ? html`<${Balken} name=${m.name} wert=${v} ziel=${m.dosis} einheit=${m.einheit} />` : html`<p>${m.name}: ${Format.zahl(v)} ${m.einheit}</p>`))}
        ${koffein > 0 && html`<p>Koffein aus Boostern: ${Format.zahl(koffein, 0)} mg (zählt auch in der Koffeinkurve)</p>`}
        ${(eiweiss > 0 || kcal > 0) && html`<p>Eiweiß ${Format.zahl(eiweiss)} g · ${Format.zahl(kcal, 0)} kcal (zählen auch auf „Essen“)</p>`}
        ${vitamine.length > 0 && html`<${Klein}>Vitamine und Mineralstoffe aus Supplements: ${vitamine.map((m) => `${m.name} ${Format.wert(boostHeute.reduce((a, e) => a + (e.naehrwerte.mikros[m.key] || 0), 0))} ${m.einheit}`).join(' · ')}<//>`}
        <${Klein} leise>Balken: übliche Tagesmenge zur Orientierung, keine medizinische Empfehlung.<//>
      <//>
      <${Abschnitt} titel="Heute genommen">
        ${!boostHeute.length && html`<${Klein}>Noch nichts.<//>`}
        ${boostHeute.map((e) => html`<${EintragZeile} key=${e.id} e=${e} jetzt=${ui.jetzt} onClick=${() => vm.oeffnen({ typ: 'eintragBearbeiten', id: e.id })} />`)}
      <//>
      <${Abschnitt} titel="Vorrat">
        ${!mitVorrat.length && html`<${Klein}>Beim Produkt den Vorrat eintragen, dann rechnet die App mit, wie lange er reicht.<//>`}
        ${mitVorrat.map(([p, tage]) => html`
          <button class="vorrat-zeile" onClick=${() => vm.oeffnen({ typ: 'produkt', id: p.id })}>
            <span>${p.name}</span><span class=${tage != null && tage < 14 ? 'rot' : ''}>${Boost.mengeText(p, Boost.vorrat(s, p) || 0)}${tage != null ? ` · ~${tage} Tage` : ''}</span>
          </button>`)}
        ${pruefen > 0 && html`<${Klein} leise>${pruefen} Produkte haben noch Richtwerte. Im Produkt „📷 Etikett scannen“ übernimmt die echten Werte.<//>`}
      <//>
    <//>`;
}

// ---------- Produkte ----------

function produktInfo(p) {
  const t = [];
  if (L.istBoost(p.kategorie)) {
    t.push(`${L.portionText(p)} ${Format.zahl(p.portion, 2)} ${L.einheit(p)}`);
    if (p.naehrwerte.kcal > 0) t.push(`${Format.zahl((p.naehrwerte.kcal * p.portion) / 100, 0)} kcal/${L.portionText(p)}`);
    if (p.plan.length) t.push('Plan: ' + p.plan.map((z) => Zeitpunkt[z].symbol).join(' '));
    if (p.pruefen) t.push('Richtwert');
  } else {
    t.push(`Portion ${Format.zahl(p.portion)} ${L.einheit(p)}`);
    t.push(`${Format.zahl(p.naehrwerte.kcal, 0)} kcal/100 ${L.einheit(p)}`);
  }
  if (p.volProzent > 0) t.push(`${Format.zahl(p.volProzent)} % vol`);
  if (p.koffeinMgPro100 > 0) t.push(`${Format.zahl((p.koffeinMgPro100 * p.portion) / 100, 0)} mg Koffein/Portion`);
  return t.join(' · ');
}

/** Ansicht „Produkt aus der Datenbank prüfen“ zu einem Datensatz (Scan und Suche). */
function dbAnsicht(t, eintragen) {
  const hinweis = t.koffeinFehlt ? 'Laut Zutaten mit Koffein, die Menge fehlt aber in der Datenbank. Bitte von der Verpackung eintragen.'
    : t.koffeinGeschaetzt ? `Koffein geschätzt (${Format.zahl(t.koffeinMgPro100 ?? 0, 0)} mg pro 100 ml, üblich für die Sorte). Bitte mit der Verpackung vergleichen.` : null;
  const hinweis2 = t.verworfen?.length ? `${hinweis ? hinweis + ' ' : ''}Unplausible Vitaminwerte wurden weggelassen.` : hinweis;
  return { typ: 'produkt', ausDb: true, gefunden: t.gefunden, koffeinHinweis: hinweis2, koffeinFehlt: t.koffeinFehlt, eintragen, schluessel: neueId() };
}

/** Datenbank-Datensatz als Lebensmittel für Mahlzeiten. */
const dbAlsLebensmittel = (d) => ({
  id: 'db:' + d.ean, name: L.dbAnzeige(d), gruppe: 'Barcode-Datenbank', fluessig: d.fluessig, naehrwerte: d.naehrwerte,
  stueckG: d.portion > 0 ? d.portion : null, eigenes: false,
});

/** Suche in Barcode-Datenbank und Lebensmitteln (BLS), verzögert beim Tippen. */
function useFremdSuche(suche, an = true) {
  const [r, setR] = useState({ frage: '', db: [], bls: [], laedt: false });
  useEffect(() => {
    const frage = suche.trim();
    if (!an || (!L.Suchtext.barcode(frage) && !L.Suchtext.woerter(frage).length)) { setR({ frage, db: [], bls: [], laedt: false }); return undefined; }
    let aus = false;
    setR((x) => ({ ...x, laedt: true }));
    const t = setTimeout(async () => {
      const [db, bls] = await Promise.all([
        dbNamenSuchen(frage, 25).catch((e) => { console.warn(e); return []; }),
        L.Suchtext.barcode(frage) ? [] : lebensmittel().then((x) => L.Suchtext.filtern(x.lebensmittel, frage, (l) => l.name, 25)).catch(() => []),
      ]);
      if (!aus) setR({ frage, db, bls, laedt: false });
    }, 300);
    return () => { aus = true; clearTimeout(t); };
  }, [suche, an]);
  return r;
}

const nwText = (n, fluessig) => `${Format.zahl(n.kcal, 0)} kcal · ${Format.zahl(n.eiweiss, 1)} g Eiweiß /100 ${fluessig ? 'ml' : 'g'}`;

function ProdukteTab({ vm, auswahl }) {
  const [suche, setSuche] = useState('');
  const [filter, setFilter] = useState(vm.ansicht?.filter === 'boost' ? 'boost' : null);
  const code = L.Suchtext.barcode(suche);
  const gefiltert = vm.s.produkte.filter((p) => !filter || (filter === 'boost' ? L.istBoost(p.kategorie) : p.kategorie === filter));
  const liste = code ? gefiltert.filter((p) => p.ean && L.Barcode.normal(p.ean) === code)
    : suche.trim() ? L.Suchtext.filtern(gefiltert, suche, (p) => p.name)
    : gefiltert.sort((a, b) => b.zuletzt - a.zuletzt || a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  const fremd = useFremdSuche(suche, !filter || filter === 'LEBENSMITTEL');
  const eigeneEans = new Set(vm.s.produkte.map((p) => p.ean).filter(Boolean));
  const db = fremd.db.filter((d) => !eigeneEans.has(d.ean));
  const blsWaehlen = (l) => vm.oeffnen({
    typ: 'produkt', id: null, eintragen: auswahl, schluessel: neueId(),
    vorlage: L.produkt({ name: l.name, fluessig: l.fluessig, portion: l.stueckG || (l.fluessig ? 250 : 100), naehrwerte: l.naehrwerte }),
  });
  const suchtAktiv = !!suche.trim();
  return html`
    <${Page} titel=${auswahl ? 'Was eintragen?' : 'Produkte'} zurueck=${auswahl ? vm.zurueck : null}
      unten=${html`
        <div class="reihe">
          <${Knopf} art="umriss" onClick=${() => vm.oeffnen({ typ: 'scan', eintragen: auswahl, barcode: true })}>📷 Scannen<//>
          <${Knopf} art="umriss" onClick=${() => vm.oeffnen({ typ: 'produkt', id: null, eintragen: auswahl, schluessel: neueId() })}>+ Neu von Hand<//>
        </div>
        <${Knopf} art="umriss" klasse="flach" onClick=${() => vm.oeffnen({ typ: 'mahlzeitStart', eintragen: auswahl })}>🍲 Mahlzeit oder Rezept schätzen<//>`}>
      <${Eingabe} label="Suchen" wert=${suche} onInput=${setSuche} hilfe="Name, Marke oder Barcode-Nummer" />
      <div class="chips scroll">
        <${Chip} an=${!filter} onClick=${() => setFilter(null)}>Alle<//>
        ${KATEGORIEN.map((k) => html`<${Chip} an=${filter === k} onClick=${() => setFilter(filter === k ? null : k)}>${Kategorie[k].symbol} ${Kategorie[k].mehrzahl}<//>`)}
      </div>
      ${(filter && filter !== 'LEBENSMITTEL') && html`<${Knopf} art="umriss" klasse="flach" onClick=${() => vm.oeffnen({ typ: 'vorlagen' })}>＋ Supplements, Proteine und Booster aus Vorlagen<//>`}
      ${suchtAktiv && (db.length || fremd.bls.length || fremd.laedt) && html`<h3 class="zwischen">Meine Produkte</h3>`}
      ${!liste.length && html`<${Leer}>${suchtAktiv ? 'Keine eigenen Produkte gefunden.' : 'Noch keine Produkte.'}<//>`}
      ${liste.map((p) => html`
        <div class="karte produkt" key=${p.id}>
          <button class="produkt-haupt" onClick=${() => vm.oeffnen({ typ: 'eintragen', produktId: p.id })}>
            <span class="name">${L.istBoost(p.kategorie) ? Kategorie[p.kategorie].symbol + ' ' : ''}${p.name}</span>
            <span class="klein">${produktInfo(p)}</span>
          </button>
          <button class="stern" aria-label=${p.favorit ? 'Favorit entfernen' : 'Als Favorit'} onClick=${() => vm.favorit(p)}>${p.favorit ? '★' : '☆'}</button>
          <button class="knopf text" onClick=${() => vm.oeffnen({ typ: 'produkt', id: p.id })}>Ändern</button>
        </div>`)}
      ${fremd.laedt && html`<div class="status"><span class="kreisel"></span>Suche in den Datenbanken …</div>`}
      ${db.length > 0 && html`<h3 class="zwischen">Barcode-Datenbank</h3>
        ${db.map((d) => html`<button class="wahl" key=${'db' + d.ean} onClick=${() => vm.oeffnen({ ...dbAnsicht(d, auswahl), id: null, vorlage: L.dbAlsProdukt(d) })}>
          <span>${L.dbAnzeige(d)}</span><span class="klein">${nwText(d.naehrwerte, d.fluessig)} · ${d.ean}</span></button>`)}`}
      ${fremd.bls.length > 0 && html`<h3 class="zwischen">Lebensmittel (BLS)</h3>
        ${fremd.bls.map((l) => html`<button class="wahl" key=${'bls' + l.id} onClick=${() => blsWaehlen(l)}>
          <span>${l.name}</span><span class="klein">${l.gruppe} · ${nwText(l.naehrwerte, l.fluessig)}</span></button>`)}`}
      ${suchtAktiv && !fremd.laedt && fremd.frage === suche.trim() && !liste.length && !db.length && !fremd.bls.length && (!filter || filter === 'LEBENSMITTEL')
        && html`<${Klein} leise>Auch in den Datenbanken nichts gefunden. Anders schreiben oder scannen.<//>`}
    <//>`;
}

// ---------- Einnahmeplan bauen (wie PlanScreen.kt) ----------

/** Hinweise als Karte: ernste rot, Tipps neutral. */
function HinweisKarte({ titel, hinweise }) {
  if (!hinweise.length) return null;
  const ernst = hinweise.some((h) => h.ernst);
  return html`<div class=${'hinweis ' + (ernst ? 'fehler' : 'info')}>
    <h2>${titel}</h2>
    ${hinweise.map((h) => html`<p class="hinweis-zeile">${h.ernst ? '⚠ ' : '💡 '}${h.text}</p>`)}
  </div>`;
}

function PlanBearbeitenScreen({ vm }) {
  const produkte = vm.s.produkte;
  const pruefung = useMemo(() => L.Wissen.planPruefen(produkte), [produkte]);
  const werte = useMemo(() => L.Wissen.planTageswerte(produkte), [produkte]);
  return html`
    <${Page} titel="Einnahmeplan" zurueck=${vm.zurueck}>
      ${pruefung.length ? html`<${HinweisKarte} titel="Prüfung des Plans" hinweise=${pruefung} />`
        : html`<${Klein}>Füge je Zeitpunkt hinzu, was du nimmst. Die App prüft dabei Höchstmengen pro Tag, Wechselwirkungen und Kuren.<//>`}
      ${ZEITPUNKTE.map((z) => {
        const hier = produkte.filter((p) => p.plan.includes(z));
        return html`<${Abschnitt} key=${z} titel=${`${Zeitpunkt[z].symbol} ${Zeitpunkt[z].text}${Zeitpunkt[z].training ? ' (an Trainingstagen)' : ''}`}>
          ${hier.map((p) => {
            const n = p.plan.filter((x) => x === z).length;
            return html`<div class="plan-zeile" key=${p.id}>
              <button class="zeile-mitte" onClick=${() => vm.oeffnen({ typ: 'produkt', id: p.id })}>
                <span class="name">${p.name}${n > 1 ? ` (${n}×)` : ''}</span>
                <span class="klein">${Boost.mengeText(p, L.einnahme(p))} · antippen zum Ändern</span>
              </button>
              <button class="knopf text" onClick=${() => vm.planEntfernen(p, z)}>Entfernen</button>
            </div>`;
          })}
          <${Knopf} art="umriss" onClick=${() => vm.oeffnen({ typ: 'planHinzufuegen', zeitpunkt: z })}>+ Hinzufügen<//>
        <//>`;
      })}
      ${Object.keys(werte).length > 0 && html`
        <${Abschnitt} titel="Pro Tag laut Plan">
          ${Object.entries(werte).sort(([a], [b]) => Mikros.alphabetischNachKey(a, b)).map(([k, v]) => {
            const i = L.Wissen.info(k);
            const zu = i && L.Wissen.zuViel(i, v);
            return html`<p class=${zu ? 'rot' : ''} key=${k}>${L.Wissen.name(k)}: ${L.Wissen.menge(k, v)}${i?.maxText ? ` (Richtwert ${i.maxText})` : ''}</p>`;
          })}
          <${Klein} leise>Gezählt sind alle Einnahmen, auch die an Trainingstagen. Orientierung, keine medizinische Beratung.<//>
        <//>`}
    <//>`;
}

function PlanHinzufuegenScreen({ vm, a }) {
  const z = a.zeitpunkt;
  const [suche, setSuche] = useState('');
  const w = L.Suchtext.woerter(suche);
  const passt = (name) => !suche.trim() || L.Suchtext.passt(name, w);
  const eigene = vm.s.produkte.filter((p) => L.istBoost(p.kategorie) && !p.plan.includes(z) && passt(p.name))
    .sort((x, y) => x.name.toLowerCase().localeCompare(y.name.toLowerCase()));
  const vorlagen = L.PlanVorlagen.filter((v) => passt(v.name));
  const marken = L.Vorlagen.filter((v) => passt(`${v.produkt.name} ${v.marke}`) && v.marke !== 'Allgemein');
  return html`
    <${Page} titel=${`${Zeitpunkt[z].symbol} ${Zeitpunkt[z].text}: hinzufügen`} zurueck=${vm.zurueck}
      unten=${html`<${Knopf} art="umriss" onClick=${() => vm.planNeu(z)}>+ Eigenes Supplement anlegen<//>`}>
      <${Eingabe} label="Suchen" wert=${suche} onInput=${setSuche} />
      ${eigene.length > 0 && html`<h3 class="zwischen">Deine Produkte</h3>
        ${eigene.map((p) => html`<button class="wahl" key=${p.id} onClick=${() => vm.planHinzufuegen(p, z)}>
          <span class="name">${Kategorie[p.kategorie].symbol} ${p.name}</span>
          <span class="klein">${Boost.mengeText(p, L.einnahme(p))}${p.plan.length ? ' · schon: ' + p.plan.map((x) => Zeitpunkt[x].symbol).join(' ') : ''}</span>
        </button>`)}`}
      <h3 class="zwischen">Vorlagen</h3>
      <${Klein}>Legt ein eigenes Produkt mit üblicher Menge an; danach Name, Menge und Etikett anpassen.<//>
      ${vorlagen.map((v) => {
        const tipp = v.keys.map((k) => L.Wissen.info(k)).find(Boolean);
        const passtZeit = !tipp || !tipp.zeitpunkte.length || tipp.zeitpunkte.includes(z);
        return html`<button class="wahl" key=${'v:' + v.name} onClick=${() => vm.vorlageAnlegen(v.produkt, z)}>
          <span class="name">${v.name}</span>
          <span class="klein">${v.beschreibung}</span>
          ${tipp && html`<span class="klein">💡 ${tipp.tipp}${tipp.maxText ? ` Richtwert: ${tipp.maxText}.` : ''}</span>`}
          ${!passtZeit && html`<span class="klein rot">Passt eher zu: ${tipp.zeitpunkte.map((x) => Zeitpunkt[x].text).join(' oder ')}</span>`}
        </button>`;
      })}
      ${marken.length > 0 && html`<h3 class="zwischen">Markenprodukte</h3>
        ${marken.map((v) => html`<button class="wahl" key=${v.produkt.id} onClick=${() => vm.vorlageAnlegen({ ...v.produkt, vorlage: v.produkt.id }, z)}>
          <span class="name">${Kategorie[v.produkt.kategorie].symbol} ${v.produkt.name}</span>
          <span class="klein">${produktInfo({ ...v.produkt, plan: [] }).replace(' · Richtwert', '')}${v.notiz ? ' · ' + v.notiz : ''}</span>
        </button>`)}`}
    <//>`;
}

// ---------- Vorlagen ----------

function VorlagenScreen({ vm }) {
  const [suche, setSuche] = useState('');
  const da = new Set(vm.s.produkte.map((p) => p.vorlage).filter(Boolean));
  const liste = suche.trim() ? L.Suchtext.filtern(L.Vorlagen, suche, (v) => `${v.produkt.name} ${v.marke}`) : L.Vorlagen;
  const marken = [...new Set(liste.map((v) => v.marke))];
  return html`
    <${Page} titel="Vorlagen" zurueck=${vm.zurueck}>
      <${Klein}>Gängige Supplements, Proteine und Booster. Antippen übernimmt das Produkt mit Einnahmeplan nach Herstellerempfehlung, danach kannst du alles ändern. Die Werte sind Richtwerte, Sorten weichen ab: am besten einmal das Etikett scannen.<//>
      <${Eingabe} label="Suchen" wert=${suche} onInput=${setSuche} />
      ${marken.map((m) => html`
        <h3 class="zwischen">${m === 'Allgemein' ? 'Ohne Marke' : m}</h3>
        ${liste.filter((v) => v.marke === m).map((v) => {
          const schon = da.has(v.produkt.id);
          return html`<div class="karte produkt" key=${v.produkt.id}>
            <div class="produkt-haupt">
              <span class="name">${Kategorie[v.produkt.kategorie].symbol} ${v.produkt.name}</span>
              <span class="klein">${produktInfo(v.produkt).replace(' · Richtwert', '')}${v.notiz ? ' · ' + v.notiz : ''}</span>
            </div>
            ${schon ? html`<span class="klein leise haken-text">✓ da</span>`
              : html`<button class="knopf text stark" onClick=${() => { const p = vm.vorlageUebernehmen(v); vm.meldung(`„${p.name}“ ist jetzt unter Produkte${p.plan.length ? ' und im Einnahmeplan' : ''}.`); }}>Hinzufügen</button>`}
          </div>`;
        })}`)}
    <//>`;
}

// ---------- Eintragen ----------

function EintragenScreen({ vm, a }) {
  const s = vm.s;
  const alt = a.typ === 'eintragBearbeiten' ? s.eintraege.find((e) => e.id === a.id) : null;
  let produkt = a.typ === 'eintragen' ? S.produkt(s, a.produktId) : null;
  if (alt) {
    const p = L.eintragAlsProdukt(alt);
    const orig = S.produkt(s, alt.produktId);
    produkt = orig ? { ...p, portion: orig.portion, portionName: orig.portionName } : p;
  }
  const start = alt?.zeit ?? (vm.ui.tag === heute() ? Date.now() : mittag(vm.ui.tag));
  const [menge, setMenge] = useState(alt?.menge ?? produkt?.portion ?? 0);
  const [zeit, setZeit] = useState(start);
  const [mitEssen, setMitEssen] = useState(alt?.mitEssen ?? false);
  const [loeschen, setLoeschen] = useState(false);
  if (!produkt) return html`<${Page} titel="Nicht gefunden" zurueck=${vm.zurueck}><${Leer}>Das wurde inzwischen gelöscht.<//><//>`;
  const vorschau = L.eintragAus(produkt, '', zeit, menge, mitEssen);
  const e = L.einheit(produkt);
  const planP = S.produkt(s, produkt.id);
  const stufen = L.stueckig(produkt) ? [1, 2, 3] : [0.5, 1, 2];
  const n = vorschau.naehrwerte;
  const wirk = Object.entries(n.mikros).filter(([k, v]) => Mikros.mikro(k)?.wirkstoff && v > 0);
  const jahr = new Date().getFullYear();

  return html`
    <${Page} titel=${alt ? 'Eintrag ändern' : produkt.name} zurueck=${vm.zurueck}
      aktionen=${alt && html`<button class="knopf text" onClick=${() => setLoeschen(true)}>Löschen</button>`}
      unten=${html`<${Knopf} deaktiviert=${!(menge > 0)} onClick=${() => (alt ? vm.eintragAendern(alt, menge, zeit, mitEssen) : vm.eintragen(produkt, menge, zeit, mitEssen))}>${alt ? 'Speichern' : 'Eintragen'}<//>`}>
      ${alt && html`<h2 class="titel">${alt.name}</h2>`}
      <${ZahlFeld} label=${`Menge in ${e}`} wert=${menge} onWert=${setMenge} />
      <${Chips}>
        ${planP && planP.planMenge > 0 && planP.planMenge !== planP.portion && html`<${Chip} onClick=${() => setMenge(planP.planMenge)}>Laut Plan (${Format.zahl(planP.planMenge, 2)} ${e})<//>`}
        ${stufen.map((f) => html`<${Chip} onClick=${() => setMenge(produkt.portion * f)}>
          ${L.stueckig(produkt) ? `${Format.zahl(f)} × ${L.portionText(produkt)}` : f === 0.5 ? `½ ${L.portionText(produkt)}` : `${Format.zahl(f)} × ${L.portionText(produkt)}`} (${Format.zahl(produkt.portion * f, 2)} ${e})<//>`)}
      <//>
      ${L.stueckig(produkt) && html`<${Klein}>= ${Boost.mengeText(produkt, menge)}<//>`}
      <${Abschnitt} titel=${`Uhrzeit: ${uhr(zeit)}`}>
        <${Chips}>
          ${[[-60, '−1 h'], [-15, '−15 min'], [15, '+15 min'], [60, '+1 h']].map(([m, t]) => html`<${Chip} onClick=${() => setZeit(zeit + m * MINUTE)}>${t}<//>`)}
          <${Chip} onClick=${() => setZeit(Date.now())}>Jetzt<//>
        <//>
        <label class="feld"><span class="feld-label">Genaue Uhrzeit</span>
          <input type="time" value=${hhmm(zeit)} onInput=${(ev) => { const [h, m] = ev.target.value.split(':').map(Number); if (!Number.isNaN(h)) { const d = new Date(zeit); d.setHours(h, m || 0, 0, 0); setZeit(d.getTime()); } }} />
        </label>
        ${zeit > Date.now() + 5 * MINUTE && html`<p class="rot">Liegt in der Zukunft.</p>`}
      <//>
      ${produkt.volProzent > 0 && html`<${Schalter} label="Mit oder nach dem Essen" an=${mitEssen} onWechsel=${setMitEssen} hilfe="Alkohol geht dann langsamer ins Blut, die Spitze fällt niedriger aus." />`}
      <${Abschnitt} titel="Das sind">
        <p>${Format.zahl(n.kcal, 0)} kcal · Eiweiß ${Format.zahl(n.eiweiss)} g · Kohlenhydrate ${Format.zahl(n.kohlenhydrate)} g · Fett ${Format.zahl(n.fett)} g</p>
        ${wirk.length > 0 && html`<p>${wirk.map(([k, v]) => `${Mikros.mikro(k).name} ${Format.zahl(v, 2)} ${Mikros.mikro(k).einheit}`).join(' · ')}</p>`}
        ${vorschau.alkoholG > 0 && html`<p>${Format.zahl(vorschau.alkoholG)} g Alkohol, allein bis zu etwa ${Format.promille(vorschau.alkoholG * Pegel.promilleProGramm(s.koerper, s.einstellungen, jahr))}</p>`}
        ${vorschau.koffeinMg > 0 && html`<p>${Format.zahl(vorschau.koffeinMg, 0)} mg Koffein</p>`}
      <//>
      ${loeschen && html`<${Dialog} text=${`„${alt.name}“ (${uhr(alt.zeit)}) löschen?`} jaText="Löschen" ja=${() => vm.eintragLoeschen(alt.id)} nein=${() => setLoeschen(false)} />`}
    <//>`;
}

// ---------- Produkt bearbeiten ----------

const MAKRO_FELDER = [
  ['kcal', 'Energie (kcal)'], ['fett', 'Fett (g)'], ['gesaettigt', 'davon gesättigte Fettsäuren (g)'], ['kohlenhydrate', 'Kohlenhydrate (g)'],
  ['zucker', 'davon Zucker (g)'], ['ballaststoffe', 'Ballaststoffe (g)'], ['eiweiss', 'Eiweiß (g)'], ['salz', 'Salz (g)'],
];
const r6 = (x) => Math.round(x * 1e6) / 1e6;

function ProduktScreen({ vm, a }) {
  const s = vm.s;
  const vorhanden = a.id ? S.produkt(s, a.id) : null;
  const [p, setP] = useState(() => L.produkt(a.vorlage || vorhanden || {}));
  const [jePortion, setJePortion] = useState(L.istBoost((a.vorlage || vorhanden)?.kategorie));
  const [loeschen, setLoeschen] = useState(false);
  const [rohOffen, setRohOffen] = useState(false);
  const rest = vorhanden ? Boost.vorrat(s, vorhanden) : null;
  const [vorratEingabe, setVorratEingabe] = useState(rest != null ? (L.stueckig(p) ? rest / p.portion : rest) : 0);
  const e = L.einheit(p);
  const boost = L.istBoost(p.kategorie);
  const hilfe = (k) => (a.gefunden && !a.gefunden.has(k) ? 'nicht erkannt' : null);
  const f = jePortion && p.portion > 0 ? p.portion / 100 : 1;
  const bezug = jePortion && p.portion > 0 ? `je ${L.portionText(p)} (${Format.zahl(p.portion, 2)} ${e})` : `pro 100 ${e}`;
  const nwSetzen = (k, v) => setP({ ...p, naehrwerte: { ...p.naehrwerte, [k]: v } });
  const mikroSetzen = (m) => setP({ ...p, naehrwerte: { ...p.naehrwerte, mikros: m } });
  const frei = Mikros.sortiert(Mikros.alle.filter((m) => !(m.key in p.naehrwerte.mikros) && (m.referenzMann > 0 || m.wirkstoff)));
  const titel = vorhanden ? 'Produkt ändern' : a.ausDb ? 'Aus der Datenbank: bitte prüfen' : a.gefunden ? 'Gescannt: bitte prüfen' : 'Neues Produkt';

  return html`
    <${Page} titel=${titel} zurueck=${vm.zurueck}
      aktionen=${vorhanden && html`<button class="knopf text" onClick=${() => setLoeschen(true)}>Löschen</button>`}
      unten=${html`<div class="reihe">
        <${Knopf} art="umriss" deaktiviert=${!p.name.trim()} onClick=${() => vm.produktSpeichern(p, false)}>Speichern<//>
        <${Knopf} deaktiviert=${!p.name.trim()} onClick=${() => vm.produktSpeichern(p, true)}>Speichern & eintragen<//>
      </div>`}>
      ${a.ausDb && html`<p>Werte pro 100 ${e} aus Open Food Facts. Die Daten pflegen Freiwillige; vergleiche kurz mit der Verpackung.</p>`}
      ${a.ausDb && a.koffeinHinweis && html`<${Hinweis} art=${a.koffeinFehlt ? 'fehler' : 'info'}>⚡ ${a.koffeinHinweis}<//>`}
      ${!a.ausDb && a.gefunden && html`<p>Gelesen wurden ${a.gefunden.size} Werte pro 100 ${e}. Vergleiche kurz mit der Verpackung, die Erkennung kann sich bei Kommas und kleinen Zahlen irren.</p>`}
      <${Eingabe} label="Name" wert=${p.name} onInput=${(v) => setP({ ...p, name: v })} pflicht />
      ${p.ean && html`<div class="reihe-text"><span class="klein">Barcode ${p.ean}</span><button class="knopf text" onClick=${() => setP({ ...p, ean: '' })}>Entfernen</button></div>`}
      <${Auswahl} label="Art" optionen=${KATEGORIEN} wert=${p.kategorie} text=${(k) => `${Kategorie[k].symbol} ${Kategorie[k].text}`}
        onWahl=${(k) => { setP({ ...p, kategorie: k }); setJePortion(Kategorie[k].boost); }} />
      ${boost && p.pruefen && html`<${Hinweis} art="info">Richtwerte, noch nicht mit dem Etikett abgeglichen. Am schnellsten: Etikett scannen.<//>`}
      ${boost && html`<${Knopf} art="umriss" onClick=${() => vm.oeffnen({ typ: 'scan', eintragen: a.eintragen, fuer: { ...p, id: vorhanden?.id || p.id }, barcode: false, schluessel: neueId() })}>📷 Etikett oder Barcode scannen (Werte übernehmen)<//>`}
      <${Schalter} label="Flüssig (Mengen in ml)" an=${p.fluessig} onWechsel=${(v) => setP({ ...p, fluessig: v })} />
      ${boost && html`<${Eingabe} label="Name einer Portion" wert=${p.portionName} onInput=${(v) => setP({ ...p, portionName: v })} hilfe="z. B. Kapsel, Messlöffel; leer = Portion" />`}
      <${ZahlFeld} label=${boost ? `Eine ${L.portionText(p)} wiegt (${e})` : `Übliche Portion (${e})`} wert=${p.portion} onWert=${(neu) => {
        if (jePortion && p.portion > 0 && neu > 0) {
          const k = p.portion / neu;
          setP({ ...p, portion: neu, naehrwerte: L.nwMal(p.naehrwerte, k), koffeinMgPro100: p.koffeinMgPro100 * k });
        } else setP({ ...p, portion: neu });
      }} />
      <${Schalter} label="Favorit (Schnellknopf auf „Pegel“)" an=${p.favorit} onWechsel=${(v) => setP({ ...p, favorit: v })} />
      ${p.portion > 0 && html`<${Schalter} label=${`Werte je ${L.portionText(p)} eingeben`} an=${jePortion} onWechsel=${setJePortion} hilfe=${jePortion ? `wie auf dem Etikett, gespeichert wird pro 100 ${e}` : null} />`}
      <${Abschnitt} titel=${`Makros ${bezug}`}>
        ${MAKRO_FELDER.map(([k, label]) => html`<${ZahlFeld} key=${k + f} label=${label} wert=${r6(p.naehrwerte[k] * f)} onWert=${(v) => nwSetzen(k, v / f)} hilfe=${hilfe(k)} />`)}
      <//>
      <${Abschnitt} titel="Alkohol und Koffein">
        <${ZahlFeld} label="Alkohol (% vol)" wert=${p.volProzent} onWert=${(v) => setP({ ...p, volProzent: v })} />
        <${ZahlFeld} key=${'kof' + f} label=${`Koffein (mg ${bezug})`} wert=${r6(p.koffeinMgPro100 * f)} onWert=${(v) => setP({ ...p, koffeinMgPro100: v / f })}
          hilfe=${p.koffeinMgPro100 > 0 && !jePortion ? `${Format.zahl((p.koffeinMgPro100 * p.portion) / 100, 0)} mg pro Portion` : a.koffeinFehlt ? 'Fehlt: steht meist als „Koffein … mg/100 ml“ auf der Dose' : p.kategorie === 'BOOSTER' && !(p.koffeinMgPro100 > 0) ? 'Fehlt noch: steht auf dem Etikett, zählt dann in der Koffeinkurve' : null} />
      <//>
      <${Abschnitt} titel=${(boost ? 'Vitamine, Mineralstoffe und Wirkstoffe ' : 'Vitamine und Mineralstoffe ') + bezug}>
        ${Object.keys(p.naehrwerte.mikros).sort(Mikros.alphabetischNachKey).map((k) => {
          const m = Mikros.mikro(k);
          if (!m) return null;
          return html`<div class="reihe-feld" key=${k + f}>
            <${ZahlFeld} label=${`${m.name} (${m.einheit})`} wert=${r6((p.naehrwerte.mikros[k] || 0) * f)} onWert=${(v) => mikroSetzen({ ...p.naehrwerte.mikros, [k]: v / f })} hilfe=${hilfe(k)} />
            <button class="knopf text" aria-label="Entfernen" onClick=${() => { const m2 = { ...p.naehrwerte.mikros }; delete m2[k]; mikroSetzen(m2); }}>✕</button>
          </div>`;
        })}
        ${frei.length > 0 && html`<${Auswahl} label="Hinzufügen" optionen=${[null, ...frei]} wert=${null} text=${(m) => (m ? m.name : 'wählen')} onWahl=${(m) => m && mikroSetzen({ ...p.naehrwerte.mikros, [m.key]: 0 })} />`}
      <//>
      ${boost && html`
        <${HinweisKarte} titel="Hinweise zu den Wirkstoffen" hinweise=${L.Wissen.produktTipps(p, s.produkte)} />
        <${Abschnitt} titel="Einnahmeplan">
          ${ZEITPUNKTE.map((z) => {
            const n = p.plan.filter((x) => x === z).length;
            return html`<${Zaehler} label=${`${Zeitpunkt[z].symbol} ${Zeitpunkt[z].text}`} wert=${n}
              minus=${() => { const i = p.plan.indexOf(z); setP({ ...p, plan: p.plan.filter((_, j) => j !== i) }); }} plus=${() => setP({ ...p, plan: [...p.plan, z] })} minusAn=${n > 0} plusAn=${n < 5} />`;
          })}
          <${ZahlFeld} label=${`Menge je Einnahme (${e}, leer = 1 ${L.portionText(p)})`} wert=${p.planMenge} onWert=${(v) => setP({ ...p, planMenge: v })} hilfe=${p.planMenge > 0 ? Boost.mengeText(p, p.planMenge) : null} />
          <${ZahlFeld} label="Nur als Kur: höchstens Wochen am Stück (leer = dauerhaft)" wert=${p.kurWochen} onWert=${(v) => setP({ ...p, kurWochen: Math.round(v) })} />
        <//>
        <${Abschnitt} titel="Vorrat">
          <${ZahlFeld} label=${L.stueckig(p) ? `Noch da (Anzahl ${L.portionText(p)})` : `Noch da (${e})`} wert=${vorratEingabe} onWert=${setVorratEingabe}
            hilfe=${rest != null ? `Laut App gerade ${Boost.mengeText(p, rest)}${(() => { const t = vorhanden && Boost.reichweiteTage(s, vorhanden, Date.now()); return t != null && t !== false ? `, reicht etwa ${t} Tage` : ''; })()}` : null} />
          <div class="reihe">
            <${Knopf} art="umriss" deaktiviert=${!(vorratEingabe > 0)} onClick=${() => setP({ ...p, vorrat: L.stueckig(p) ? vorratEingabe * p.portion : vorratEingabe, vorratSeit: Date.now() })}>Als aktuellen Vorrat setzen<//>
            ${p.vorratSeit > 0 && html`<button class="knopf text" onClick=${() => setP({ ...p, vorrat: 0, vorratSeit: 0 })}>Nicht verfolgen</button>`}
          </div>
          ${p.vorratSeit > 0 && p.vorratSeit !== vorhanden?.vorratSeit && html`<${Klein}>Vorrat gesetzt. Zum Übernehmen speichern.<//>`}
          <${Klein} leise>Jede Einnahme zieht die Menge vom Vorrat ab. Neue Packung: Gesamtmenge eintragen und setzen, dann speichern.<//>
        <//>
        <${Schalter} label="Noch mit dem Etikett abgleichen" an=${p.pruefen} onWechsel=${(v) => setP({ ...p, pruefen: v })} />`}
      ${a.rohtext?.length > 0 && html`
        <button class="knopf text" onClick=${() => setRohOffen(!rohOffen)}>${rohOffen ? 'Gelesenen Text ausblenden' : 'Gelesenen Text zeigen'}</button>
        ${rohOffen && html`<pre class="rohtext">${a.rohtext.join('\n')}</pre>`}`}
      ${loeschen && html`<${Dialog} text=${`„${vorhanden.name}“ löschen? Bereits eingetragene Mahlzeiten bleiben erhalten.`} jaText="Löschen" ja=${() => vm.produktLoeschen(vorhanden.id)} nein=${() => setLoeschen(false)} />`}
    <//>`;
}

// ---------- Scan ----------

/** Werte aus Scan oder Datenbank in ein vorhandenes Produkt übernehmen (Name, Plan, Vorrat bleiben). */
const uebernehmen = (fuer, gelesen) => ({
  ...fuer, naehrwerte: gelesen.naehrwerte, koffeinMgPro100: gelesen.koffeinMgPro100, volProzent: gelesen.volProzent,
  fluessig: gelesen.fluessig, ean: gelesen.ean || fuer.ean, name: fuer.name.trim() ? fuer.name : gelesen.name, pruefen: false,
});

let scanEan = null;

function ScanScreen({ vm, a }) {
  const [barcode, setBarcode] = useState(a.barcode !== false && !a.rezept);
  const [laeuft, setLaeuft] = useState(false);
  const [status, setStatus] = useState('');
  const [fehler, setFehler] = useState(null);
  const video = useRef();
  const fotoRef = useRef();
  const galerieRef = useRef();
  const fertigRef = useRef(false);
  const s = vm.s;
  const stapel = vm.ui.stapel;

  // Live-Barcode mit der Kamera.
  useEffect(() => {
    if (!barcode) return undefined;
    let strom = null, stop = null, aus = false;
    Scan.kameraStarten(video.current).then((st) => {
      if (aus) { Scan.kameraStoppen(st); return; }
      strom = st;
      stop = Scan.barcodeSchleife(video.current, (code) => { if (!fertigRef.current) { fertigRef.current = true; navigator.vibrate?.(40); codeGefunden(code); } });
    }).catch((e) => setFehler(e.name === 'NotAllowedError' ? 'Kein Zugriff auf die Kamera. In den Einstellungen erlauben oder ein Foto aufnehmen.' : e.message));
    return () => { aus = true; stop?.(); Scan.kameraStoppen(strom); };
  }, [barcode]);

  async function codeGefunden(code) {
    const eigenes = S.produktMitEan(s, code);
    if (eigenes && !a.fuer) { vm.ersetzen({ typ: 'eintragen', produktId: eigenes.id }); return; }
    setStatus('Suche in der Datenbank …');
    let t = null;
    try { t = await dbSuchen(code); } catch (e) { console.warn(e); }
    if (t) {
      const gelesen = L.dbAlsProdukt(t);
      const ansicht = dbAnsicht(t, a.eintragen);
      if (a.fuer) vm.zumFormular({ ...ansicht, id: a.fuer.id || null, vorlage: uebernehmen(a.fuer, gelesen) });
      else vm.ersetzen({ ...ansicht, id: null, vorlage: gelesen });
      return;
    }
    scanEan = L.Barcode.normal(code);
    setStatus('');
    setBarcode(false);
    vm.meldung(`Der Code ${L.Barcode.normal(code)} steht nicht in der Datenbank. Fotografiere die Nährwerttabelle, der Code wird beim Produkt gemerkt.`);
  }

  async function foto(datei) {
    if (!datei) return;
    setLaeuft(true);
    setFehler(null);
    setStatus('Lese Text …');
    try {
      if (barcode && !a.rezept) {
        const code = await Scan.barcodeLesen(datei);
        setLaeuft(false);
        if (code) { fertigRef.current = true; codeGefunden(code); } else setFehler('Kein Barcode auf dem Foto gefunden. Näher heran und gerade halten, oder die Nährwerttabelle fotografieren.');
        return;
      }
      const boxen = await Scan.textLesen(datei, (m) => {
        if (m.status === 'recognizing text') setStatus(`Lese Text … ${Math.round(m.progress * 100)} %`);
        else if (m.status) setStatus('Texterkennung wird vorbereitet …');
      });
      if (a.rezept) { await rezeptGelesen(vm, boxen, a); return; }
      const zeilen = L.Naehrwerttabelle.zeilen(boxen).map(L.Naehrwerttabelle.ocrKorrektur);
      if (!zeilen.length) { setFehler('Auf dem Bild wurde kein Text gefunden. Bitte näher heran und scharf stellen.'); return; }
      const r = L.Naehrwerttabelle.lesen(zeilen);
      const ean = scanEan || '';
      scanEan = null;
      const vorlage = L.produkt({ fluessig: r.fluessig ?? false, portion: r.portion ?? (r.fluessig ? 250 : 100), koffeinMgPro100: r.koffeinMgPro100 ?? 0, naehrwerte: r.naehrwerte, ean });
      const ansicht = { typ: 'produkt', gefunden: r.gefunden, rohtext: zeilen, eintragen: a.eintragen, schluessel: neueId() };
      if (a.fuer) {
        let neu = uebernehmen(a.fuer, vorlage);
        if (r.portion != null) neu = { ...neu, portion: r.portion };
        vm.zumFormular({ ...ansicht, id: a.fuer.id || null, vorlage: neu });
      } else vm.ersetzen({ ...ansicht, id: null, vorlage });
      if (!L.Naehrwerttabelle.brauchbar(r)) vm.meldung('Es wurde kaum etwas erkannt. Unten im Formular steht der gelesene Text; die Werte kannst du von Hand eintragen oder ein neues Foto machen.');
    } catch (e) {
      console.error(e);
      setFehler('Das Bild ließ sich nicht lesen: ' + (e.message || e));
    } finally {
      setLaeuft(false);
      setStatus('');
    }
  }

  const titel = a.rezept ? 'Rezept fotografieren' : barcode ? 'Barcode scannen' : a.fuer ? 'Etikett scannen' : 'Nährwerttabelle fotografieren';
  return html`
    <${Page} titel=${titel} zurueck=${vm.zurueck}
      unten=${html`
        ${!a.rezept && html`<div class="reihe">
          <${Chip} an=${barcode} onClick=${() => { fertigRef.current = false; setBarcode(true); }}>▥ Barcode<//>
          <${Chip} an=${!barcode} onClick=${() => setBarcode(false)}>📄 Nährwerttabelle<//>
        </div>`}
        <div class="reihe">
          <${Knopf} deaktiviert=${laeuft} onClick=${() => fotoRef.current.click()}>📷 Foto aufnehmen<//>
          <${Knopf} art="umriss" deaktiviert=${laeuft} onClick=${() => galerieRef.current.click()}>🖼 Aus Fotos<//>
        </div>`}>
      <input ref=${fotoRef} type="file" accept="image/*" capture="environment" hidden onChange=${(e) => { foto(e.target.files[0]); e.target.value = ''; }} />
      <input ref=${galerieRef} type="file" accept="image/*" hidden onChange=${(e) => { foto(e.target.files[0]); e.target.value = ''; }} />
      ${barcode && html`
        <div class="kamera"><video ref=${video} playsinline muted></video><div class="kamera-linie"></div></div>
        <${Klein}>Barcode in den roten Streifen halten. Gefunden wird er von selbst.<//>`}
      ${!barcode && html`
        <${Abschnitt}>
          ${a.rezept
            ? html`<p>Fotografiere die Zutatenliste. Zubereitungstext stört nicht. Mehrere Seiten gehen nacheinander.</p>`
            : html`<p>Fotografiere die Nährwerttabelle möglichst gerade und formatfüllend, gut beleuchtet. Gelesen wird die Spalte „pro 100 g/ml“.</p>
              ${a.fuer && html`<p>Bei Supplements auch die Tabelle mit Vitaminen und Wirkstoffen. Name, Plan und Vorrat bleiben.</p>`}`}
          <${Klein} leise>Die Texterkennung läuft auf dem Handy, das Foto verlässt es nicht. Der erste Scan dauert etwas länger.<//>
        <//>`}
      ${status && html`<div class="status"><span class="kreisel"></span>${status}</div>`}
      ${fehler && html`<${Hinweis}>${fehler}<//>`}
    <//>`;
}

// ---------- Mahlzeiten ----------

let zuordnungCache = null;
async function zuordnung(s) {
  const t = await lebensmittel();
  const eigene = s.produkte.filter((p) => !(p.volProzent > 0));
  if (zuordnungCache && zuordnungCache.t === t && zuordnungCache.p === s.produkte) return zuordnungCache.z;
  const z = new L.Zuordnung([...t.lebensmittel, ...eigene.map(L.produktAlsLebensmittel)]);
  zuordnungCache = { t, p: s.produkte, z };
  return z;
}

function zeigen(vm, m, ersetzen = true) {
  vm.setMahlzeit(m);
  if (ersetzen) vm.ersetzen({ typ: 'mahlzeitPruefen' }); else vm.oeffnen({ typ: 'mahlzeitPruefen' });
  const offen = m.zeilen.filter((z) => !z.lebensmittel).length;
  if (!m.zeilen.length) vm.meldung('Es wurden keine Zutaten erkannt. Du kannst sie unten einzeln hinzufügen.');
  else if (offen) vm.meldung(offen === 1 ? 'Eine Zeile wurde nicht zugeordnet. Tippe sie an, um selbst zu suchen.' : `${offen} Zeilen wurden nicht zugeordnet. Tippe sie an, um selbst zu suchen.`);
}

async function rezeptGelesen(vm, boxen, a) {
  const zeilen = L.Zutaten.ausFoto(boxen);
  const zutaten = L.Zutaten.zutatenZeilen(zeilen);
  const z = await zuordnung(vm.s);
  const neu = z.rezept(zutaten);
  const portionen = L.Zutaten.portionen(zeilen);
  if (a.anhaengen && vm.ui.mahlzeit) {
    vm.setMahlzeit((m) => ({ ...m, zeilen: [...m.zeilen, ...neu], portionen: m.portionen === 1 ? portionen ?? 1 : m.portionen }));
    vm.zurueck();
    vm.meldung(neu.length ? `${neu.length} Zutaten ergänzt.` : 'Auf dem Foto wurden keine Zutaten erkannt.');
    return;
  }
  if (!zeilen.length) { vm.meldung('Auf dem Bild wurde kein Text gefunden. Bitte näher heran und scharf stellen.'); return; }
  let erste = zeilen.findIndex((x) => zutaten.includes(x));
  if (erste < 0) erste = zeilen.length;
  const titel = zeilen.slice(0, erste).find((x) => (x.match(/\p{L}/gu) || []).length >= 3 && x.length <= 40 && !L.Zutaten.normal(x).startsWith('zutaten') && L.Zutaten.portionen([x]) == null) || '';
  zeigen(vm, { name: titel, zeilen: neu, portionen: portionen ?? 1, rezept: true, eintragen: a.eintragen, garGewicht: 0 });
}

function MahlzeitStart({ vm, a }) {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [rezept, setRezept] = useState('');
  const [info, setInfo] = useState(null);
  const [laeuft, setLaeuft] = useState(false);
  useEffect(() => { lebensmittel().then((t) => setInfo(t)).catch(() => setInfo(false)); }, []);

  async function freitext() {
    setLaeuft(true);
    const z = await zuordnung(vm.s);
    setLaeuft(false);
    const t = text.trim();
    zeigen(vm, { name: t.charAt(0).toUpperCase() + t.slice(1), zeilen: z.freitext(t), portionen: 1, rezept: false, eintragen: a.eintragen, garGewicht: 0 });
  }
  async function rezeptUebernehmen() {
    const zeilen = rezept.split('\n').filter((x) => x.trim());
    setLaeuft(true);
    const z = await zuordnung(vm.s);
    setLaeuft(false);
    const r = z.rezept(zeilen.filter((x) => !L.Zutaten.normal(x).startsWith('zutaten') && L.Zutaten.portionen([x]) == null));
    zeigen(vm, { name: name.trim(), zeilen: r, portionen: L.Zutaten.portionen(zeilen) ?? 1, rezept: true, eintragen: a.eintragen, garGewicht: 0 });
  }

  return html`
    <${Page} titel="Mahlzeit schätzen" zurueck=${vm.zurueck}>
      <${Abschnitt} titel="Was hast du gegessen?">
        <${Eingabe} label="z. B. Döner mit Pommes und eine Cola" wert=${text} onInput=${setText} hilfe="Mehrere Teile mit „und“, „mit“ oder Komma trennen. Mengen wie „2 Scheiben“ oder „300 g“ gehen auch." />
        <${Knopf} deaktiviert=${!text.trim() || laeuft} onClick=${freitext}>Schätzen<//>
      <//>
      <${Abschnitt} titel="Rezept">
        <${Klein}>Zutaten fotografieren oder eintippen. Daraus wird ein Produkt mit Nährwerten pro Portion.<//>
        <${Knopf} art="umriss" onClick=${() => vm.oeffnen({ typ: 'scan', rezept: true, barcode: false, eintragen: a.eintragen, schluessel: neueId() })}>📷 Rezept fotografieren<//>
        <${Eingabe} label="Name (z. B. Pfannkuchen)" wert=${name} onInput=${setName} />
        <${Eingabe} label="Zutaten, eine pro Zeile" wert=${rezept} onInput=${setRezept} mehrzeilig hilfe="z. B. „250 g Mehl“, „3 Eier“, „1 Prise Salz“. „Für 4 Portionen“ wird erkannt." />
        <${Knopf} deaktiviert=${!rezept.trim() || laeuft} onClick=${rezeptUebernehmen}>Zutaten übernehmen<//>
      <//>
      ${laeuft && html`<div class="status"><span class="kreisel"></span>Lebensmittel-Tabelle wird geladen …</div>`}
      ${info && html`<${Klein} leise>Nährwerte: ${info.quelle} (${Format.tausend(info.lebensmittel.length)} Lebensmittel und Gerichte).<//>`}
      ${info === false && html`<${Hinweis}>Die Lebensmittel-Tabelle ließ sich nicht laden. Einmal mit Internet öffnen, danach geht es offline.<//>`}
    <//>`;
}

function MahlzeitPruefen({ vm }) {
  const m = vm.ui.mahlzeit;
  const [neu, setNeu] = useState('');
  const [wahl, setWahl] = useState(null);
  if (!m) return html`<${Page} titel="Mahlzeit" zurueck=${vm.zurueck}><${Leer}>Nichts zu prüfen.<//><//>`;
  const set = (f) => vm.setMahlzeit((x) => ({ ...x, ...f(x) }));
  const summe = L.Mahlzeiten.summe(m.zeilen);
  const gesamt = Math.max(1, m.rezept && m.garGewicht > 0 ? m.garGewicht : L.Mahlzeiten.gewicht(m.zeilen));
  const portion = gesamt / Math.max(1, m.portionen);
  const p = L.nwMal(summe, portion / gesamt);
  const ok = m.zeilen.some((z) => z.lebensmittel && z.gramm > 0);

  function speichern(eintragen) {
    if (!ok) { vm.meldung('Es ist noch keine Zutat mit Menge zugeordnet.'); return; }
    const prod = { ...L.Mahlzeiten.alsProdukt(m.name, m.zeilen, m.portionen, m.rezept && m.garGewicht > 0 ? m.garGewicht : null), id: neueId() };
    vm.aendern((x) => S.speichern(x, prod));
    vm.setMahlzeit(null);
    vm.fertig();
    if (eintragen) setTimeout(() => vm.oeffnen({ typ: 'eintragen', produktId: prod.id }));
    else vm.meldung(`„${prod.name}“ ist jetzt unter Produkte gespeichert.`);
  }
  async function hinzufuegen() {
    const z = L.Zutaten.lesen(neu);
    if (!z) return;
    const zo = await zuordnung(vm.s);
    set((x) => ({ zeilen: [...x.zeilen, zo.zeile(z, x.rezept)] }));
    setNeu('');
  }

  return html`
    <${Page} titel=${m.rezept ? 'Rezept prüfen' : 'Mahlzeit prüfen'} zurueck=${vm.zurueck}
      unten=${m.eintragen
        ? html`<${Knopf} deaktiviert=${!ok} onClick=${() => speichern(true)}>Speichern und eintragen<//><${Knopf} art="umriss" klasse="flach" deaktiviert=${!ok} onClick=${() => speichern(false)}>Nur als Produkt speichern<//>`
        : html`<${Knopf} deaktiviert=${!ok} onClick=${() => speichern(false)}>Als Produkt speichern<//>`}>
      <${Eingabe} label="Name" wert=${m.name} onInput=${(v) => set(() => ({ name: v }))} />
      ${m.zeilen.map((z, i) => html`
        <div class="karte mahlzeit-zeile" key=${i + z.zutat.original}>
          <div class="reihe-text">
            <span class="klein">„${z.zutat.original}“</span>
            <button class="knopf text" aria-label="Zeile entfernen" onClick=${() => set((x) => ({ zeilen: x.zeilen.filter((_, j) => j !== i) }))}>✕</button>
          </div>
          <button class="lm-wahl" onClick=${() => setWahl(i)}>
            ${z.lebensmittel ? html`<span>${z.lebensmittel.name}</span><span class="klein">${Format.zahl((z.lebensmittel.naehrwerte.kcal * z.gramm) / 100, 0)} kcal · antippen zum Ändern</span>`
              : html`<span class="rot">Nicht gefunden – antippen zum Suchen</span>`}
          </button>
          ${z.lebensmittel && html`<${ZahlFeld} label=${`Menge (${z.lebensmittel.fluessig ? 'ml' : 'g'})`} wert=${Math.round(z.gramm * 10) / 10} onWert=${(v) => set((x) => ({ zeilen: x.zeilen.map((y, j) => (j === i ? { ...y, gramm: v } : y)) }))} />`}
        </div>`)}
      <div class="reihe-feld">
        <${Eingabe} label=${m.rezept ? 'Zutat hinzufügen, z. B. 100 g Reis' : 'Hinzufügen, z. B. Salat'} wert=${neu} onInput=${setNeu} />
        <button class="knopf umriss rund" disabled=${!neu.trim()} onClick=${hinzufuegen}>+</button>
      </div>
      ${m.rezept && html`
        <${Knopf} art="umriss" onClick=${() => vm.oeffnen({ typ: 'scan', rezept: true, barcode: false, anhaengen: true, eintragen: m.eintragen, schluessel: neueId() })}>📷 Weitere Seite fotografieren<//>
        <${Zaehler} label="Portionen" wert=${m.portionen} minus=${() => set((x) => ({ portionen: Math.max(1, x.portionen - 1) }))} plus=${() => set((x) => ({ portionen: Math.min(50, x.portionen + 1) }))} minusAn=${m.portionen > 1} plusAn=${m.portionen < 50} />
        <${ZahlFeld} label="Gewicht nach dem Kochen (g, optional)" wert=${m.garGewicht} onWert=${(v) => set(() => ({ garGewicht: v }))} hilfe="Wasser verdampft beim Kochen oder kommt dazu (Nudeln, Reis). Gewogen wird das ganze Rezept." />`}
      <${Abschnitt} titel=${m.portionen > 1 ? `Pro Portion (${Format.zahl(portion, 0)} g)` : `Gesamt (${Format.zahl(gesamt, 0)} g)`}>
        <div class="gross-wert">${Format.zahl(p.kcal, 0)} kcal</div>
        <p>Eiweiß ${Format.zahl(p.eiweiss)} g · Kohlenhydrate ${Format.zahl(p.kohlenhydrate)} g · Fett ${Format.zahl(p.fett)} g</p>
        <${Klein}>Zucker ${Format.zahl(p.zucker)} g · Ballaststoffe ${Format.zahl(p.ballaststoffe)} g · Salz ${Format.zahl(p.salz)} g<//>
        ${m.portionen > 1 && html`<${Klein}>Ganzes Rezept: ${Format.zahl(summe.kcal, 0)} kcal, ${Format.zahl(gesamt, 0)} g<//>`}
      <//>
      <${Klein} leise>Nährwerte aus dem Bundeslebensmittelschlüssel 4.0 (Max Rubner-Institut), Durchschnittswerte.<//>
      ${wahl != null && html`<${LebensmittelWahl} vm=${vm} zeile=${m.zeilen[wahl]} roh=${m.rezept}
        onWahl=${(l) => { set((x) => ({ zeilen: x.zeilen.map((y, j) => (j === wahl ? { ...y, lebensmittel: l, gramm: L.Mengen.gramm(y.zutat, l), alternativen: [y.lebensmittel, ...y.alternativen].filter((a) => a && a !== l) } : y)) })); setWahl(null); }}
        onAbbruch=${() => setWahl(null)} />`}
    <//>`;
}

function LebensmittelWahl({ vm, zeile, roh, onWahl, onAbbruch }) {
  const [suche, setSuche] = useState(zeile.zutat.text);
  const [treffer, setTreffer] = useState([]);
  useEffect(() => {
    let aus = false;
    const t = setTimeout(async () => {
      const z = await zuordnung(vm.s);
      if (aus) return;
      if (!suche.trim()) { setTreffer([zeile.lebensmittel, ...zeile.alternativen].filter(Boolean)); return; }
      const code = L.Suchtext.barcode(suche);
      const lokal = code ? [] : z.suchen(suche, 30, roh);
      setTreffer(lokal);
      const db = await dbNamenSuchen(suche, 15).catch(() => []);
      if (!aus) setTreffer([...lokal, ...db.map(dbAlsLebensmittel)]);
    }, 250);
    return () => { aus = true; clearTimeout(t); };
  }, [suche]);
  return html`
    <${Dialog} nein=${onAbbruch}>
      <h2>Lebensmittel wählen</h2>
      <${Eingabe} label="Suchen" wert=${suche} onInput=${setSuche} autofocus />
      ${!treffer.length && html`<${Klein}>Nichts gefunden. Anders schreiben, z. B. „Hähnchen“ statt „Chicken“, oder Marke und Name aus der Barcode-Datenbank.<//>`}
      <div class="wahl-liste">
        ${treffer.map((l) => html`<button class="wahl" onClick=${() => onWahl(l)}><span>${l.name}</span><span class="klein">${l.gruppe} · ${Format.zahl(l.naehrwerte.kcal, 0)} kcal/100 ${l.fluessig ? 'ml' : 'g'}</span></button>`)}
      </div>
    <//>`;
}

// ---------- Profil ----------

async function sicherungSpeichern(vm) {
  if (await dateiSichern({ food: vm.s })) vm.sicherungGespeichert();
}

function SicherungLaden({ vm }) {
  const ref = useRef();
  async function laden(datei) {
    if (!datei) return;
    try { vm.sicherungAnbieten(await dateiLesen(datei)); } catch (e) { vm.meldung('Die Datei ließ sich nicht lesen: ' + e.message); }
  }
  return html`
    <input ref=${ref} type="file" accept="application/json,.json,text/plain" hidden onChange=${(e) => { laden(e.target.files[0]); e.target.value = ''; }} />
    <${Knopf} art="umriss" onClick=${() => ref.current.click()}>Sicherung laden<//>`;
}

function ProfilTab({ vm }) {
  const k = vm.s.koerper, e = vm.s.einstellungen;
  const jahr = new Date().getFullYear();
  const ziele = Ziele.berechnen(k, e, jahr);
  const [db, setDb] = useState(null);
  const [bls, setBls] = useState(null);
  const [dauerhaft, setDauerhaft] = useState(null);
  const [zuruecksetzen, setZuruecksetzen] = useState(false);
  useEffect(() => {
    dbInfo().then(setDb);
    lebensmittel().then(setBls).catch(() => setBls(false));
    navigator.storage?.persisted?.().then(setDauerhaft).catch(() => {});
  }, []);
  const E = (f) => vm.einstellungen((x) => ({ ...x, ...f }));
  const t = vm.letzteSicherung;

  return html`
    <${Page} titel="Profil und Rechnung">
      <${Abschnitt} titel="Körper">
        <p>${profilKurz(k)}${k.kfaProzent > 0 ? ` · KFA ${Format.zahl(k.kfaProzent)} %` : ''}</p>
        <${Klein}>Gemeinsames Profil für Training und Food & Boost.<//>
        <${Knopf} art="umriss" onClick=${vm.profilOeffnen}>👤 Profil ändern<//>
      <//>
      <${Hinweis} art="info">🔔 Erinnerungen an den Einnahmeplan per Benachrichtigung gibt es leider nur in der Android-App. Im Browser auf dem iPhone geht das nicht ohne Server, darum hier bitte selbst unter „Boost“ abhaken.<//>
      <${Abschnitt} titel="Sicherung">
        <${Klein}>Alles (Einträge, Produkte, Einstellungen und die Trainings) als eine Datei, z. B. in „Dateien“ oder iCloud. Damit geht es auch auf ein neues Handy. Sicherungen der Android-App lassen sich laden.<//>
        <${Klein}>${t ? `Letzte Sicherung: ${new Date(t).toLocaleDateString('de-DE')}.` : 'Noch keine Sicherung gemacht.'} Safari löscht Daten von Web-Apps, die einige Wochen nicht geöffnet wurden. Darum ab und zu sichern.<//>
        ${dauerhaft === true && html`<${Klein} leise>Der Browser hat zugesagt, die Daten nicht von selbst zu löschen.<//>`}
        <div class="reihe">
          <${Knopf} art="umriss" onClick=${() => sicherungSpeichern(vm)}>Speichern<//>
          <${SicherungLaden} vm=${vm} />
        </div>
      <//>
      <${Abschnitt} titel="Alkohol">
        <${Auswahl} label="Körperwasser" optionen=${['WATSON', 'KFA']} wert=${e.wasserMethode} text=${(m) => L.WasserMethode[m]} onWahl=${(m) => E({ wasserMethode: m })} />
        <${Klein}>Körperwasser ${Format.zahl(Pegel.koerperwasser(k, e, jahr))} l, Verteilungsfaktor r = ${Format.zahl(Pegel.rFaktor(k, e, jahr), 2)} (üblich pauschal 0,7 für Männer, 0,6 für Frauen). Ein Bier 0,5 l bringt ohne Abbau etwa ${Format.promille(Pegel.alkoholGramm(500, 4.9) * Pegel.promilleProGramm(k, e, jahr))}.<//>
        <${Klein} leise>Watson ist vorsichtiger. „Aus Körperfettanteil“ rechnet bei viel Muskeln mehr Wasser und damit niedrigere Werte; das stimmt nur, wenn der Körperfettanteil wirklich so niedrig ist.<//>
        <${ZahlFeld} label="Abbau (‰ pro Stunde)" wert=${e.abbauPromilleProH} onWert=${(v) => E({ abbauPromilleProH: v })} hilfe="Üblich 0,1 bis 0,2; vorsichtig 0,1." />
        <${ZahlFeld} label="Resorptionsdefizit (%)" wert=${e.resorptionsdefizitProzent} onWert=${(v) => E({ resorptionsdefizitProzent: Math.min(50, v) })} hilfe="Anteil, der nie ins Blut gelangt (10 bis 30 %). 0 = vorsichtig." />
        <${ZahlFeld} label="Aufnahme dauert (min)" wert=${e.alkoholAufnahmeMin} onWert=${(v) => E({ alkoholAufnahmeMin: Math.round(v) })} hilfe="Mit Essen doppelt so lange." />
      <//>
      <${Abschnitt} titel="Koffein">
        <${ZahlFeld} label="Halbwertszeit (h)" wert=${e.koffeinHalbwertszeitH} onWert=${(v) => E({ koffeinHalbwertszeitH: v })} hilfe="Meist 3 bis 7 h; länger z. B. mit hormoneller Verhütung, kürzer bei Rauchern." />
        <${ZahlFeld} label="Aufnahme dauert (min)" wert=${e.koffeinAufnahmeMin} onWert=${(v) => E({ koffeinAufnahmeMin: Math.round(v) })} />
        <${ZahlFeld} label="Grenze für den Schlaf (mg)" wert=${e.koffeinSchlafgrenzeMg} onWert=${(v) => E({ koffeinSchlafgrenzeMg: v })} />
        <${ZahlFeld} label="Höchstens pro Tag (mg)" wert=${e.koffeinTageslimitMg} onWert=${(v) => E({ koffeinTageslimitMg: v })} hilfe="EFSA: 400 mg für Erwachsene, 200 mg in der Schwangerschaft." />
      <//>
      <${Abschnitt} titel="Tagesziele">
        <${Klein}>Grundumsatz ${Format.zahl(ziele.grundumsatz, 0)} kcal (Mifflin-St Jeor). Ziel ${Format.zahl(ziele.kcal, 0)} kcal: Eiweiß ${Format.zahl(ziele.eiweiss, 0)} g, Kohlenhydrate ${Format.zahl(ziele.kohlenhydrate, 0)} g, Fett ${Format.zahl(ziele.fett, 0)} g.<//>
        <${ZahlFeld} label="Aktivitätsfaktor" wert=${e.aktivitaetsfaktor} onWert=${(v) => E({ aktivitaetsfaktor: v })} hilfe="1,2 sitzend · 1,4 leicht · 1,6 aktiv · 1,7 sehr sportlich · 1,9 Leistungssport" />
        <${Schalter} label="Trainings einrechnen" an=${e.trainingEinrechnen} onWechsel=${(v) => E({ trainingEinrechnen: v })}
          hilfe="Dann gilt für den Alltag der Faktor unten, und jedes Training aus dem Bereich Training kommt mit seinem geschätzten Verbrauch dazu." />
        ${e.trainingEinrechnen && html`<${ZahlFeld} label="Faktor ohne Training" wert=${e.grundfaktorMitTraining} onWert=${(v) => E({ grundfaktorMitTraining: v })} hilfe="1,4 Bürojob · 1,5 viel auf den Beinen. Ersetzt den Aktivitätsfaktor." />`}
        <${ZahlFeld} label="Trinken (ml pro kg)" wert=${e.trinkenMlProKg} onWert=${(v) => E({ trinkenMlProKg: v })} hilfe="Etwa 35." />
        <${ZahlFeld} label="Kalorienziel fest (kcal)" wert=${e.kcalZielManuell} onWert=${(v) => E({ kcalZielManuell: v })} hilfe="Leer = aus Grundumsatz × Aktivitätsfaktor. Für Aufbau etwa +300, für Diät etwa −500." />
        <${ZahlFeld} label="Eiweiß (g pro kg)" wert=${e.eiweissProKg} onWert=${(v) => E({ eiweissProKg: v })} hilfe="Allgemein 0,8 bis 1,0; Kraftsport 1,6 bis 2,2." />
        <${ZahlFeld} label="Fett (% der Energie)" wert=${e.fettAnteilProzent} onWert=${(v) => E({ fettAnteilProzent: Math.min(80, v) })} />
        <${ZahlFeld} label="Ballaststoffe (g)" wert=${e.ballaststoffZielG} onWert=${(v) => E({ ballaststoffZielG: v })} />
      <//>
      <${Abschnitt} titel="Mitgelieferte Daten">
        <${Klein}>Barcodes: ${db ? `${Format.tausend(db.anzahl)} Produkte, Stand ${db.stand}. Quelle: Open Food Facts (ODbL), Deutschland.` : 'wird geladen …'}<//>
        <${Klein}>Mahlzeiten: ${bls ? `${Format.tausend(bls.lebensmittel.length)} Lebensmittel und Gerichte. Quelle: ${bls.quelle}.` : bls === false ? 'nicht geladen (einmal mit Internet öffnen).' : 'wird geladen …'}<//>
        <${Klein} leise>Food & Boost ${VERSION} · Texterkennung Tesseract, Barcode ZXing, Schrift Nunito (OFL). Alles läuft auf dem Gerät.<//>
      <//>
      <${Knopf} art="umriss" onClick=${() => { vm.koerper(() => L.koerper({ ...k })); vm.einstellungen(() => L.einstellungen()); }}>Rechnung auf Standard zurücksetzen<//>
      <${Knopf} art="umriss" klasse="gefahr" onClick=${() => setZuruecksetzen(true)}>Alle Daten löschen<//>
      <${SchaetzHinweis} />
      ${zuruecksetzen && html`<${Dialog} text="Wirklich alle Einträge, Produkte und Einstellungen löschen? Das lässt sich nicht rückgängig machen. Vorher sichern?"
        jaText="Alles löschen" ja=${() => { vm.aendern(() => L.neuerStand()); setZuruecksetzen(false); vm.tab('pegel'); }} nein=${() => setZuruecksetzen(false)} />`}
    <//>`;
}

