# Food & Boost (Web-App)

Kalorien, Makros und Mikros, Supplements mit Einnahmeplan und Vorrat sowie Koffein und Alkohol mit geschätztem Abbau.
Web-Fassung der Unter-App „Food & Boost“ aus der Android-Dach-App, damit sie auch auf dem iPhone läuft.

**Alles bleibt auf dem Gerät.** Kein Konto, kein Server, keine Werbung. Die Daten liegen im Browser-Speicher des
Handys (IndexedDB). Nach dem ersten Öffnen läuft die App komplett offline, auch der Barcode-Scan, die
Barcode-Datenbank mit 237.140 Produkten und die Texterkennung für Nährwerttabellen.

## Für Freunde: installieren (iPhone)

1. Den Link in **Safari** öffnen (nicht in Instagram, WhatsApp-Vorschau o. Ä.).
2. Unten auf **Teilen** ⬆︎ tippen, dann **„Zum Home-Bildschirm“**.
3. Food & Boost vom Home-Bildschirm starten, Körperdaten eintragen, fertig.

Beim ersten Start mit Internet lädt die App alles (ca. 30 MB) für den Offline-Betrieb. Danach braucht sie kein Netz.
Android: in Chrome öffnen, Menü ⋮ → „App installieren“.

**Wichtig: Sicherung.** Safari kann die Daten einer Web-App löschen, wenn sie mehrere Wochen nicht geöffnet wurde.
Unter „Profil“ › „Sicherung“ › „Speichern“ eine Datei in „Dateien“ oder iCloud ablegen. Die App erinnert daran.
Sicherungen passen auch zur Android-App (gleiches Format).

## Was drin ist

- **Pegel/Koffein:** Blutalkohol nach Widmark mit Körperwasser (Watson oder Körperfettanteil), Koffein mit
  Halbwertszeit, Verlauf −6 h bis +12 h. Nur Schätzwerte, nicht zur Entscheidung übers Fahren.
- **Essen:** Kalorien, Makros, Trinken, Eiweiß über den Tag, Zucker/Salz/gesättigte Fette, 26 Vitamine und
  Mineralstoffe gegen DGE-Referenzwerte.
- **Boost:** Supplements, Proteine, Booster mit Einnahmeplan zum Abhaken, Wirkstoffen, Vorrat und Hinweisen.
  30 Vorlagen (ESN, MORE, Bodylab, Bodybuilding Depot, MyProtein, ohne Marke) mit Richtwerten nach Hersteller- und
  Händlerangaben; Sorten weichen ab, darum sind sie als „Richtwert“ markiert, bis das Etikett gescannt ist.
- **Scan:** Barcode live mit der Kamera (ZXing, WebAssembly) und Foto der Nährwerttabelle (Tesseract, deutsch).
- **Mahlzeiten:** „Döner mit Pommes und eine Cola“ oder ein Rezept (getippt oder fotografiert) wird mit dem
  Bundeslebensmittelschlüssel geschätzt.

## Veröffentlichen mit GitHub Pages

Repository → **Settings** → **Pages** → „Build and deployment“: Source **Deploy from a branch**, Branch **main**,
Ordner **/ (root)** → Save. Nach ein bis zwei Minuten läuft die App unter
`https://<benutzer>.github.io/<repo>/`. Pages braucht ein öffentliches Repository (oder ein bezahltes Konto).
Im Repo liegt nur die App, keine persönlichen Daten.

## Ändern

Reines HTML/JavaScript ohne Build-Schritt (Preact + htm aus `vendor/`). Nach jeder Änderung
`python3 werkzeuge/sw-bauen.py` ausführen: Das schreibt `sw.js` mit neuer Version, sonst sehen installierte
Apps die Änderung nicht. Lokal testen: `python3 -m http.server` im Ordner, dann `http://localhost:8000`.
Logik-Tests: `node test/logik.test.mjs`.

| Ordner | Inhalt |
|---|---|
| `js/logik.js` | Rechenlogik (aus der Android-App übertragen), Vorgaben, Vorlagen |
| `js/app.js`, `js/teile.js` | Oberfläche |
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
