// Oberfläche des Trainings (Port von features/krafttraining/ui der Android-App): Tabs Training, Verlauf, Muskeln, Daten
// und darüber ein Stapel von Ansichten (Training bearbeiten, Übung wählen, Übung, Import …).
import { useState, useEffect, useMemo, useRef } from '../vendor/preact-htm.js';
import * as T from './training-logik.js';
import { Format, Rechnung, Belastung, Muskel, MUSKELN, Messart, MESSARTEN, SatzTyp, SATZTYPEN, FELDER, Import, Anleitung, anzahl, muskelText } from './training-logik.js';
import { trainingLaden, trainingSpeichern, standLaden, meta, dauerhaftBitten } from './speicher.js';
import { sicherungSpeichern, dateiLesen, inhaltText, uebernehmen } from './sicherung.js';
import { html, Page, Abschnitt, Hinweis, Klein, Leer, Knopf, Eingabe, ZahlFeld, Auswahl, Schalter, Zaehler, Chip, Dialog } from './teile.js';

const TAG = 86_400_000;
const neueId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, '').slice(0, 16);

const TABS = [
  { id: 'start', titel: 'Start', symbol: '🏠' },
  { id: 'training', titel: 'Training', symbol: '🏋️' },
  { id: 'verlauf', titel: 'Verlauf', symbol: '📈' },
  { id: 'muskeln', titel: 'Muskeln', symbol: '💪' },
  { id: 'daten', titel: 'Daten', symbol: '⇅' },
];

function uhr(sek) {
  const s = Math.max(0, Math.floor(sek));
  const z = (n) => String(n).padStart(2, '0');
  return s >= 3600 ? `${Math.floor(s / 3600)}:${z(Math.floor((s % 3600) / 60))}:${z(s % 60)}` : `${Math.floor(s / 60)}:${z(s % 60)}`;
}

function montag(ms = Date.now()) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** Kurzer Ton am Ende der Pause (Safari erlaubt Ton nur nach einer Berührung, das ist beim Abhaken gegeben). */
let audio = null;
function piep() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.25, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.4);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.4);
    navigator.vibrate?.([120, 80, 120]);
  } catch { /* ohne Ton */ }
}

// ---------- App ----------

