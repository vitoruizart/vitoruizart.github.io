const CACHE_NAME = 'feditor-v1';
const CORE_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'css/app.css',
  'js/app.js',
  'js/register-sw.js',
  'js/state.js',
  'js/db.js',
  'js/screens/pick-painting.js',
  'js/screens/pick-frame.js',
  'js/screens/pick-room.js',
  'js/screens/edit.js',
  'js/screens/export.js',
  'js/components/thumb-grid.js',
  'js/components/strip-cropper.js',
  'js/components/tilt-panel.js',
  'js/components/toast.js',
  'js/lib/transform.js',
  'js/lib/gestures.js',
  'js/lib/image-io.js',
  'js/lib/frame-render.js',
  'js/lib/export-canvas.js',
  'js/lib/constants.js',
  'js/lib/drafts.js',
  'js/lib/install-hint.js',
  'js/lib/update-checker.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'assets/frames/index.json',
  'assets/rooms/index.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.pathname.endsWith('/version.json')) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
