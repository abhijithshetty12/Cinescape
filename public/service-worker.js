/* Cinescape Service Worker

Goals:
- Cache the app shell + static assets so the UI loads offline.
- Runtime-cache images.
- Provide a background sync hook for watchlist operations queued in IndexedDB.

Note:
Firestore writes are performed from the service worker via REST is non-trivial
without embedding auth. For this project we implement a production-grade queue
mechanism, but the actual Firestore write is triggered client-side when it
receives network back OR when the app posts a "flush" message.
*/

const VERSION = 'v1';
const APP_SHELL_CACHE = `cinescape-shell-${VERSION}`;
const IMAGE_CACHE = `cinescape-images-${VERSION}`;

const SHELL_URLS = [
  '/',
  '/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then(async (cache) => {
        for (const url of SHELL_URLS) {
          try {
            await cache.add(url);
          } catch {
            // ignore
          }
        }
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => (k.startsWith('cinescape-') ? k : null))))
      .then(() => {
        // Keep caches with current VERSION
        return caches.keys().then((keys) =>
          Promise.all(
            keys.map((k) => {
              if ((k.startsWith('cinescape-shell-') && k !== APP_SHELL_CACHE) || (k.startsWith('cinescape-images-') && k !== IMAGE_CACHE)) {
                return caches.delete(k);
              }
              return Promise.resolve();
            })
          )
        );
      })
      .then(() => self.clients.claim())
  );
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Navigation: network-first, fallback to shell
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          return caches.open(APP_SHELL_CACHE).then((cache) => {
            cache.put(request, res.clone()).catch(() => {});
            return res;
          });
        })
        .catch(() => {
          return caches.match('/index.html').then((cached) => cached || new Response('Offline', { status: 200 }));
        })
    );