export function TrainingApp({ zurUebersicht }) {
  const [stand, setStand] = useState(null);
  const [foodKg, setFoodKg] = useState(0);
  const [ui, setUi] = useState({ tab: 'training', stapel: [], jetzt: Date.now(), entwurf: null, uebungEntwurf: null, pauseBis: 0, import: null, laedt: false, sicherung: null, zeitraum: 7, meldung: null });
  const standRef = useRef(null);
  const uiRef = useRef(ui);
  uiRef.current = ui;
  standRef.current = stand;

  useEffect(() => {
    trainingLaden().then(setStand);
    standLaden().then((f) => setFoodKg(f.eingerichtet ? f.koerper.gewichtKg : 0));
    const pop = () => {
      if (uiRef.current.stapel.length) setUi((u) => zurueckUi(u));
      else zurUebersicht();
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);

  // Uhr: sekündlich während eines Trainings (Dauer, Pause), sonst halbminütlich (Erholung).
  const laeuft = !!stand?.laufend;
  useEffect(() => {
    const t = setInterval(() => setUi((u) => ({ ...u, jetzt: Date.now() })), laeuft ? 1000 : 30_000);
    return () => clearInterval(t);
  }, [laeuft]);

  // Ton, wenn die Pause abgelaufen ist.
  const pauseRef = useRef(0);
  useEffect(() => {
    if (ui.pauseBis && ui.jetzt >= ui.pauseBis && pauseRef.current !== ui.pauseBis) { pauseRef.current = ui.pauseBis; piep(); }
  }, [ui.jetzt, ui.pauseBis]);

  if (!stand) return html`<div class="laden">Lädt …</div>`;

  const aendern = (f) => {
    const neu = f(standRef.current);
    standRef.current = neu;
    setStand(neu);
    trainingSpeichern(neu);
  };
  const upd = (f) => setUi((u) => ({ ...u, ...f(u) }));
  const s = stand;
  const ansicht = ui.stapel[ui.stapel.length - 1] || null;
  const uebungen = T.uebungMap(s);
  const koerper = T.koerperKg(s, foodKg);
  const editorLaufend = () => { const e = [...uiRef.current.stapel].reverse().find((a) => a.typ === 'editor'); return !e || e.laufend; };
  const aktuell = () => (editorLaufend() ? standRef.current.laufend : uiRef.current.entwurf);

  const vm = {
    s, ui, ansicht, uebungen, koerper, foodKg, aendern,
    tab: (tab) => (tab === 'start' ? zurUebersicht() : upd(() => ({ tab, stapel: [] }))),
    oeffnen: (a) => { history.pushState({ n: uiRef.current.stapel.length + 1 }, ''); upd((u) => ({ stapel: [...u.stapel, a] })); },
    zurueck: () => upd((u) => zurueckUi(u)),
    meldung: (text) => upd(() => ({ meldung: text })),
    zeitraum: (t) => upd(() => ({ zeitraum: t })),
    einstellungen: (f) => aendern((x) => ({ ...x, einstellungen: { ...x.einstellungen, ...f(x.einstellungen) } })),

    // Training
    trainingStarten(vorlage) {
      if (!standRef.current.laufend) {
        const w = T.workout({
          id: neueId(), name: vorlage?.name || 'Training', start: Date.now(),
          bloecke: (vorlage?.bloecke || []).map((b) => ({ ...b, notiz: '', saetze: b.saetze.map((x) => ({ ...x, erledigt: false, rpe: null })) })),
        });
        aendern((x) => ({ ...x, laufend: w }));
        dauerhaftBitten();
      }
      history.pushState({ n: 1 }, '');
      upd(() => ({ tab: 'training', stapel: [{ typ: 'editor', laufend: true }] }));
    },
    workoutBearbeiten(id) {
      const w = standRef.current.workouts.find((x) => x.id === id);
      if (!w) return;
      upd(() => ({ entwurf: w }));
      vm.oeffnen({ typ: 'editor', laufend: false });
    },
    bearbeite(f) {
      if (editorLaufend()) { const w = standRef.current.laufend; if (w) aendern((x) => ({ ...x, laufend: f(w) })); }
      else upd((u) => ({ entwurf: u.entwurf && f(u.entwurf) }));
    },
    block: (i, f) => vm.bearbeite((w) => ({ ...w, bloecke: w.bloecke.map((b, j) => (j === i ? f(b) : b)) })),
    satzAendern: (b, i, satz) => vm.block(b, (bl) => ({ ...bl, saetze: bl.saetze.map((x, j) => (j === i ? satz : x)) })),
    satzAbhaken(b, i) {
      const w = aktuell();
      const satz = w?.bloecke[b]?.saetze[i];
      if (!satz) return;
      vm.satzAendern(b, i, { ...satz, erledigt: !satz.erledigt });
      const pause = standRef.current.einstellungen.pauseSek;
      if (editorLaufend() && !satz.erledigt && pause > 0) upd(() => ({ pauseBis: Date.now() + pause * 1000, jetzt: Date.now() }));
    },
    pauseAendern: (sek) => upd((u) => ({ pauseBis: sek === 0 ? 0 : Math.max(u.pauseBis, Date.now()) + sek * 1000, jetzt: Date.now() })),
    satzHinzu: (b) => vm.block(b, (bl) => {
      const l = bl.saetze[bl.saetze.length - 1];
      const neu = l ? { ...l, erledigt: !editorLaufend(), typ: 'NORMAL', rpe: null } : T.satz({ erledigt: !editorLaufend() });
      return { ...bl, saetze: [...bl.saetze, neu] };
    }),
    satzLoeschen: (b, i) => vm.block(b, (bl) => ({ ...bl, saetze: bl.saetze.filter((_, j) => j !== i) })),
    blockNotiz: (b, text) => vm.block(b, (bl) => ({ ...bl, notiz: text })),
    blockLoeschen: (b) => vm.bearbeite((w) => ({ ...w, bloecke: w.bloecke.filter((_, j) => j !== b) })),
    blockVerschieben: (b, hoch) => vm.bearbeite((w) => {
      const z = hoch ? b - 1 : b + 1;
      if (z < 0 || z >= w.bloecke.length) return w;
      const l = [...w.bloecke];
      l.splice(z, 0, l.splice(b, 1)[0]);
      return { ...w, bloecke: l };
    }),
    uebungHinzu(id) {
      const w = aktuell();
      if (!w) return;
      const lauf = editorLaufend();
      let vorschlag = Rechnung.letzteSaetze(id, standRef.current.workouts, w.start).filter(Rechnung.zaehlt).map((x) => ({ ...x, erledigt: !lauf, rpe: null }));
      if (!vorschlag.length) vorschlag = [T.satz({ erledigt: !lauf })];
      vm.bearbeite((x) => ({ ...x, bloecke: [...x.bloecke, { uebungId: id, saetze: vorschlag, notiz: '' }] }));
      if (uiRef.current.stapel[uiRef.current.stapel.length - 1]?.typ === 'uebungWaehlen') history.back();
    },
    trainingName: (name) => vm.bearbeite((w) => ({ ...w, name })),
    trainingNotiz: (notiz) => vm.bearbeite((w) => ({ ...w, notiz })),
    trainingBeenden() {
      const w = standRef.current.laufend;
      if (!w) return;
      const fertig = {
        ...w,
        dauerSek: Math.max(0, Math.round((Date.now() - w.start) / 1000)),
        bloecke: w.bloecke.map((b) => ({ ...b, saetze: b.saetze.filter((x) => x.erledigt) })).filter((b) => b.saetze.length),
      };
      if (!fertig.bloecke.length) { vm.meldung('Noch kein Satz abgehakt. Hake erledigte Sätze mit ✓ ab oder verwirf das Training.'); return; }
      aendern((x) => ({ ...x, laufend: null, workouts: [...x.workouts, fertig].sort((a, b) => a.start - b.start) }));
      const rek = Rechnung.neueRekorde(fertig, standRef.current.workouts, uebungen, koerper);
      const z = Rechnung.zusammenfassung(fertig, uebungen, koerper);
      upd(() => ({
        stapel: [{ typ: 'workout', id: fertig.id }], pauseBis: 0,
        meldung: `Training gespeichert: ${anzahl(z.saetze, 'Satz', 'Sätze')}, ${Format.kg(z.volumen)} Volumen.` + (rek.length ? `\n\nNeue Bestwerte 🏆\n${rek.map((r) => '• ' + r).join('\n')}` : ''),
      }));
    },
    trainingVerwerfen() { aendern((x) => ({ ...x, laufend: null })); upd(() => ({ stapel: [], pauseBis: 0 })); },
    entwurfSpeichern() {
      const e = uiRef.current.entwurf;
      if (!e) return;
      const b = { ...e, bloecke: e.bloecke.filter((x) => x.saetze.length) };
      aendern((x) => ({ ...x, workouts: x.workouts.map((w) => (w.id === e.id ? b : w)).sort((p, q) => p.start - q.start) }));
      upd((u) => ({ entwurf: null, stapel: u.stapel.slice(0, -1) }));
    },
    workoutLoeschen(id) {
      aendern((x) => ({ ...x, workouts: x.workouts.filter((w) => w.id !== id) }));
      upd((u) => ({ stapel: u.stapel.filter((a) => !(a.typ === 'workout' && a.id === id)) }));
    },

    // Übungen
    uebungNeu(name, insTraining) {
      upd(() => ({ uebungEntwurf: T.uebung({ id: 'e:' + neueId().slice(0, 8), name }) }));
      vm.oeffnen({ typ: 'uebungForm', neu: true, insTraining });
    },
    uebungBearbeiten(id) {
      const u = uebungen[id];
      if (!u) return;
      upd(() => ({ uebungEntwurf: u }));
      vm.oeffnen({ typ: 'uebungForm', neu: false, insTraining: false });
    },
    uebungEntwurf: (f) => upd((u) => ({ uebungEntwurf: u.uebungEntwurf && f(u.uebungEntwurf) })),
    uebungSpeichern() {
      const u = uiRef.current.uebungEntwurf;
      if (!u || !u.name.trim()) return;
      const fertig = { ...u, name: u.name.trim() };
      const form = uiRef.current.stapel[uiRef.current.stapel.length - 1];
      aendern((x) => ({ ...x, uebungen: [...x.uebungen.filter((y) => y.id !== fertig.id), fertig] }));
      upd((st) => ({ uebungEntwurf: null, stapel: st.stapel.slice(0, -1) }));
      if (form?.insTraining) {
        // Übung wählen schließen und die neue Übung ins Training.
        upd((st) => ({ stapel: st.stapel[st.stapel.length - 1]?.typ === 'uebungWaehlen' ? st.stapel.slice(0, -1) : st.stapel }));
        setTimeout(() => vm.uebungHinzu(fertig.id));
      }
    },
    uebungZuruecksetzen(id) {
      const genutzt = standRef.current.workouts.some((w) => w.bloecke.some((b) => b.uebungId === id));
      if (id.startsWith('e:') && genutzt) { vm.meldung('Die Übung steckt in Trainings und bleibt darum erhalten.'); return; }
      aendern((x) => ({ ...x, uebungen: x.uebungen.filter((u) => u.id !== id) }));
      upd((u) => ({ uebungEntwurf: null, stapel: u.stapel.slice(0, -1).filter((a) => !(id.startsWith('e:') && a.typ === 'uebung' && a.id === id)) }));
    },

    // Import
    async importDatei(datei) {
      if (!datei) return;
      upd(() => ({ laedt: true }));
      try {
        const roh = await datei.arrayBuffer();
        let text;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(roh); } catch { text = new TextDecoder('windows-1252').decode(roh); }
        vm.importLesen(text, null);
      } catch (e) {
        upd(() => ({ laedt: false, meldung: 'Die Datei ließ sich nicht lesen: ' + e.message }));
      }
    },
    importLesen(text, vorgabe) {
      const st = standRef.current;
      let lauf, fehler = null;
      try {
        const kopf = Import.kopf(text);
        const z = vorgabe || Import.erkenne(kopf);
        let ergebnis = null, doppelt = 0;
        try { ergebnis = Import.lese(text, st, z); doppelt = Import.uebernehmen(st, ergebnis)[1]; } catch (e) { fehler = e; }
        lauf = { text, kopf, zuordnung: z, ergebnis, doppelt };
      } catch (e) {
        upd(() => ({ laedt: false, meldung: 'Die Datei ließ sich nicht lesen: ' + e.message }));
        return;
      }
      const ohneZiel = uiRef.current.stapel.filter((a) => a.typ !== 'importVorschau' && a.typ !== 'importZuordnung');
      if (!lauf.kopf.length) upd(() => ({ laedt: false, meldung: 'Die Datei ist leer oder keine Tabelle.' }));
      else if (lauf.ergebnis) { history.pushState({}, ''); upd(() => ({ laedt: false, import: lauf, stapel: [...ohneZiel, { typ: 'importVorschau' }] })); }
      else {
        history.pushState({}, '');
        upd(() => ({
          laedt: false, import: lauf, stapel: [...ohneZiel, { typ: 'importZuordnung' }],
          meldung: ((fehler instanceof T.ImportFehler && fehler.message) || 'Die Datei ließ sich nicht auswerten.') + '\n\nOrdne die Spalten bitte selbst zu.',
        }));
      }
    },
    importZuordnung: (z) => upd((u) => ({ import: u.import && { ...u.import, zuordnung: z } })),
    importUebernehmen() {
      const e = uiRef.current.import?.ergebnis;
      if (!e) return;
      const [neu, doppelt] = Import.uebernehmen(standRef.current, e);
      aendern(() => neu);
      const ohne = e.ohneMuskeln.length;
      upd(() => ({
        import: null, stapel: [], tab: 'verlauf',
        meldung: `${e.workouts.length - doppelt} Trainings übernommen` + (doppelt ? `, ${doppelt} schon vorhandene übersprungen.` : '.') +
          (ohne ? `\n\n${ohne} Übungen haben noch keine Muskelgruppen. Du findest sie unter Verlauf und kannst sie dort zuordnen.` : ''),
      }));
      dauerhaftBitten();
    },
    importAbbrechen: () => upd((u) => ({ import: null, stapel: u.stapel.filter((a) => a.typ !== 'importVorschau' && a.typ !== 'importZuordnung') })),

    // Sicherung
    sicherungAnbieten: (x) => upd(() => ({ sicherung: x })),
  };

  return html`
    <div class="app">
      <div class="bildschirm">${bildschirm(vm, ansicht)}</div>
      ${!ansicht && html`
        <nav class="tabs">
          ${TABS.map((t) => html`<button class=${'tab' + (ui.tab === t.id ? ' an' : '')} onClick=${() => vm.tab(t.id)}>
            <span class="tab-symbol">${t.symbol}</span><span>${t.titel}</span></button>`)}
        </nav>`}
      ${ui.sicherung && html`<${Dialog} text=${`Sicherung übernehmen (${inhaltText(ui.sicherung)})? Der jetzige Stand wird dabei ersetzt.`}
        jaText="Übernehmen" nein=${() => upd(() => ({ sicherung: null }))}
        ja=${async () => {
          const x = ui.sicherung;
          upd(() => ({ sicherung: null }));
          await uebernehmen(x);
          if (x.training) { standRef.current = x.training; setStand(x.training); }
          if (x.food) setFoodKg(x.food.koerper.gewichtKg);
          upd(() => ({ stapel: [], meldung: 'Sicherung übernommen.' }));
        }} />`}
      ${ui.meldung && html`<${Dialog} ja=${() => upd(() => ({ meldung: null }))}><p class="mehrzeilig">${ui.meldung}</p><//>`}
    </div>`;
}

function zurueckUi(u) {
  const a = u.stapel[u.stapel.length - 1];
  if (!a) return u;
  const stapel = u.stapel.slice(0, -1);
  return {
    ...u, stapel,
    entwurf: a.typ === 'editor' && !a.laufend ? null : u.entwurf,
    uebungEntwurf: a.typ === 'uebungForm' ? null : u.uebungEntwurf,
    import: a.typ === 'importVorschau' && !stapel.some((x) => x.typ === 'importZuordnung') ? null : u.import,
  };
}

function bildschirm(vm, a) {
  if (!a) {
    switch (vm.ui.tab) {
      case 'verlauf': return html`<${VerlaufTab} vm=${vm} />`;
      case 'muskeln': return html`<${MuskelnTab} vm=${vm} />`;
      case 'daten': return html`<${DatenTab} vm=${vm} />`;
      default: return html`<${TrainingTab} vm=${vm} />`;
    }
  }
  switch (a.typ) {
    case 'editor': return html`<${EditorScreen} vm=${vm} laufend=${a.laufend} />`;
    case 'uebungWaehlen': return html`<${UebungWaehlen} vm=${vm} />`;
    case 'uebungForm': return html`<${UebungForm} vm=${vm} a=${a} />`;
    case 'uebung': return html`<${UebungDetail} key=${a.id} vm=${vm} id=${a.id} />`;
    case 'workout': return html`<${WorkoutDetail} key=${a.id} vm=${vm} id=${a.id} />`;
    case 'importVorschau': return html`<${ImportVorschau} vm=${vm} />`;
    case 'importZuordnung': return html`<${ImportZuordnung} vm=${vm} />`;
    case 'anleitung': return html`<${AnleitungScreen} vm=${vm} />`;
    default: return null;
  }
}

/** Schließt eine Ansicht, deren Daten fehlen (z. B. gelöschtes Training). */
function Weg({ vm }) {
  useEffect(() => { vm.zurueck(); }, []);
  return null;
}

// ---------- Tab Training ----------

function TrainingTab({ vm }) {
  const { s, ui, uebungen, koerper } = vm;
  const [alle, setAlle] = useState(false);
  const neueste = useMemo(() => [...s.workouts].sort((a, b) => b.start - a.start), [s.workouts]);
  const vorlagen = useMemo(() => {
    const ges = new Set();
    return neueste.filter((w) => { const k = w.name.trim().toLowerCase(); if (ges.has(k)) return false; ges.add(k); return true; }).slice(0, 6);
  }, [neueste]);
  const woche = montag(ui.jetzt);
  const diese = s.workouts.filter((w) => w.start >= woche);
  const saetze = diese.reduce((a, w) => a + Rechnung.zusammenfassung(w, uebungen, koerper).saetze, 0);
  const l = s.laufend;
  const zeigen = alle ? neueste : neueste.slice(0, 30);
  let monat = '';
  return html`
    <${Page} titel="Training">
      ${l ? html`<div class="karte laeuft">
          <h2>${l.name} läuft seit ${uhr((ui.jetzt - l.start) / 1000)}</h2>
          <${Knopf} onClick=${() => vm.trainingStarten()}>Weiter trainieren<//>
        </div>`
        : html`<${Knopf} onClick=${() => vm.trainingStarten()}>Leeres Training starten<//>`}
      <${Klein} leise>Diese Woche: ${anzahl(diese.length, 'Training', 'Trainings')}, ${anzahl(saetze, 'Satz', 'Sätze')}<//>
      ${vorlagen.length > 0 && !l && html`
        <h3 class="zwischen">Wiederholen</h3>
        <div class="quer">
          ${vorlagen.map((w) => html`<button class="karte vorlage" key=${w.id} onClick=${() => vm.trainingStarten(w)}>
            <strong>${w.name}</strong>
            <span class="klein">${w.bloecke.map((b) => uebungen[b.uebungId]?.name || '?').join(', ')}</span>
            <span class="klein stark-farbe">▶ starten</span>
          </button>`)}
        </div>`}
      <h3 class="zwischen">Verlauf</h3>
      ${!neueste.length && html`<${Leer}>Noch keine Trainings. Starte eins oder übernimm deine Daten unter „Daten“.<//>`}
      ${zeigen.map((w) => {
        const m = Format.monatJahr(w.start);
        const kopf = m !== monat;
        monat = m;
        return html`${kopf && html`<div class="monat">${m}</div>`}<${WorkoutKarte} key=${w.id} w=${w} vm=${vm} />`;
      })}
      ${!alle && neueste.length > 30 && html`<${Knopf} art="umriss" klasse="flach" onClick=${() => setAlle(true)}>Alle ${neueste.length} Trainings zeigen<//>`}
    <//>`;
}

function WorkoutKarte({ w, vm }) {
  const z = Rechnung.zusammenfassung(w, vm.uebungen, vm.koerper);
  return html`
    <button class="karte workout" onClick=${() => vm.oeffnen({ typ: 'workout', id: w.id })}>
      <span class="reihe-text"><strong class="ellipse">${w.name}</strong><span class="klein">${Format.datum(w.start)}</span></span>
      <span class="klein leise">${[w.dauerSek > 0 && Format.dauer(w.dauerSek), anzahl(z.saetze, 'Satz', 'Sätze'), z.volumen > 0 && Format.kg(z.volumen)].filter(Boolean).join(' · ')}</span>
      <span class="klein zweizeilig">${w.bloecke.map((b) => `${b.saetze.filter(Rechnung.zaehlt).length}× ${vm.uebungen[b.uebungId]?.name || '?'}`).join(', ')}</span>
    </button>`;
}

// ---------- Training bearbeiten ----------

function useWachBleiben(an) {
  useEffect(() => {
    if (!an || !navigator.wakeLock) return undefined;
    let sperre = null, aus = false;
    const holen = () => { if (document.visibilityState === 'visible') navigator.wakeLock.request('screen').then((x) => { if (aus) x.release(); else sperre = x; }).catch(() => {}); };
    holen();
    document.addEventListener('visibilitychange', holen);
    return () => { aus = true; document.removeEventListener('visibilitychange', holen); sperre?.release().catch(() => {}); };
  }, [an]);
}

function EditorScreen({ vm, laufend }) {
  const w = laufend ? vm.s.laufend : vm.ui.entwurf;
  const [verwerfen, setVerwerfen] = useState(false);
  useWachBleiben(laufend);
  if (!w) return html`<${Weg} vm=${vm} />`;
  const rest = Math.max(0, Math.ceil((vm.ui.pauseBis - vm.ui.jetzt) / 1000));
  return html`
    <${Page} titel=${laufend ? 'Training läuft' : 'Training bearbeiten'} zurueck=${() => history.back()}
      unten=${laufend
        ? html`<div class="reihe zwei-eins"><${Knopf} art="umriss" onClick=${() => setVerwerfen(true)}>Verwerfen<//><${Knopf} onClick=${vm.trainingBeenden}>Training beenden<//></div>`
        : html`<${Knopf} onClick=${vm.entwurfSpeichern}>Speichern<//>`}>
      ${laufend
        ? html`<div class="uhrzeile">
            <span class="gross-wert">⏱ ${uhr((vm.ui.jetzt - w.start) / 1000)}</span>
            ${rest > 0 && html`<span class="pause">Pause ${uhr(rest)}</span>
              <button class="knopf text" onClick=${() => vm.pauseAendern(30)}>+30</button>
              <button class="knopf text" onClick=${() => vm.pauseAendern(0)}>Weiter</button>`}
          </div>`
        : html`<${Klein}>${Format.datum(w.start)}, ${Format.uhrzeit(w.start)}<//>`}
      <${Eingabe} label="Name" wert=${w.name} onInput=${vm.trainingName} />
      ${w.bloecke.map((b, i) => html`<${BlockKarte} key=${i + b.uebungId} i=${i} b=${b} w=${w} laufend=${laufend} vm=${vm} />`)}
      <${Knopf} art="umriss" onClick=${() => vm.oeffnen({ typ: 'uebungWaehlen' })}>+ Übung<//>
      <${Eingabe} label="Notiz zum Training" wert=${w.notiz} onInput=${vm.trainingNotiz} mehrzeilig />
      ${verwerfen && html`<${Dialog} text="Training verwerfen? Alle Sätze dieses Trainings gehen verloren." jaText="Verwerfen"
        ja=${() => { setVerwerfen(false); vm.trainingVerwerfen(); }} nein=${() => setVerwerfen(false)} />`}
    <//>`;
}

