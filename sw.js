/* TrainerExpert service worker — cache estáticos; red para API/proxy/.env */
const CACHE_NAME = 'trainerexpert-v1';
const PRECACHE = [
  './',
  './index.html',
  './app.js',
  './scenarios.js',
  './style.css',
  './logo.png',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/marked.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-only for API, env, handbooks, profiles
  if (
    url.pathname.includes('/api/') ||
    url.pathname.endsWith('/.env') ||
    url.pathname.includes('/handbooks/') ||
    url.pathname.endsWith('/candidate.md') ||
    url.pathname.endsWith('/interviewer.md')
  ) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
