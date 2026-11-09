# Gym: Training und Food & Boost (Web-App)

Beim Start eine Übersicht mit drei Bereichen:

- **Training:** Workouts mit Sätzen, Wiederholungen und Gewicht, Fortschritt je Übung, Belastung je Muskelgruppe,
  Import aus Stronger, Strong, Hevy und FitNotes.
- **Food & Boost:** Kalorien, Makros und Mikros, Supplements mit Einnahmeplan und Vorrat sowie Koffein und Alkohol
  mit geschätztem Abbau.
- **Einkaufsliste:** Liste zum Abhaken; was in Food & Boost oft eingetragen wird, kommt als Vorschlag in üblichen
  Gebinden (Palette, Kasten, 6er-Pack).

Web-Fassung der Unter-Apps „Krafttraining“, „Food & Boost“ und „Einkaufsliste“ aus der Android-Dach-App, damit sie auch auf dem
iPhone laufen.

**Alles bleibt auf dem Gerät.** Kein Konto, kein Server, keine Werbung. Die Daten liegen im Browser-Speicher des
Handys (IndexedDB). Nach dem ersten Öffnen läuft die App komplett offline, auch der Barcode-Scan, die
Barcode-Datenbank mit 237.140 Produkten und die Texterkennung für Nährwerttabellen.

## Für Freunde: installieren (iPhone)

1. Den Link in **Safari** öffnen (nicht in Instagram, WhatsApp-Vorschau o. Ä.).
2. Unten auf **Teilen** ⬆︎ tippen, dann **„Zum Home-Bildschirm“**.
3. „Gym“ vom Home-Bildschirm starten, Bereich wählen, fertig. Food & Boost fragt beim ersten Öffnen nach den Körperdaten.

Beim ersten Start mit Internet lädt die App alles (ca. 30 MB) für den Offline-Betrieb. Danach braucht sie kein Netz.
Android: in Chrome öffnen, Menü ⋮ → „App installieren“.

**Wichtig: Sicherung.** Safari kann die Daten einer Web-App löschen, wenn sie mehrere Wochen nicht geöffnet wurde.
Unter Training › „Daten“ oder Food & Boost › „Profil“ eine Sicherung in „Dateien“ oder iCloud ablegen; eine Datei
enthält beide Bereiche. Sicherungen der Android-App (Food & Boost bzw. `krafttraining.json`) lassen sich laden.

## Was drin ist

### Training

- **Training:** leeres Training starten oder ein früheres wiederholen. Rund 150 eingebaute Übungen (Bewegung ×
  Gerät) oder eigene. Je Satz Gewicht und Wiederholungen (Körpergewicht ± Zusatz, Sekunden, Strecke/Zeit),
  Satzart (Aufwärmen, Drop, bis Versagen), Abhaken mit Pausen-Timer und Ton, „Letztes Mal“ als Vorschlag,
  neue Bestwerte nach dem Training. Der Bildschirm bleibt während des Trainings an.
- **Übungsbilder:** Jede Übung hat eine selbst gezeichnete Figur mit ihrem Gerät (Hantel, Kabelzug, Maschine,
  Bank …). Die Hauptmuskeln sind kräftig markiert, mitarbeitende heller. In der Übungsansicht läuft die Bewegung als
  Animation (aus bei „Bewegung reduzieren“), in Listen und im Training steht ein kleines Bild.
- **Verlauf:** Trainings je Woche, alle Übungen. Je Übung ein Diagramm (geschätztes 1RM nach Epley, schwerstes
  Gewicht, Volumen, Wiederholungen; 3 Monate, 1 Jahr, alles), Bestwerte, Kraftniveau bei Grundübungen.
- **Muskeln:** Körperbild vorn und hinten nach Belastung (harte Sätze in 7/14/30 Tagen gegen 10–20 je Woche),
  Erholung oder Kraftniveau.
- **Daten:** Import von CSV-Dateien (Stronger-Datenauskunft, Strong, Hevy, FitNotes, freie Spaltenzuordnung),
  Anleitung und Musterbrief für die DSGVO-Auskunft bei Stronger, Einstellungen, Sicherung.
- **Verbrauch:** Jedes Training bekommt einen geschätzten Zusatzverbrauch (Netto-MET). Food & Boost zeigt ihn
  beim Tag an und rechnet ihn auf Wunsch ins Kalorienziel ein (Profil › „Trainings einrechnen“).

### Food & Boost

- **Pegel/Koffein:** Blutalkohol nach Widmark mit Körperwasser (Watson oder Körperfettanteil), Koffein mit
  Halbwertszeit, Verlauf −6 h bis +12 h. Nur Schätzwerte, nicht zur Entscheidung übers Fahren.
- **Essen:** Kalorien, Makros, Trinken, Eiweiß über den Tag, Zucker/Salz/gesättigte Fette, 26 Vitamine und
  Mineralstoffe gegen DGE-Referenzwerte.
- **Boost:** Supplements, Proteine, Booster mit Einnahmeplan zum Abhaken, Wirkstoffen, Vorrat und Hinweisen.
- **Einnahmeplan selbst bauen:** je Zeitpunkt aus eigenen Produkten oder Vorlagen (Kapseln, Whey, je Wirkstoff ein Pulver)
  hinzufügen. Die Prüfung zeigt die Tagesmengen laut Plan, Höchstmengen für Supplements (EFSA/BfR) und
  Wechselwirkungen (5-HTP und Tryptophan, Koffein am Abend, Zink und Calcium, Kuren).
