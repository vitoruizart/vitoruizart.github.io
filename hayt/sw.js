// Service worker — cache-first for static assets, skip GitHub API
const CACHE_NAME = 'hayt-v4';
const STATIC_ASSETS = [
  '/hayt/',
  '/hayt/index.html',
  '/hayt/css/app.css',
  '/hayt/js/register-sw.js',
  '/hayt/js/app.js',
  '/hayt/js/db.js',
  '/hayt/js/state.js',
  '/hayt/js/sync.js',
  '/hayt/js/crypto.js',
  '/hayt/js/github-api.js',
  '/hayt/js/lib/constants.js',
  '/hayt/js/lib/date-utils.js',
  '/hayt/js/lib/validators.js',
  '/hayt/js/lib/update-checker.js',
  '/hayt/js/components/mood-faces.js',
  '/hayt/js/components/calendar-grid.js',
  '/hayt/js/components/trend-chart.js',
  '/hayt/js/components/toast.js',
  '/hayt/js/components/mood-banner.js',
  '/hayt/js/components/mood-gauge.js',
  '/hayt/js/components/mood-insights.js',
  '/hayt/js/components/nav.js',
  '/hayt/js/screens/mood-prompt.js',
  '/hayt/js/screens/calendar.js',
  '/hayt/js/screens/day-detail.js',
  '/hayt/js/screens/settings.js',
  '/hayt/manifest.json',
  '/hayt/icons/icon-192.png',
  '/hayt/icons/icon-512.png',
  '/hayt/icons/mood-5.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        STATIC_ASSETS.map((url) =>
          fetch(url, { cache: 'reload' }).then((res) => cache.put(url, res)),
        ),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache GitHub API calls
  if (url.hostname === 'api.github.com') return;

  // Never cache version.json — used for update checks
  if (url.pathname.endsWith('/version.json')) return;

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Only cache same-origin successful responses
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    }),
  );
});