function BlockKarte({ i, b, w, laufend, vm }) {
  const u = vm.uebungen[b.uebungId] || T.uebung({ id: b.uebungId, name: 'Unbekannte Übung' });
  const letzte = useMemo(() => Rechnung.letzteSaetze(b.uebungId, vm.s.workouts, w.start).filter(Rechnung.zaehlt), [vm.s.workouts, b.uebungId, w.start]);
  let nr = 0;
  return html`
    <div class="karte block">
      <div class="block-kopf">
        <button class="block-name" onClick=${() => vm.oeffnen({ typ: 'uebung', id: u.id })}>
          <strong>${u.name}</strong><span class=${'klein ' + (u.primaer.length ? 'leise' : 'pflicht-text')}>${muskelText(u)}</span>
        </button>
        <button class="knopf text eng" disabled=${i === 0} onClick=${() => vm.blockVerschieben(i, true)} aria-label="nach oben">↑</button>
        <button class="knopf text eng" disabled=${i === w.bloecke.length - 1} onClick=${() => vm.blockVerschieben(i, false)} aria-label="nach unten">↓</button>
        <button class="knopf text eng" onClick=${() => vm.blockLoeschen(i)} aria-label="Übung entfernen">✕</button>
      </div>
      ${letzte.length > 0 && html`<${Klein} leise>Letztes Mal: ${letzte.map((x) => Format.satz(x, u.art)).join(' · ')}<//>`}
      ${b.saetze.map((x, j) => {
        if (x.typ !== 'AUFWAERMEN') nr++;
        return html`<${SatzZeile} key=${j} nr=${nr} s=${x} art=${u.art} laufend=${laufend} koerper=${vm.koerper}
          onChange=${(neu) => vm.satzAendern(i, j, neu)} onHaken=${() => vm.satzAbhaken(i, j)} onLoeschen=${() => vm.satzLoeschen(i, j)} />`;
      })}
      <button class="knopf text" onClick=${() => vm.satzHinzu(i)}>+ Satz</button>
    </div>`;
}

function SatzZeile({ nr, s, art, laufend, koerper, onChange, onHaken, onLoeschen }) {
  const naechster = SATZTYPEN[(SATZTYPEN.indexOf(s.typ) + 1) % SATZTYPEN.length];
  const felder = {
    GEWICHT: [['kg', s.gewicht, (v) => ({ gewicht: v })], ['Wdh.', s.wdh, (v) => ({ wdh: Math.round(v) }), true]],
    KOERPER: [['± kg', s.gewicht, (v) => ({ gewicht: v }), false, true], ['Wdh.', s.wdh, (v) => ({ wdh: Math.round(v) }), true]],
    ZEIT: [['kg', s.gewicht, (v) => ({ gewicht: v })], ['Sek.', s.sekunden, (v) => ({ sekunden: Math.round(v) }), true]],
    CARDIO: [['km', s.meter / 1000, (v) => ({ meter: v * 1000 })], ['Min.', s.sekunden / 60, (v) => ({ sekunden: Math.round(v * 60) })]],
  }[art];
  return html`
    <div class=${'satz' + (laufend && s.erledigt ? ' erledigt' : '')}>
      <button class="satz-typ" onClick=${() => onChange({ ...s, typ: naechster })} title=${SatzTyp[s.typ].titel} aria-label=${`Satzart ${SatzTyp[s.typ].titel}, antippen zum Wechseln`}>
        ${s.typ === 'NORMAL' ? nr : SatzTyp[s.typ].kurz}
      </button>
      ${felder.map(([label, wert, f, ganz, negativ]) => html`<${ZahlKlein} key=${label} label=${label} wert=${wert} ganz=${ganz} negativ=${negativ} onWert=${(v) => onChange({ ...s, ...f(v) })} />`)}
      ${laufend && html`<button class=${'haken' + (s.erledigt ? ' an' : '')} onClick=${onHaken} aria-label=${s.erledigt ? 'Satz offen' : 'Satz erledigt'}>✓</button>`}
      <button class="knopf text eng" onClick=${onLoeschen} aria-label="Satz löschen">✕</button>
    </div>
    ${art === 'KOERPER' && laufend && s.gewicht !== 0 && html`<span class="klein leise satz-last">Last ${Format.kg(Rechnung.last(s, art, koerper))}</span>`}`;
}

/** Kompaktes Zahlenfeld für Satzzeilen; leer zählt als 0, der Text bleibt beim Tippen stehen. */
function ZahlKlein({ label, wert, onWert, ganz, negativ }) {
  const zeigen = (d) => (d ? Format.zahl(d, ganz ? 0 : 2).replace(/\./g, '') : '');
  const [text, setText] = useState(zeigen(wert));
  const zuletzt = useRef(wert);
  useEffect(() => { if (Math.abs(wert - zuletzt.current) > 1e-9) { setText(zeigen(wert)); zuletzt.current = wert; } }, [wert]);
  return html`
    <label class="zahl-klein">
      <span>${label}</span>
      <input type="text" inputmode=${ganz ? 'numeric' : 'decimal'} value=${text} placeholder="0" onInput=${(e) => {
        let t = e.target.value.replace(ganz ? /[^\d-]/g : /[^\d,.-]/g, '');
        if (!negativ) t = t.replace(/-/g, '');
        setText(t);
        const v = t.trim() === '' || t === '-' ? 0 : Format.parse(t);
        if (v != null) { zuletzt.current = v; onWert(v); }
      }} />
    </label>`;
}

// ---------- Übung wählen / anlegen ----------

function UebungWaehlen({ vm }) {
  const [suche, setSuche] = useState('');
  const [filter, setFilter] = useState(null);
  const nutzung = useMemo(() => Rechnung.nutzung(vm.s.workouts), [vm.s.workouts]);
  const alle = useMemo(() => Object.values(vm.uebungen).sort((a, b) => a.name.localeCompare(b.name, 'de')), [vm.uebungen]);
  const q = T.norm(suche);
  const woerter = q.split(' ').filter(Boolean);
  const treffer = alle.filter((u) => (!filter || u.primaer.includes(filter) || u.sekundaer.includes(filter))
    && (!woerter.length || woerter.every((x) => T.norm(u.name + ' ' + u.importName).includes(x))));
  const zuletzt = !q && !filter ? treffer.filter((u) => nutzung[u.id]).sort((a, b) => nutzung[b.id][1] - nutzung[a.id][1]).slice(0, 8) : [];
  const zeile = (u) => html`<button class="zeile-uebung" key=${u.id} onClick=${() => vm.uebungHinzu(u.id)}>
    <span class="reihe-text"><span>${u.name}</span>${nutzung[u.id] && html`<span class="klein leise">${nutzung[u.id][0]}×</span>`}</span>
    <span class=${'klein ' + (u.primaer.length ? 'leise' : 'pflicht-text')}>${muskelText(u)}</span>
  </button>`;
  return html`
    <${Page} titel="Übung wählen" zurueck=${() => history.back()}
      unten=${html`<${Knopf} art="umriss" onClick=${() => vm.uebungNeu(suche.trim(), true)}>${suche.trim() ? `Eigene Übung „${suche.trim()}“ anlegen` : 'Eigene Übung anlegen'}<//>`}>
      <${Eingabe} label="Suchen" wert=${suche} onInput=${setSuche} platzhalter="z. B. Bankdrücken, Latzug, Squat" />
      <div class="chips scroll">
        ${MUSKELN.map((m) => html`<${Chip} an=${filter === m} onClick=${() => setFilter(filter === m ? null : m)}>${Muskel[m].titel}<//>`)}
      </div>
      <div class="liste">
        ${zuletzt.length > 0 && html`<div class="monat">Zuletzt</div>${zuletzt.map(zeile)}<div class="monat">Alle</div>`}
        ${treffer.map(zeile)}
        ${!treffer.length && html`<${Leer}>Nichts gefunden. Lege die Übung unten selbst an.<//>`}
      </div>
    <//>`;
}

