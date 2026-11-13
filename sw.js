// Service Worker: speichert die App und alle Daten beim ersten Öffnen, danach läuft alles ohne Internet.
// Die Dateiliste und VERSION schreibt werkzeuge/sw-bauen.py; jede Änderung an einer Datei ergibt eine neue Version.
const VERSION = 'a894be6b2109';
const KERN = ["./", "index.html", "manifest.webmanifest", "css/app.css", "js/app.js", "js/daten.js", "js/einkauf-logik.js", "js/einkauf.js", "js/figuren-daten.js", "js/figuren.js", "js/haupt.js", "js/logik.js", "js/muskelteile.js", "js/profil.js", "js/scan.js", "js/sicherung.js", "js/speicher.js", "js/teile.js", "js/training-logik.js", "js/training.js", "fonts/nunito_bold.ttf", "fonts/nunito_extrabold.ttf", "fonts/nunito_semibold.ttf", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/icon.svg", "vendor/preact-htm.js", "vendor/zxing/zxing-reader.js", "vendor/zxing/zxing_reader.wasm"];
const REST = ["vendor/tesseract/tesseract.min.js", "vendor/tesseract/worker.min.js", "vendor/tesseract/core/tesseract-core-lstm.wasm.js", "vendor/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js", "vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js", "vendor/tesseract/lang/deu.traineddata.gz", "daten/lebensmittel.tsv.gz", "daten/namen.tsv.gz", "daten/naehrwerte/00.tsv.gz", "daten/naehrwerte/01.tsv.gz", "daten/naehrwerte/02.tsv.gz", "daten/naehrwerte/03.tsv.gz", "daten/naehrwerte/04.tsv.gz", "daten/naehrwerte/05.tsv.gz", "daten/naehrwerte/06.tsv.gz", "daten/naehrwerte/07.tsv.gz", "daten/naehrwerte/08.tsv.gz", "daten/naehrwerte/09.tsv.gz", "daten/naehrwerte/10.tsv.gz", "daten/naehrwerte/11.tsv.gz", "daten/naehrwerte/12.tsv.gz", "daten/naehrwerte/13.tsv.gz", "daten/naehrwerte/14.tsv.gz", "daten/naehrwerte/15.tsv.gz", "daten/naehrwerte/16.tsv.gz", "daten/naehrwerte/17.tsv.gz", "daten/naehrwerte/18.tsv.gz", "daten/naehrwerte/19.tsv.gz", "daten/naehrwerte/20.tsv.gz", "daten/naehrwerte/21.tsv.gz", "daten/naehrwerte/22.tsv.gz", "daten/naehrwerte/23.tsv.gz", "daten/naehrwerte/24.tsv.gz", "daten/naehrwerte/25.tsv.gz", "daten/naehrwerte/26.tsv.gz", "daten/naehrwerte/27.tsv.gz", "daten/naehrwerte/28.tsv.gz", "daten/naehrwerte/29.tsv.gz", "daten/naehrwerte/30.tsv.gz", "daten/naehrwerte/31.tsv.gz", "daten/naehrwerte/32.tsv.gz", "daten/naehrwerte/33.tsv.gz", "daten/naehrwerte/34.tsv.gz", "daten/naehrwerte/35.tsv.gz", "daten/naehrwerte/36.tsv.gz", "daten/naehrwerte/37.tsv.gz", "daten/naehrwerte/38.tsv.gz", "daten/naehrwerte/39.tsv.gz", "daten/naehrwerte/40.tsv.gz", "daten/naehrwerte/41.tsv.gz", "daten/naehrwerte/42.tsv.gz", "daten/naehrwerte/43.tsv.gz", "daten/naehrwerte/44.tsv.gz", "daten/naehrwerte/45.tsv.gz", "daten/naehrwerte/46.tsv.gz", "daten/naehrwerte/47.tsv.gz", "daten/naehrwerte/48.tsv.gz", "daten/naehrwerte/49.tsv.gz", "daten/naehrwerte/50.tsv.gz", "daten/naehrwerte/51.tsv.gz", "daten/naehrwerte/52.tsv.gz", "daten/naehrwerte/53.tsv.gz", "daten/naehrwerte/54.tsv.gz", "daten/naehrwerte/55.tsv.gz", "daten/naehrwerte/56.tsv.gz", "daten/naehrwerte/57.tsv.gz", "daten/naehrwerte/58.tsv.gz", "daten/naehrwerte/59.tsv.gz", "daten/naehrwerte/60.tsv.gz", "daten/naehrwerte/61.tsv.gz", "daten/naehrwerte/62.tsv.gz", "daten/naehrwerte/63.tsv.gz", "daten/naehrwerte/64.tsv.gz", "daten/naehrwerte/65.tsv.gz", "daten/naehrwerte/66.tsv.gz", "daten/naehrwerte/67.tsv.gz", "daten/naehrwerte/68.tsv.gz", "daten/naehrwerte/69.tsv.gz", "daten/naehrwerte/70.tsv.gz", "daten/naehrwerte/71.tsv.gz", "daten/naehrwerte/72.tsv.gz", "daten/naehrwerte/73.tsv.gz", "daten/naehrwerte/74.tsv.gz", "daten/naehrwerte/75.tsv.gz", "daten/naehrwerte/76.tsv.gz", "daten/naehrwerte/77.tsv.gz", "daten/naehrwerte/78.tsv.gz", "daten/naehrwerte/79.tsv.gz", "daten/naehrwerte/80.tsv.gz", "daten/naehrwerte/81.tsv.gz", "daten/naehrwerte/82.tsv.gz", "daten/naehrwerte/83.tsv.gz", "daten/naehrwerte/84.tsv.gz", "daten/naehrwerte/85.tsv.gz", "daten/naehrwerte/86.tsv.gz", "daten/naehrwerte/87.tsv.gz", "daten/naehrwerte/88.tsv.gz", "daten/naehrwerte/89.tsv.gz", "daten/naehrwerte/90.tsv.gz", "daten/naehrwerte/91.tsv.gz", "daten/naehrwerte/92.tsv.gz", "daten/naehrwerte/93.tsv.gz", "daten/naehrwerte/94.tsv.gz", "daten/naehrwerte/95.tsv.gz", "daten/naehrwerte/96.tsv.gz", "daten/naehrwerte/97.tsv.gz", "daten/naehrwerte/98.tsv.gz", "daten/naehrwerte/99.tsv.gz", "daten/naehrwerte/info.json"];
const CACHE = 'food-boost-' + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(KERN);
    // Daten und Erkennung: einzeln, ein Fehler bricht die Installation nicht ab (wird beim Abruf nachgeholt).
    const alt = (await caches.keys()).filter((k) => k !== CACHE && k.startsWith('food-boost-'));
    for (let i = 0; i < REST.length; i += 8) {
      await Promise.allSettled(REST.slice(i, i + 8).map(async (url) => {
        for (const k of alt) { const r = await (await caches.open(k)).match(url); if (r) return c.put(url, r); }
        return c.add(url);
      }));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k.startsWith('food-boost-')) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const pfad = e.request.mode === 'navigate' ? new URL('./index.html', self.registration.scope).href : url.href.split('#')[0].split('?')[0];
    const treffer = await c.match(pfad);
    if (treffer) return treffer;
    const r = await fetch(e.request);
    if (r.ok && r.type === 'basic') c.put(pfad, r.clone());
    return r;
  })());
});
