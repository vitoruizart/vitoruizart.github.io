const CACHE_NAME = 'feditor-v2';
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
  'js/components/update-modal.js',
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

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))))
    );
  }
});

// Code and markup are served network-first so a new deploy is picked up on
// the very next online load. Bundled static assets (icons, pre-shipped frame
// and room images) stay cache-first — they change rarely and the cache-name
// bump flushes them when they do.
function isStaticAsset(url) {
  return url.pathname.includes('/icons/') ||
         url.pathname.includes('/assets/frames/') ||
         url.pathname.includes('/assets/rooms/');
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/version.json')) return;

  if (isStaticAsset(url)) {
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

  // Network-first for code/markup, fall back to cache when offline.
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
