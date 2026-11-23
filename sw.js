/* sw.js – service worker: aplikace funguje offline.
   Strategie: stejný původ = „cache first + obnova na pozadí“, vše ostatní (mapové dlaždice,
   routing, Firebase) jde přímo na síť. Při změně souborů ZVYŠ VERSION, ať si zařízení stáhnou novou verzi. */
const VERSION = 'v18';
const CACHE = `cipisek-${VERSION}`;
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/style.css', 'css/fonts.css', 'fonts/bricolage-latin.woff2', 'fonts/bricolage-latin-ext.woff2',
  'js/app.js', 'js/util.js', 'js/store.js', 'js/photodb.js', 'js/domain.js', 'js/ui.js',
  'js/data.js', 'js/tracker.js', 'js/sync.js', 'js/tasks.js', 'js/feeding.js', 'js/insights.js',
  'js/help.js', 'js/lightbox.js', 'js/update.js', 'js/accent.js', 'js/weather.js', 'js/aid.js', 'js/deals.js', 'js/cards.js', 'js/vetcard.js', 'js/photopick.js', 'js/shareimg.js',
  'js/views/today.js', 'js/views/walks.js', 'js/views/training.js',
  'js/views/growth.js', 'js/views/health.js', 'js/views/settings.js',
  'js/views/feedtab.js', 'js/views/aidtab.js', 'js/views/food.js', 'js/views/milestones.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
  'vendor/leaflet/images/layers.png', 'vendor/leaflet/images/layers-2x.png',
  'vendor/leaflet/images/marker-icon.png', 'vendor/leaflet/images/marker-shadow.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();   // nová verze se použije hned, bez čekání na zavření aplikace
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('cipisek-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'GET_VERSION') e.ports[0]?.postMessage({ version: VERSION });
});

// klepnutí na upozornění otevře aplikaci
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./#/dnes');
  }));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    const refresh = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(refresh); return hit; }
    const res = await refresh;
    if (res) return res;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || (await cache.match('./'));
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  })());
});