function UebungForm({ vm, a }) {
  const u = vm.ui.uebungEntwurf;
  const [loeschen, setLoeschen] = useState(false);
  if (!u) return html`<${Weg} vm=${vm} />`;
  const eingebaut = u.id in T.katalogNachId;
  const angepasst = eingebaut && vm.s.uebungen.some((x) => x.id === u.id);
  const E = (f) => vm.uebungEntwurf((x) => ({ ...x, ...f(x) }));
  return html`
    <${Page} titel=${a.neu ? 'Neue Übung' : 'Übung bearbeiten'} zurueck=${() => history.back()}
      unten=${html`<${Knopf} deaktiviert=${!u.name.trim()} onClick=${vm.uebungSpeichern}>Speichern<//>`}>
      <${Eingabe} label="Name" wert=${u.name} onInput=${(n) => E(() => ({ name: n }))} pflicht autofocus=${a.neu && !u.name} />
      <${Auswahl} label="Gezählt wird" optionen=${MESSARTEN} wert=${u.art} text=${(m) => Messart[m]} onWahl=${(m) => E(() => ({ art: m }))} />
      <h3 class="zwischen">Hauptmuskeln</h3>
      <div class="chips">
        ${MUSKELN.map((m) => html`<${Chip} an=${u.primaer.includes(m)} onClick=${() => E((x) => ({
          primaer: x.primaer.includes(m) ? x.primaer.filter((y) => y !== m) : [...x.primaer, m], sekundaer: x.sekundaer.filter((y) => y !== m),
        }))}>${Muskel[m].titel}<//>`)}
      </div>
      <h3 class="zwischen">Arbeiten mit (zählen halb)</h3>
      <div class="chips">
        ${MUSKELN.filter((m) => !u.primaer.includes(m)).map((m) => html`<${Chip} an=${u.sekundaer.includes(m)} onClick=${() => E((x) => ({
          sekundaer: x.sekundaer.includes(m) ? x.sekundaer.filter((y) => y !== m) : [...x.sekundaer, m],
        }))}>${Muskel[m].titel}<//>`)}
      </div>
      ${u.importName && html`<${Klein} leise>Name in der Importdatei: ${u.importName}<//>`}
      ${eingebaut && html`<${Klein} leise>Eingebaute Übung. Deine Änderungen gelten nur hier auf dem Gerät.<//>`}
      ${angepasst && html`<${Knopf} art="umriss" onClick=${() => vm.uebungZuruecksetzen(u.id)}>Auf eingebaute Angaben zurücksetzen<//>`}
      ${!eingebaut && !a.neu && html`<${Knopf} art="umriss" klasse="gefahr" onClick=${() => setLoeschen(true)}>Übung löschen<//>`}
      ${loeschen && html`<${Dialog} text=${`Übung „${u.name}“ löschen?`} jaText="Löschen" ja=${() => { setLoeschen(false); vm.uebungZuruecksetzen(u.id); }} nein=${() => setLoeschen(false)} />`}
    <//>`;
}

// ---------- Training ansehen ----------

function WorkoutDetail({ vm, id }) {
  const w = vm.s.workouts.find((x) => x.id === id);
  const [loeschen, setLoeschen] = useState(false);
  if (!w) return html`<${Weg} vm=${vm} />`;
  const z = Rechnung.zusammenfassung(w, vm.uebungen, vm.koerper);
  const kcal = T.Verbrauch.kcal(w, vm.uebungen, vm.koerper);
  return html`
    <${Page} titel=${w.name} zurueck=${() => history.back()}
      unten=${html`<div class="reihe">
        <${Knopf} art="umriss" onClick=${() => vm.workoutBearbeiten(w.id)}>Bearbeiten<//>
        <${Knopf} onClick=${() => vm.trainingStarten(w)}>${vm.s.laufend ? 'Zum Training' : 'Wiederholen'}<//>
      </div>
      <button class="knopf text" onClick=${() => setLoeschen(true)}>Training löschen</button>`}>
      <p>${Format.datum(w.start)}, ${Format.uhrzeit(w.start)}</p>
      <${Klein}>${[w.dauerSek > 0 && `Dauer ${Format.dauer(w.dauerSek)}`, anzahl(z.saetze, 'Satz', 'Sätze'), `${z.wdh} Wdh.`, z.volumen > 0 && `Volumen ${Format.kg(z.volumen)}`, kcal > 0 && `≈ ${kcal} kcal`].filter(Boolean).join(' · ')}<//>
      ${w.quelle && html`<${Klein} leise>${w.quelle}<//>`}
      ${w.bloecke.map((b, i) => {
        const u = vm.uebungen[b.uebungId] || T.uebung({ id: b.uebungId, name: 'Unbekannte Übung' });
        let nr = 0;
        return html`<${Abschnitt} key=${i} titel=${u.name}>
          ${b.saetze.map((x) => {
            if (x.typ !== 'AUFWAERMEN') nr++;
            const e = (u.art === 'GEWICHT' || u.art === 'KOERPER') && x.typ !== 'AUFWAERMEN' ? Rechnung.e1rm(Rechnung.last(x, u.art, vm.koerper), x.wdh) : 0;
            return html`<div class="satz-text"><strong>${x.typ === 'NORMAL' ? nr : SatzTyp[x.typ].kurz}</strong><span>${Format.satz(x, u.art)}</span>${e > 0 && html`<span class="klein leise">1RM ≈ ${Format.zahl(e, 0)}</span>`}</div>`;
          })}
          ${b.notiz && html`<${Klein}>${b.notiz}<//>`}
          <button class="knopf text" onClick=${() => vm.oeffnen({ typ: 'uebung', id: u.id })}>Verlauf dieser Übung ›</button>
        <//>`;
      })}
      ${w.notiz && html`<${Abschnitt} titel="Notiz"><p>${w.notiz}</p><//>`}
      ${loeschen && html`<${Dialog} text=${`Training „${w.name}“ vom ${Format.datum(w.start)} löschen?`} jaText="Löschen"
        ja=${() => { setLoeschen(false); vm.workoutLoeschen(w.id); }} nein=${() => setLoeschen(false)} />`}
    <//>`;
}

// ---------- Verlauf ----------

