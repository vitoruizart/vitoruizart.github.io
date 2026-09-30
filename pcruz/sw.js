// Cache Storage is shared by every app on this origin (feditor, hayt…), so
// only caches with our prefix are ever deleted.
const CACHE_PREFIX = 'pcruz-';
const CACHE_NAME = CACHE_PREFIX + 'v1';
const CORE_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'css/app.css',
  'js/app.js',
  'js/register-sw.js',
  'js/state.js',
  'js/db.js',
  'js/screens/pick-image.js',
  'js/screens/setup.js',
  'js/screens/crop.js',
  'js/screens/pattern.js',
  'js/screens/preview.js',
  'js/screens/export.js',
  'js/components/toast.js',
  'js/components/update-modal.js',
  'js/lib/chart-render.js',
  'js/lib/chart-view.js',
  'js/lib/color.js',
  'js/lib/constants.js',
  'js/lib/crop.js',
  'js/lib/dmc.js',
  'js/lib/drafts.js',
  'js/lib/exporters.js',
  'js/lib/frames.js',
  'js/lib/gestures.js',
  'js/lib/image-io.js',
  'js/lib/install-hint.js',
  'js/lib/layout.js',
  'js/lib/pace.js',
  'js/lib/pdf-writer.js',
  'js/lib/pipeline.js',
  'js/lib/png-encode.js',
  'js/lib/quantize.js',
  'js/lib/resample.js',
  'js/lib/skeins.js',
  'js/lib/symbols.js',
  'js/lib/update-checker.js',
  'js/lib/zlib.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((names) => Promise.all(names.filter((n) => n.startsWith(CACHE_PREFIX)).map((n) => caches.delete(n))))
    );
  }
});

// Code and markup are served network-first so a new deploy is picked up on
// the very next online load; icons stay cache-first (the cache-name bump
// flushes them when they change).
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/version.json')) return;

  if (url.pathname.includes('/icons/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      }))
    );
    return;
  }

  event.respondWith(
    fetch(event.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return res;
    }).catch(() => caches.match(event.request))
  );
});
