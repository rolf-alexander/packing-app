// Service worker: keeps a copy of the app on the phone so it opens with no internet.
// IMPORTANT: when you change any app file, bump VERSION so phones download the new files.
const VERSION = 'v4';
const CACHE = `packlist-${VERSION}`;
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/app.js',
  'js/store.js',
  'js/model.js',
  'js/util.js',
  'js/ui.js',
  'js/forms.js',
  'js/seed.js',
  'js/backup.js',
  'js/views/trips.js',
  'js/views/gear.js',
  'js/views/item.js',
  'js/views/check.js',
  'js/views/shop.js',
  'js/views/more.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// The page sends "skip" when you tap Update.
self.addEventListener('message', (e) => {
  if (e.data === 'skip') self.skipWaiting();
});

// Serve from the cache first; fall back to the network for anything not cached.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (req.mode === 'navigate') return (await cache.match('index.html')) || fetch(req);
      return (await cache.match(req, { ignoreSearch: true })) || fetch(req);
    })(),
  );
});