function VerlaufTab({ vm }) {
  const { s, ui, uebungen, koerper } = vm;
  const [suche, setSuche] = useState('');
  const nutzung = useMemo(() => Rechnung.nutzung(s.workouts), [s.workouts]);
  const genutzt = useMemo(() => {
    const l = [...Object.keys(nutzung).map((id) => uebungen[id]).filter(Boolean), ...s.uebungen.filter((u) => u.id.startsWith('e:'))];
    const ges = new Set();
    return l.filter((u) => (ges.has(u.id) ? false : ges.add(u.id))).sort((a, b) => (nutzung[b.id]?.[1] || 0) - (nutzung[a.id]?.[1] || 0));
  }, [nutzung, uebungen]);
  const bestes = useMemo(() => Object.fromEntries(genutzt.map((u) => {
    const v = Rechnung.verlauf(u.id, s.workouts, u.art, koerper);
    return [u.id, v.length ? Math.max(...v.map((p) => p.e1rm)) : 0];
  })), [s.workouts, genutzt, koerper]);
  const wochen = useMemo(() => {
    const m = montag(ui.jetzt);
    return Array.from({ length: 12 }, (_, k) => {
      const i = 11 - k;
      const von = new Date(m); von.setDate(von.getDate() - 7 * i);
      const bis = new Date(von); bis.setDate(bis.getDate() + 7);
      return [`${von.getDate()}.${von.getMonth() + 1}.`, s.workouts.filter((w) => w.start >= von.getTime() && w.start < bis.getTime()).length];
    });
  }, [s.workouts, Math.floor(ui.jetzt / TAG)]);
  const monat = s.workouts.filter((w) => w.start >= ui.jetzt - 30 * TAG);
  const zs = monat.map((w) => Rechnung.zusammenfassung(w, uebungen, koerper));
  const q = T.norm(suche);
  const liste = genutzt.filter((u) => !q || q.split(' ').every((x) => T.norm(u.name).includes(x)));
  const erstes = s.workouts.length ? Math.min(...s.workouts.map((w) => w.start)) : null;
  return html`
    <${Page} titel="Verlauf">
      <${Abschnitt} titel="Letzte 30 Tage">
        <p>${anzahl(monat.length, 'Training', 'Trainings')} · ${anzahl(zs.reduce((a, z) => a + z.saetze, 0), 'Satz', 'Sätze')} · ${Format.kg(zs.reduce((a, z) => a + z.volumen, 0))} Volumen</p>
        <${Klein}>Trainings je Woche<//>
        <${Saeulen} werte=${wochen.map(([n, w], i) => [i % 3 === 2 || i === 11 ? n : '', w])} />
        <${Klein} leise>Insgesamt ${anzahl(s.workouts.length, 'Training', 'Trainings')}${erstes ? ` seit ${Format.monatJahr(erstes)}` : ''}<//>
      <//>
      <${Eingabe} label="Übung suchen" wert=${suche} onInput=${setSuche} />
      <div class="liste">
        ${!liste.length && html`<${Leer}>${s.workouts.length ? 'Keine Übung gefunden.' : 'Noch keine Trainings.'}<//>`}
        ${liste.map((u) => {
          const n = nutzung[u.id];
          return html`<button class="zeile-uebung" key=${u.id} onClick=${() => vm.oeffnen({ typ: 'uebung', id: u.id })}>
            <span>${u.name}</span>
            <span class="klein leise">${[n && anzahl(n[0], 'Training', 'Trainings'), n && `zuletzt ${Format.datumKurz(n[1])}`, bestes[u.id] > 0 && `1RM ≈ ${Format.kg(bestes[u.id])}`].filter(Boolean).join(' · ') || 'noch nicht trainiert'}</span>
            ${!u.primaer.length && html`<span class="klein pflicht-text">Muskelgruppen fehlen, antippen zum Zuordnen</span>`}
          </button>`;
        })}
      </div>
    <//>`;
}

const METRIKEN = {
  E1RM: { titel: '1RM geschätzt', wert: (p) => p.e1rm },
  GEWICHT: { titel: 'Schwerstes Gewicht', wert: (p) => p.maxGewicht },
  VOLUMEN: { titel: 'Volumen', wert: (p) => p.volumen },
  WDH: { titel: 'Meiste Wdh.', wert: (p) => p.maxWdh },
  ZEIT: { titel: 'Längste Zeit', wert: (p) => p.maxSek },
  STRECKE: { titel: 'Strecke', wert: (p) => p.meter },
};
const metriken = (art) => ({ GEWICHT: ['E1RM', 'GEWICHT', 'VOLUMEN', 'WDH'], KOERPER: ['WDH', 'E1RM', 'GEWICHT', 'VOLUMEN'], ZEIT: ['ZEIT', 'GEWICHT'], CARDIO: ['STRECKE', 'ZEIT'] }[art]);
const metrikText = (m, w) => (m === 'WDH' ? `${Format.zahl(w, 0)} Wdh.` : m === 'ZEIT' ? Format.dauer(Math.round(w)) : m === 'STRECKE' ? Format.strecke(w) : Format.kg(w));

function UebungDetail({ vm, id }) {
  const u = vm.uebungen[id] || T.uebung({ id, name: 'Unbekannte Übung' });
  const verlauf = useMemo(() => Rechnung.verlauf(id, vm.s.workouts, u.art, vm.koerper), [vm.s.workouts, id, vm.koerper, u.art]);
  const ms = metriken(u.art);
  const [metrik, setMetrik] = useState(ms[0]);
  const [tage, setTage] = useState(0);
  const punkte = verlauf.filter((p) => !tage || p.start >= vm.ui.jetzt - tage * TAG).map((p) => [p.start, METRIKEN[metrik].wert(p)]).filter((x) => x[1] > 0);
  const r = Rechnung.rekorde(verlauf);
  const zeile = (n, rek, m) => rek && html`<div class="reihe-text"><span>${n}</span><span>${metrikText(m, rek.wert)} <span class="klein leise">(${Format.datumKurz(rek.start)})</span></span></div>`;
  const std = T.STANDARDS[id];
  const best = r.e1rm?.wert || 0;
  return html`
    <${Page} titel=${u.name} zurueck=${() => history.back()} aktionen=${html`<button class="knopf text" onClick=${() => vm.uebungBearbeiten(id)}>Bearbeiten</button>`}>
      <${Klein}><span class=${u.primaer.length ? 'leise' : 'pflicht-text'}>${muskelText(u)}</span><//>
      ${!verlauf.length ? html`<${Leer}>Noch nicht trainiert.<//>` : html`
        <div class="chips scroll">${ms.map((m) => html`<${Chip} an=${metrik === m} onClick=${() => setMetrik(m)}>${METRIKEN[m].titel}<//>`)}</div>
        <div class="chips">${[[90, '3 Monate'], [365, '1 Jahr'], [0, 'Alles']].map(([t, n]) => html`<${Chip} an=${tage === t} onClick=${() => setTage(t)}>${n}<//>`)}</div>
        ${punkte.length ? html`<${Diagramm} key=${metrik + tage} punkte=${punkte} text=${(w) => metrikText(metrik, w)} />` : html`<${Leer}>Keine Werte in diesem Zeitraum.<//>`}
        <${Abschnitt} titel="Bestwerte">
          ${(u.art === 'GEWICHT' || u.art === 'KOERPER') && html`
            ${zeile('1RM geschätzt', r.e1rm, 'E1RM')}
            ${zeile(u.art === 'KOERPER' ? 'Meistes Zusatzgewicht' : 'Schwerstes Gewicht', r.maxGewicht, 'GEWICHT')}
            ${zeile('Meiste Wdh. in einem Satz', r.maxWdh, 'WDH')}
            ${zeile('Meistes Volumen', r.volumen, 'VOLUMEN')}`}
          ${u.art === 'ZEIT' && zeile('Längste Zeit', r.maxSek, 'ZEIT')}
          ${u.art === 'CARDIO' && zeile('Weiteste Strecke', r.meter, 'STRECKE')}
          <${Klein} leise>${anzahl(verlauf.length, 'Training', 'Trainings')} seit ${Format.datumKurz(verlauf[0].start)}<//>
        <//>
        ${std && best > 0 && (() => {
          const v = best / vm.koerper;
          const [stufe, p] = Belastung.punkte(v, std);
          return html`<${Abschnitt} titel="Kraftniveau">
            <p>${Belastung.stufen[stufe]} · ${p} von 100 Punkten</p>
            <${Klein}>1RM ≈ ${Format.zahl(v, 2)} × Körpergewicht (${Format.kg(vm.koerper)}). Nächste Stufe ab ${std[stufe] != null ? Format.kg(std[stufe] * vm.koerper) : '–'}.<//>
          <//>`;
        })()}
        <h3 class="zwischen">Trainings</h3>
        <div class="liste">
          ${[...verlauf].reverse().slice(0, 40).map((p) => {
            const w = vm.s.workouts.find((x) => x.id === p.workoutId);
            const saetze = (w?.bloecke || []).filter((b) => b.uebungId === id).flatMap((b) => b.saetze);
            return html`<button class="zeile-uebung" key=${p.workoutId} onClick=${() => vm.oeffnen({ typ: 'workout', id: p.workoutId })}>
              <strong class="klein">${Format.datum(p.start)}</strong>
              <span class="klein">${saetze.map((x) => (x.typ === 'NORMAL' ? '' : SatzTyp[x.typ].kurz + ' ') + Format.satz(x, u.art)).join(' · ')}</span>
            </button>`;
          })}
        </div>`}
    <//>`;
}

/** Schöne Rasterschritte (1, 2, 2,5, 5 × 10ⁿ). */
function schritt(spanne) {
  if (spanne <= 0) return 1;
  const roh = spanne / 4;
  const p = 10 ** Math.floor(Math.log10(roh));
  return [1, 2, 2.5, 5, 10].map((x) => x * p).find((x) => x >= roh);
}

