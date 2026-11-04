// Gemeinsames Körperprofil für Training und Food & Boost (wie Personendaten.kt in der Android-App).
// Gespeichert im Stand von Food & Boost (koerper), damit es in der Sicherung steckt; [profil] merkt sich, dass
// die Werte bewusst eingetragen wurden, auch wenn Food & Boost noch nicht eingerichtet ist.
import { useState, useEffect } from '../vendor/preact-htm.js';
import * as L from './logik.js';
import { Format, Pegel } from './logik.js';
import { standLaden, standSpeichern, trainingLaden, trainingSpeichern, alleSchreiben } from './speicher.js';
import { html, Page, Abschnitt, Klein, Knopf, ZahlFeld, Auswahl } from './teile.js';

/** Kurz für Anzeigen, z. B. „75 kg · 178 cm · männlich · Jahrgang 1995“. */
export const profilKurz = (k) => [`${Format.zahl(k.gewichtKg)} kg`, `${Format.zahl(k.groesseCm, 0)} cm`, L.Geschlecht[k.geschlecht], `Jahrgang ${k.geburtsjahr}`].join(' · ');

/**
 * Einmal beim Start: Ein eigenes Körpergewicht aus dem Training (älterer Stand) wandert ins Profil, wenn dort noch
 * nichts eingetragen ist. Danach gilt nur noch das Profil.
 */
export async function profilAbgleichen() {
  const [f, t] = await Promise.all([standLaden(), trainingLaden()]);
  const kg = t.einstellungen.koerpergewicht;
  if (!(kg > 0)) return;
  if (!L.profilGesetzt(f)) standSpeichern({ ...f, koerper: { ...f.koerper, gewichtKg: kg }, profil: true });
  trainingSpeichern({ ...t, einstellungen: { ...t.einstellungen, koerpergewicht: 0 } });
  await alleSchreiben();
}

export function ProfilSeite({ schliessen }) {
  const [f, setF] = useState(null);
  const [k, setK] = useState(null);
  const [gespeichert, setGespeichert] = useState(false);
  useEffect(() => { standLaden().then((x) => { setF(x); setK(x.koerper); }); }, []);
  if (!k) return html`<div class="laden">Lädt …</div>`;
  const jahr = new Date().getFullYear();
  const K = (o) => { setK({ ...k, ...o }); setGespeichert(false); };
  const speichern = async () => {
    const neu = { ...f, koerper: L.koerper(k), profil: true };
    standSpeichern(neu);
    await alleSchreiben();
    setF(neu);
    setGespeichert(true);
  };
  return html`
    <div class="app"><div class="bildschirm">
      <${Page} titel="Profil" zurueck=${schliessen}
        unten=${html`<${Knopf} onClick=${speichern}>${gespeichert ? 'Gespeichert ✓' : 'Speichern'}<//>`}>
        <${Klein}>Deine Körperdaten an einer Stelle. Sie gelten für Training (Klimmzüge, Dips, Kraftniveau, Verbrauch) und Food & Boost (Tagesziele, Alkohol). Die Daten bleiben auf dem Gerät.<//>
        <${Abschnitt} titel="Körper">
          <${ZahlFeld} label="Gewicht (kg)" wert=${k.gewichtKg} onWert=${(v) => K({ gewichtKg: v })} />
          <${ZahlFeld} label="Größe (cm)" wert=${k.groesseCm} onWert=${(v) => K({ groesseCm: v })} />
          <${ZahlFeld} label="Geburtsjahr" wert=${k.geburtsjahr} onWert=${(v) => K({ geburtsjahr: Math.round(v) })} hilfe=${`Alter: ${Pegel.alter(k, jahr)}`} />
          <${Auswahl} label="Geschlecht" optionen=${['MANN', 'FRAU']} wert=${k.geschlecht} text=${(g) => L.Geschlecht[g]} onWahl=${(g) => K({ geschlecht: g })} />
          <${ZahlFeld} label="Körperfettanteil (%)" wert=${k.kfaProzent} onWert=${(v) => K({ kfaProzent: v })} hilfe="Freiwillig. Nur für die Alkohol-Rechnung „aus Körperfettanteil“." />
        <//>
        ${!L.profilGesetzt(f) && html`<${Klein} leise>Noch nicht gespeichert: bis dahin rechnet die App mit Durchschnittswerten.<//>`}
      <//>
    </div></div>`;
}