- **Profil:** Gewicht, Größe, Jahrgang, Geschlecht und KFA einmal in der Übersicht; gilt für Training und Food & Boost.
  30 Vorlagen (ESN, MORE, Bodylab, Bodybuilding Depot, MyProtein, ohne Marke) mit Richtwerten nach Hersteller- und
  Händlerangaben; Sorten weichen ab, darum sind sie als „Richtwert“ markiert, bis das Etikett gescannt ist.
- **Scan:** Barcode live mit der Kamera (ZXing, WebAssembly) und Foto der Nährwerttabelle (Tesseract, deutsch).
- **Mahlzeiten:** „Döner mit Pommes und eine Cola“ oder ein Rezept (getippt oder fotografiert) wird mit dem
  Bundeslebensmittelschlüssel geschätzt.

### Einkaufsliste

- **Liste:** Schnelleingabe wie „2x Milch 1,29“, „500 g Hack“ oder „Butter 1,99 €“, abhaken, Menge ändern, erledigte
  entfernen, als Text teilen (z. B. in WhatsApp).
- **Vorschläge aus Food & Boost:** Was mindestens 4-mal an 3 Tagen in 4 Wochen eingetragen wurde, erscheint oben als
  Vorschlag, gerundet auf übliche Gebinde: Dosen als 6er-, 12er- oder 24er-Palette, Plastikflaschen im 6er- oder
  9er-Pack bzw. Kasten, Bier und Mate im Kasten (20 × 0,5 l, 24 × 0,33 l), Milch und Pflanzendrinks im Karton.
  Die Menge reicht für 7 Tage (einstellbar). Abgehakte Käufe zählen mit: Solange vom letzten Kauf noch genug da sein
  müsste, kommt kein Vorschlag. „Später“ blendet 7 Tage aus, „Nicht mehr vorschlagen“ dauerhaft. Supplements und
  Proteine bleiben draußen (die haben ihren Vorrat unter Boost).
- Läden, Erinnerungen am Laden und Barcode-Scan gibt es nur in der Android-App.

## Veröffentlichen mit GitHub Pages

Repository → **Settings** → **Pages** → „Build and deployment“: Source **Deploy from a branch**, Branch **main**,
Ordner **/ (root)** → Save. Nach ein bis zwei Minuten läuft die App unter
`https://<benutzer>.github.io/<repo>/`. Pages braucht ein öffentliches Repository (oder ein bezahltes Konto).
Im Repo liegt nur die App, keine persönlichen Daten.

## Ändern

Reines HTML/JavaScript ohne Build-Schritt (Preact + htm aus `vendor/`). Nach jeder Änderung
`python3 werkzeuge/sw-bauen.py` ausführen: Das schreibt `sw.js` mit neuer Version, sonst sehen installierte
Apps die Änderung nicht. Lokal testen: `python3 -m http.server` im Ordner, dann `http://localhost:8000`.
Logik-Tests: `node test/logik.test.mjs`, `node test/training.test.mjs`, `node test/figuren.test.mjs` und `node test/einkauf.test.mjs`.

Übungsbilder: Die Haltungen entstehen in `werkzeuge/figuren/haltungen.py` (Python, gleiche Rechnung wie
`js/figuren.js` und die Android-App). Nach Änderungen `python3 export.py` in dem Ordner ausführen und
`figuren.json` als `js/figuren-daten.js` übernehmen (siehe `werkzeuge/figuren/README.md`).

| Ordner | Inhalt |
|---|---|
| `js/haupt.js` | Einstieg, Übersicht mit den beiden Bereichen |
| `js/profil.js` | Gemeinsames Körperprofil |
| `js/logik.js` | Rechenlogik Food & Boost (aus der Android-App übertragen), Wissen zu Höchstmengen, Vorgaben, Vorlagen |
| `js/training-logik.js`, `js/training.js` | Training: Übungskatalog, Rechnung, Import; Oberfläche |
| `js/figuren.js`, `js/figuren-daten.js` | Übungsbilder: Figur, Muskeln, Geräte, Animation; Haltungen (erzeugt) |
| `js/sicherung.js` | Gemeinsame Sicherungsdatei |
| `js/app.js`, `js/teile.js` | Oberfläche Food & Boost, gemeinsame Bausteine |
| `js/scan.js` | Kamera, Barcode, Texterkennung |
| `js/daten.js`, `js/speicher.js` | Mitgelieferte Datenbanken, Speicher auf dem Gerät |
| `daten/` | Barcode-Datenbank in 100 Teilen, Lebensmittel-Tabelle |
| `vendor/` | Preact/htm, Tesseract.js mit deutschen Sprachdaten, ZXing-WASM |
| `werkzeuge/` | Service Worker bauen, Datenbank teilen, Farben, Icons |

## Quellen und Lizenzen

- Barcode-Nährwerte: [Open Food Facts](https://world.openfoodfacts.org), Lizenz ODbL 1.0, Produkte aus Deutschland,
  bereinigt (Stand 2026-10-31).
- Lebensmittel: Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0.
- Tesseract.js und tesseract.js-core (Apache 2.0), deutsche Sprachdaten von tesseract-ocr/tessdata (Apache 2.0),
  zxing-wasm (MIT, ZXing-C++ Apache 2.0), Preact und htm (MIT), Schrift Nunito (SIL OFL 1.1).
  Lizenztexte in `vendor/lizenzen/` und `fonts/`.
- Referenzwerte: DGE; Koffein-Grenzen: EFSA. Keine medizinische Beratung.