/** Liniendiagramm über die Zeit; antippen oder wischen zeigt den nächsten Punkt. */
function Diagramm({ punkte, text }) {
  const [gew, setGew] = useState(punkte.length - 1);
  const B = 340, H = 190, links = 44, rechts = 8, oben = 6, unten = H - 20;
  const werte = punkte.map((p) => p[1]);
  const minW = Math.min(...werte), maxW = Math.max(...werte);
  const st = schritt(maxW - minW > 0 ? maxW - minW : Math.max(1, maxW) * 0.2);
  const u0 = Math.floor(minW / st) * st - (maxW === minW ? st : 0);
  const o0 = Math.ceil(maxW / st) * st + (maxW === minW ? st : 0);
  const t0 = punkte[0][0], t1 = Math.max(punkte[punkte.length - 1][0], t0 + 1);
  const x = (t) => links + ((t - t0) / (t1 - t0)) * (B - links - rechts);
  const y = (w) => unten - ((w - u0) / (o0 - u0)) * (unten - oben);
  const p = punkte[Math.min(gew, punkte.length - 1)];
  const raster = [];
  for (let g = u0; g <= o0 + st / 2; g += st) raster.push(g);
  const waehlen = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * B;
    const t = t0 + Math.min(1, Math.max(0, (px - links) / (B - links - rechts))) * (t1 - t0);
    let best = 0;
    punkte.forEach((q, i) => { if (Math.abs(q[0] - t) < Math.abs(punkte[best][0] - t)) best = i; });
    setGew(best);
  };
  const pfad = punkte.map((q, i) => `${i ? 'L' : 'M'}${x(q[0]).toFixed(1)},${y(q[1]).toFixed(1)}`).join('');
  return html`
    <div class="diagramm">
      <div class="kurve-text an">${Format.datumKurz(p[0])}: ${text(p[1])}</div>
      <svg viewBox=${`0 0 ${B} ${H}`} onPointerDown=${waehlen} onPointerMove=${(e) => e.buttons && waehlen(e)} role="img" aria-label=${`Verlauf von ${text(punkte[0][1])} bis ${text(punkte[punkte.length - 1][1])}`}>
        ${raster.map((g) => html`<line class="gitter" x1=${links} x2=${B - rechts} y1=${y(g)} y2=${y(g)} /><text class="achse" x=${links - 5} y=${y(g) + 3.5} text-anchor="end">${Format.zahl(g, 1)}</text>`)}
        <text class="achse" x=${links} y=${H - 4}>${Format.datumKurz(t0)}</text>
        ${punkte.length > 1 && html`<text class="achse" x=${B - rechts} y=${H - 4} text-anchor="end">${Format.datumKurz(t1)}</text>
          <path d=${pfad} class="linie" />`}
        ${punkte.map((q) => html`<circle cx=${x(q[0])} cy=${y(q[1])} r=${punkte.length > 60 ? 2 : 3.2} class="punkt" />`)}
        <circle cx=${x(p[0])} cy=${y(p[1])} r="7" class="wahl-punkt" />
      </svg>
    </div>`;
}

function Saeulen({ werte }) {
  const max = Math.max(1, ...werte.map((w) => w[1]));
  return html`
    <div class="saeulen">
      ${werte.map(([n, w]) => html`<div class="saeule">
        <span class="klein">${w > 0 ? w : ''}</span>
        <div class=${'saeule-balken' + (w > 0 ? ' an' : '')} style=${{ height: Math.max(2, (70 * w) / max) + 'px' }}></div>
        <span class="saeule-text">${n}</span>
      </div>`)}
    </div>`;
}

// ---------- Muskeln ----------

const MODI = { BELASTUNG: 'Belastung', ERHOLUNG: 'Erholung', NIVEAU: 'Kraftniveau' };

