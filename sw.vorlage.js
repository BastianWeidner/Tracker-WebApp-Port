// Service Worker: speichert die App und alle Daten beim ersten Öffnen, danach läuft alles ohne Internet.
// Die Dateiliste und VERSION schreibt werkzeuge/sw-bauen.py; jede Änderung an einer Datei ergibt eine neue Version.
const VERSION = '__VERSION__';
const KERN = __KERN__;
const REST = __REST__;
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