function MuskelnTab({ vm }) {
  const { s, ui, uebungen, koerper } = vm;
  const [modus, setModus] = useState('BELASTUNG');
  const e = s.einstellungen;
  const stunde = Math.floor(ui.jetzt / 3_600_000);
  const saetze = useMemo(() => Belastung.saetze(s.workouts, uebungen, ui.jetzt - ui.zeitraum * TAG, ui.jetzt + 60_000), [s.workouts, ui.zeitraum, stunde, uebungen]);
  const erholung = useMemo(() => Belastung.erholung(s.workouts, uebungen, ui.jetzt), [s.workouts, Math.floor(ui.jetzt / 600_000), uebungen]);
  const niveau = useMemo(() => Belastung.kraftniveau(s.workouts, uebungen, koerper), [s.workouts, koerper, uebungen]);
  const f = ui.zeitraum / 7;
  const zielMin = e.wochenzielMin * f, zielMax = e.wochenzielMax * f;
  const intens = Object.fromEntries(MUSKELN.map((m) => [m,
    modus === 'BELASTUNG' ? Math.min(1, Math.max(0, saetze[m] / zielMax)) : modus === 'ERHOLUNG' ? 1 - erholung[m] : (niveau[m]?.punkte || 0) / 100]));
  const gesamt = Object.values(niveau).length ? Object.values(niveau).reduce((a, n) => a + n.punkte, 0) / Object.values(niveau).length : null;
  return html`
    <${Page} titel="Muskeln">
      <div class="chips">${Object.entries(MODI).map(([m, t]) => html`<${Chip} an=${modus === m} onClick=${() => setModus(m)}>${t}<//>`)}</div>
      ${modus === 'BELASTUNG' && html`<div class="chips">${[7, 14, 30].map((t) => html`<${Chip} an=${ui.zeitraum === t} onClick=${() => vm.zeitraum(t)}>${t} Tage<//>`)}</div>`}
      <${Klein} leise>${{
        BELASTUNG: `Harte Sätze je Muskelgruppe in den letzten ${ui.zeitraum} Tagen. Hauptmuskel zählt ganz, mitarbeitende Muskeln halb. Ziel: ${Format.zahl(zielMin, 0)}–${Format.zahl(zielMax, 0)} Sätze.`,
        ERHOLUNG: 'Wie frisch jede Muskelgruppe gerade ist. Geschätzt aus den Sätzen der letzten Tage; große Gruppen brauchen länger.',
        NIVEAU: `Bestes geschätztes 1RM der Grundübungen im Verhältnis zu deinem Körpergewicht (${Format.kg(koerper)}). Grobe Einordnung nach gängigen Kraft-Tabellen für Männer.`,
      }[modus]}<//>
      <${Koerperbild} intens=${intens} fehler=${modus === 'ERHOLUNG'} />
      ${modus === 'NIVEAU' && html`<${Abschnitt} titel="Kraft-Score">
        ${gesamt == null ? html`<p>Noch keine Grundübung (Bankdrücken, Kniebeuge, Kreuzheben, Schulterdrücken, Rudern mit Langhantel, Klimmzug, Dips …) im Verlauf.</p>`
          : html`<p class="gross-wert">${Format.zahl(gesamt, 0)} von 100</p><${Klein}>Punkte im Schnitt über ${Object.keys(niveau).length} Muskelgruppen<//>`}
      <//>`}
      <div class="muskel-liste">
        ${[...MUSKELN].sort((a, b) => intens[b] - intens[a]).map((m) => {
          const sz = saetze[m];
          const wert = modus === 'BELASTUNG' ? `${Format.zahl(sz, 1)} ${sz === 1 ? 'Satz' : 'Sätze'}${sz === 0 ? '' : sz < zielMin ? ' · wenig' : sz > zielMax ? ' · viel' : ' · im Ziel'}`
            : modus === 'ERHOLUNG' ? `${Format.zahl(erholung[m] * 100, 0)} % erholt` : niveau[m] ? `${Belastung.stufen[niveau[m].stufe]} · ${niveau[m].punkte}` : '–';
          return html`<div class=${'balken' + (modus === 'ERHOLUNG' ? ' ueber' : '')}>
            <div class="balken-zeile"><span>${Muskel[m].titel}</span><span>${wert}</span></div>
            <div class="balken-bahn"><div class="balken-fuell" style=${{ width: intens[m] * 100 + '%' }}></div></div>
            ${modus === 'NIVEAU' && niveau[m] && html`<span class="klein leise">aus ${uebungen[niveau[m].uebungId]?.name || niveau[m].uebungId}: 1RM ≈ ${Format.kg(niveau[m].e1rm)}</span>`}
          </div>`;
        })}
      </div>
    <//>`;
}

// Strichfigur von vorn und hinten (selbst gezeichnet, wie in der Android-App). Pfade für die linke Hälfte einer Figur
// im Raster 200 × 440, die rechte entsteht durch Spiegeln. Teile ohne Muskelgruppe sind nur Zeichnung.
const FIGUR = {
  silhouette: 'M100,8 C88,8 81,17 81,31 C81,40 83,48 86,54 C88,58 91,61 93,63 L93,71 C86,74 78,77 70,80 C58,82 48,88 45,100 C42,110 42,124 44,138 C41,152 39,166 40,180 C37,196 34,214 33,232 C32,240 33,248 34,254 C31,260 29,270 30,280 C31,286 35,290 39,288 C43,286 45,280 44,272 C45,264 46,258 46,252 C50,236 54,216 57,198 C59,190 60,184 61,176 C62,168 63,156 64,146 C65,154 66,166 68,178 C70,192 71,202 70,212 C66,224 63,238 62,254 C59,282 60,314 64,344 C64,352 64,360 63,368 C61,384 61,402 64,418 C64,424 62,430 62,434 C64,438 72,440 84,438 C88,436 88,430 85,424 C86,412 88,396 89,380 C90,370 90,360 89,350 C92,330 96,300 99,268 L100,266',
  vorne: [
    [null, 'M93,63 C94,69 96,75 99,81 L96,82 C94,76 93,70 92,66 Z'],
    ['TRAPEZ', 'M92,70 C86,75 79,78 71,80 C79,83 87,83 95,81 C94,77 93,74 92,70 Z'],
    ['SCHULTERN', 'M71,82 C63,85 59,93 59,104 C60,111 63,113 66,109 C71,102 76,94 79,88 C77,84 74,82 71,82 Z'],
    ['SCHULTERN', 'M66,82 C54,84 47,94 45,106 C44,118 46,130 50,138 C52,126 55,116 59,108 C57,96 59,87 66,82 Z'],
    ['BRUST', 'M98,86 C90,84 82,86 79,90 C73,98 68,108 66,118 C66,126 70,132 78,134 C86,136 94,134 98,130 Z'],
    ['LAT', 'M66,124 C64,134 64,146 68,158 C70,150 71,142 71,134 C69,131 67,128 66,124 Z'],
    ['BAUCH', 'M73,136 C76,137 79,138 81,140 L81,145 C78,143 75,142 72,142 Z'],
    ['BAUCH', 'M72,146 C76,147 79,148 82,150 L82,155 C78,153 75,152 72,152 Z'],
    ['BAUCH', 'M73,156 C77,157 80,158 83,160 L83,165 C79,163 76,162 74,162 Z'],
    ['BAUCH', 'M87,138 C91,137 95,137 98,138 L98,154 C94,154 90,155 87,156 C86,150 86,144 87,138 Z'],
    ['BAUCH', 'M87,159 C91,158 95,158 98,158 L98,175 C94,175 90,175 87,176 C86,170 86,164 87,159 Z'],
    ['BAUCH', 'M87,179 C91,178 95,178 98,178 L98,196 C94,196 90,196 87,197 C86,191 86,185 87,179 Z'],
    ['BAUCH', 'M87,200 C91,200 95,200 98,200 L98,238 C93,234 89,224 87,212 C86,208 86,204 87,200 Z'],
    ['BAUCH', 'M84,168 C78,170 74,176 72,186 C72,198 76,210 84,222 C84,204 84,186 84,168 Z'],
    ['BIZEPS', 'M52,140 C46,150 44,164 46,178 C48,186 52,189 56,186 C60,174 61,160 60,148 C59,141 55,137 52,140 Z'],
    ['BIZEPS', 'M61,152 C63,162 63,174 59,184 C61,186 63,184 64,180 C65,170 64,160 61,152 Z'],
    ['UNTERARME', 'M44,188 C39,202 36,220 35,240 C35,248 37,252 40,252 C42,236 45,220 49,204 C50,196 48,189 44,188 Z'],
    ['UNTERARME', 'M53,190 C51,202 48,222 44,250 C46,252 48,251 49,248 C53,232 57,214 58,202 C58,194 56,190 53,190 Z'],
    [null, 'M36,258 C33,264 32,272 33,280 C34,284 36,284 37,280 C37,272 38,264 36,258 Z'],
    ['QUADRIZEPS', 'M69,232 C62,254 61,284 63,314 C65,332 68,344 73,352 C74,326 74,296 73,270 C72,256 71,244 69,232 Z'],
    ['QUADRIZEPS', 'M75,240 C79,256 83,276 85,298 C86,316 84,334 80,346 C77,336 76,320 76,304 C75,284 75,262 75,240 Z'],
    ['QUADRIZEPS', 'M87,304 C86,318 84,332 83,344 C86,350 91,348 92,340 C92,328 90,314 87,304 Z'],
    [null, 'M72,226 C77,246 84,268 88,290 C91,306 92,322 93,338 L95,336 C95,320 94,304 91,288 C87,266 80,244 75,224 Z'],
    ['ADDUKTOREN', 'M81,246 C85,262 90,278 93,298 C95,288 97,276 98,266 C98,256 92,248 81,246 Z'],
    [null, 'M74,352 C72,358 73,364 77,366 C81,366 83,360 82,354 C80,350 76,350 74,352 Z'],
    ['WADEN', 'M66,366 C62,378 61,392 63,406 C65,410 68,410 69,404 C70,392 70,378 69,368 C68,364 67,364 66,366 Z'],
    ['WADEN', 'M86,364 C89,374 90,386 88,398 C87,404 85,404 84,398 C83,388 83,376 84,366 C84,362 85,362 86,364 Z'],
    ['WADEN', 'M73,368 C72,384 72,400 74,418 L78,418 C79,402 80,386 80,370 C78,366 75,366 73,368 Z'],
  ],
  hinten: [
    ['TRAPEZ', 'M100,62 L94,64 L93,71 C86,75 77,79 70,82 C78,88 86,102 91,120 C94,134 97,148 100,162 Z'],
    ['SCHULTERN', 'M66,84 C54,85 47,94 45,106 C44,118 46,130 50,138 C54,124 59,112 67,102 C72,96 72,88 66,84 Z'],
    ['SCHULTERN', 'M73,96 C67,104 65,114 67,124 C74,126 82,122 87,114 C84,106 79,99 73,96 Z'],
    ['LAT', 'M66,126 C72,124 80,122 87,116 C88,120 87,124 85,127 C79,131 72,131 66,128 Z'],
    ['LAT', 'M67,130 C65,148 68,170 76,188 C82,202 90,210 97,214 L97,176 C93,160 90,146 88,126 C82,132 74,134 67,130 Z'],
    ['BAUCH', 'M70,182 C70,196 71,206 72,214 C78,212 84,212 88,212 C82,204 76,194 70,182 Z'],
    ['TRIZEPS', 'M56,138 C60,146 62,158 62,172 C61,182 58,188 54,187 C53,170 53,152 56,138 Z'],
    ['TRIZEPS', 'M51,140 C45,150 43,164 45,178 C47,184 49,187 51,186 C50,170 51,152 54,138 C53,137 52,138 51,140 Z'],
    ['UNTERARME', 'M44,188 C39,202 36,220 35,240 C35,248 37,252 40,252 C42,236 45,220 49,204 C50,196 48,189 44,188 Z'],
    ['UNTERARME', 'M53,190 C51,202 48,222 44,250 C46,252 48,251 49,248 C53,232 57,214 58,202 C58,194 56,190 53,190 Z'],
    ['UNTERER_RUECKEN', 'M93,176 C91,192 90,210 91,226 C93,234 96,238 99,238 L99,174 Z'],
    ['GESAESS', 'M72,214 C70,222 70,232 72,240 C78,236 86,234 92,236 C90,226 86,218 80,214 C78,213 74,213 72,214 Z'],
    ['GESAESS', 'M99,242 C88,239 75,242 69,254 C65,268 66,282 74,292 C82,298 92,298 99,294 Z'],
    ['BEINBEUGER', 'M68,298 C64,316 64,336 70,354 C74,358 78,358 80,354 C80,336 82,316 84,302 C78,300 72,298 68,298 Z'],
    ['BEINBEUGER', 'M87,302 C86,320 88,340 92,356 C95,358 97,355 97,350 C97,332 96,316 94,303 Z'],
    ['ADDUKTOREN', 'M96,300 C97,312 98,324 99,336 L99,298 Z'],
    ['WADEN', 'M68,364 C62,378 62,396 67,410 C71,414 75,412 77,406 C79,392 79,378 77,366 C75,362 70,360 68,364 Z'],
    ['WADEN', 'M81,364 C79,378 79,394 82,406 C86,412 90,412 91,404 C93,390 92,376 88,366 C86,362 83,362 81,364 Z'],
    [null, 'M74,416 C76,422 79,426 82,428 L85,424 C82,420 80,416 78,412 Z'],
  ],
};

function Koerperbild({ intens, fehler }) {
  const farbe = (m) => {
    const i = m ? intens[m] || 0 : 0;
    if (i <= 0) return 'var(--background)';
    return `color-mix(in srgb, var(${fehler ? '--error' : '--primary'}) ${Math.round((0.25 + 0.75 * Math.min(1, i)) * 100)}%, var(--background))`;
  };
  const haelfte = (teile) => html`
    <path d=${FIGUR.silhouette} class="figur-umriss" />
    ${teile.map(([m, d]) => html`<path d=${d} class="figur-muskel" style=${{ fill: farbe(m) }} />`)}`;
  const figur = (teile, x0) => html`
    <g transform=${`translate(${x0},0)`}>
      ${haelfte(teile)}
      <g transform="translate(200,0) scale(-1,1)">${haelfte(teile)}</g>
    </g>`;
  const top = MUSKELN.filter((m) => intens[m] > 0).sort((a, b) => intens[b] - intens[a]).slice(0, 3).map((m) => Muskel[m].titel).join(', ');
  return html`
    <svg class="koerper" viewBox="0 0 440 444" role="img" aria-label=${top ? `Körperbild, am stärksten: ${top}` : 'Körperbild, keine Muskelgruppe belastet'}>
      ${figur(FIGUR.vorne, 13)}${figur(FIGUR.hinten, 227)}
    </svg>`;
}

// ---------- Daten ----------

function DatenTab({ vm }) {
  const { s } = vm;
  const e = s.einstellungen;
  const datei = useRef();
  const sich = useRef();
  const [letzte, setLetzte] = useState(null);
  useEffect(() => { meta('letzteSicherung').then((v) => setLetzte(v || null)); }, []);
  const E = (f) => vm.einstellungen((x) => f(x));
  const kopieren = () => navigator.clipboard?.writeText(Anleitung.brief).then(() => vm.meldung('Musterbrief kopiert.'), () => vm.oeffnen({ typ: 'anleitung' }));
  return html`
    <${Page} titel="Daten">
      <${Abschnitt} titel="Aus Stronger umziehen">
        <p>Stronger hat keinen Export. Deine Trainings bekommst du über eine Datenauskunft nach DSGVO beim Anbieter (Atlas Smart Technologies). Die Anleitung erklärt die Schritte, der Musterbrief ist fertig zum Kopieren.</p>
        <div class="reihe">
          <${Knopf} art="umriss" onClick=${() => vm.oeffnen({ typ: 'anleitung' })}>Anleitung<//>
          <${Knopf} art="umriss" onClick=${kopieren}>Brief kopieren<//>
        </div>
      <//>
      <${Abschnitt} titel="Trainings importieren">
        <p>CSV-Datei mit einem Satz je Zeile, z. B. aus der Stronger-Auskunft, aus Strong, Hevy oder FitNotes. Erkannt werden Datum, Übung, Gewicht, Wiederholungen und mehr; Spalten lassen sich selbst zuordnen. Schon vorhandene Trainings werden übersprungen.</p>
        <input ref=${datei} type="file" accept=".csv,.txt,text/csv,text/plain,text/comma-separated-values" hidden onChange=${(ev) => { vm.importDatei(ev.target.files[0]); ev.target.value = ''; }} />
        ${vm.ui.laedt ? html`<div class="status"><span class="kreisel"></span>Datei wird gelesen …</div>` : html`<${Knopf} onClick=${() => datei.current.click()}>Datei wählen<//>`}
      <//>
      <${Abschnitt} titel="Einstellungen">
        <${ZahlFeld} label="Körpergewicht (kg)" wert=${e.koerpergewicht} onWert=${(v) => E(() => ({ koerpergewicht: v }))}
          hilfe=${e.koerpergewicht > 0 ? 'Für Klimmzüge, Dips, Kraftniveau und Verbrauch.' : `Leer = wie bei Food & Boost (${vm.foodKg > 0 ? Format.kg(vm.foodKg) : 'noch nicht eingetragen, solange 75 kg'}).`} />
        <${Zaehler} label="Pausen-Timer" wert=${e.pauseSek === 0 ? 'aus' : Format.dauer(e.pauseSek)}
          minus=${() => E((x) => ({ pauseSek: Math.max(0, x.pauseSek - 15) }))} plus=${() => E((x) => ({ pauseSek: Math.min(600, x.pauseSek + 15) }))} minusAn=${e.pauseSek > 0} plusAn=${e.pauseSek < 600} />
        <${Zaehler} label="Ziel: mindestens Sätze je Woche" wert=${e.wochenzielMin}
          minus=${() => E((x) => ({ wochenzielMin: Math.max(1, x.wochenzielMin - 1) }))} plus=${() => E((x) => ({ wochenzielMin: x.wochenzielMin + 1, wochenzielMax: Math.max(x.wochenzielMax, x.wochenzielMin + 2) }))} minusAn=${e.wochenzielMin > 1} plusAn />
        <${Zaehler} label="Ziel: höchstens Sätze je Woche" wert=${e.wochenzielMax}
          minus=${() => E((x) => ({ wochenzielMax: Math.max(x.wochenzielMin + 1, x.wochenzielMax - 1) }))} plus=${() => E((x) => ({ wochenzielMax: x.wochenzielMax + 1 }))} minusAn=${e.wochenzielMax > e.wochenzielMin + 1} plusAn />
      <//>
      <${Abschnitt} titel="Sicherung">
        <p>${anzahl(s.workouts.length, 'Training', 'Trainings')}, ${anzahl(s.uebungen.length, 'eigene Übung', 'eigene Übungen')}. Alles bleibt auf dem Gerät.</p>
        <${Klein}>Eine Datei für Training und Food & Boost. ${letzte ? `Letzte Sicherung: ${new Date(letzte).toLocaleDateString('de-DE')}.` : 'Noch keine Sicherung gemacht.'} Safari löscht Daten von Web-Apps, die einige Wochen nicht geöffnet wurden. Darum ab und zu sichern.<//>
        <input ref=${sich} type="file" accept="application/json,.json,text/plain" hidden onChange=${async (ev) => {
          const f = ev.target.files[0];
          ev.target.value = '';
          if (!f) return;
          try { vm.sicherungAnbieten(await dateiLesen(f)); } catch (err) { vm.meldung('Die Datei ließ sich nicht lesen: ' + err.message); }
        }} />
        <div class="reihe">
          <${Knopf} art="umriss" onClick=${async () => { if (await sicherungSpeichern({ training: s })) setLetzte(Date.now()); }}>Sichern<//>
          <${Knopf} art="umriss" onClick=${() => sich.current.click()}>Wiederherstellen<//>
        </div>
        <${Klein} leise>Auch Sicherungen aus der Android-App (krafttraining.json) lassen sich laden.<//>
      <//>
    <//>`;
}

function AnleitungScreen({ vm }) {
  return html`
    <${Page} titel="Daten aus Stronger holen" zurueck=${() => history.back()}
      unten=${html`<${Knopf} onClick=${() => navigator.clipboard?.writeText(Anleitung.brief).then(() => vm.meldung('Musterbrief kopiert.'), () => vm.meldung('Kopieren ging nicht. Bitte den Brief unten markieren und kopieren.'))}>Musterbrief kopieren<//>`}>
      ${Anleitung.schritte.map(([t, x]) => html`<${Abschnitt} titel=${t}><p class="mehrzeilig">${x}</p><//>`)}
      <${Abschnitt} titel="Musterbrief (Englisch)"><p class="rohtext waehlbar">${Anleitung.brief}</p><//>
      <${Klein} leise>Praktische Anleitung, keine Rechtsberatung.<//>
    <//>`;
}

function ImportVorschau({ vm }) {
  const lauf = vm.ui.import;
  const e = lauf?.ergebnis;
  if (!e) return html`<${Weg} vm=${vm} />`;
  const neu = e.workouts.length - lauf.doppelt;
  const neuestes = e.workouts[e.workouts.length - 1];
  return html`
    <${Page} titel="Import prüfen" zurueck=${() => { vm.importAbbrechen(); }}
      unten=${html`<${Knopf} deaktiviert=${neu <= 0} onClick=${vm.importUebernehmen}>${neu > 0 ? `${neu} Trainings übernehmen` : 'Nichts Neues'}<//>
        <${Knopf} art="umriss" klasse="flach" onClick=${() => vm.oeffnen({ typ: 'importZuordnung' })}>Spalten anders zuordnen<//>`}>
      <${Abschnitt} titel="Gefunden">
        <p>${e.quelle}: ${anzahl(e.workouts.length, 'Training', 'Trainings')} mit ${anzahl(e.saetze, 'Satz', 'Sätzen')}</p>
        <p>Zeitraum ${Format.datumKurz(e.von)} bis ${Format.datumKurz(e.bis)}</p>
        ${lauf.doppelt > 0 && html`<p>${anzahl(lauf.doppelt, 'Training ist', 'Trainings sind')} schon da und ${lauf.doppelt === 1 ? 'wird' : 'werden'} übersprungen.</p>`}
        ${e.uebersprungen > 0 && html`<${Klein} leise>${e.uebersprungen} von ${e.zeilen} Zeilen ohne Satz übersprungen (z. B. Pausen-Timer, leere Zeilen).<//>`}
        ${e.datumFehler.length > 0 && html`<${Klein}><span class="rot">Datum nicht lesbar in Zeile ${e.datumFehler.join(', ')}.</span><//>`}
        <${Klein} leise>Neuestes: ${neuestes.name}, ${Format.datum(neuestes.start)} ${Format.uhrzeit(neuestes.start)}<//>
      <//>
      <h3 class="zwischen">Übungen (${e.uebungen.length})</h3>
      ${e.ohneMuskeln.length > 0 && html`<${Hinweis} art="info">${anzahl(e.ohneMuskeln.length, 'Übung', 'Übungen')} ohne Muskelgruppen. Nach dem Import unter Verlauf zuordnen.<//>`}
      <div class="liste">
        ${e.uebungen.map((t) => html`<div class="zeile-uebung">
          <span>${t.name}</span>
          <span class="klein">${t.vorhanden ? `→ ${t.uebung.name} (schon vorhanden)` : t.katalog ? `→ ${t.uebung.name}` : 'neu angelegt'} · ${anzahl(t.saetze, 'Satz', 'Sätze')}</span>
          <span class=${'klein ' + (t.uebung.primaer.length ? 'leise' : 'pflicht-text')}>${muskelText(t.uebung)}</span>
        </div>`)}
      </div>
    <//>`;
}

function ImportZuordnung({ vm }) {
  const lauf = vm.ui.import;
  if (!lauf) return html`<${Weg} vm=${vm} />`;
  const z = lauf.zuordnung;
  const optionen = [-1, ...lauf.kopf.map((_, i) => i)];
  const spalte = (i) => (i < 0 ? '–' : lauf.kopf[i] || `Spalte ${i + 1}`);
  const setz = (f, i) => {
    const sp = { ...z.spalten };
    if (i < 0) delete sp[f]; else sp[f] = i;
    vm.importZuordnung({ ...z, spalten: sp });
  };
  const messwertFehlt = !['GEWICHT', 'WDH', 'SEKUNDEN', 'STRECKE'].some((f) => f in z.spalten);
  const beispiel = lauf.text.split(/\r?\n/).slice(1).find((x) => x.trim());
  return html`
    <${Page} titel="Spalten zuordnen" zurueck=${() => history.back()}
      unten=${html`<${Knopf} deaktiviert=${!T.vollstaendig(z)} onClick=${() => vm.importLesen(lauf.text, z)}>Mit dieser Zuordnung lesen<//>`}>
      <p>Welche Spalte der Datei enthält was? Eine Zeile der Datei ist ein Satz.</p>
      ${Object.entries(FELDER).map(([f, titel]) => html`
        <${Auswahl} key=${f} label=${titel + (f === 'DATUM' || f === 'UEBUNG' ? ' *' : '')} optionen=${optionen} wert=${z.spalten[f] ?? -1} text=${spalte} onWahl=${(i) => setz(f, i)} />
        ${(f === 'DATUM' || f === 'UEBUNG') && !(f in z.spalten) && html`<span class="klein pflicht-text">Pflichtfeld</span>`}
        ${f === 'STRECKE' && messwertFehlt && html`<span class="klein pflicht-text">Mindestens Gewicht, Wiederholungen, Zeit oder Strecke</span>`}`)}
      <${Schalter} label="Gewicht steht in Pfund (lb)" an=${z.gewichtLb} onWechsel=${(v) => vm.importZuordnung({ ...z, gewichtLb: v })} />
      <${Auswahl} label="Strecke in" optionen=${[1000, 1, 1609.344]} wert=${z.meterJeEinheit} text=${(x) => (x === 1 ? 'Metern' : x === 1000 ? 'Kilometern' : 'Meilen')} onWahl=${(v) => vm.importZuordnung({ ...z, meterJeEinheit: v })} />
      <${Schalter} label="Trainingsdauer als Sekunden" an=${z.dauerInSekunden} hilfe="Sonst Minuten oder „1h 5m“" onWechsel=${(v) => vm.importZuordnung({ ...z, dauerInSekunden: v })} />
      ${beispiel && html`<${Abschnitt} titel="Erste Datenzeile"><p class="rohtext">${beispiel}</p><//>`}
    <//>`;
}
