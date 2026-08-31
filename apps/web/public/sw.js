const CACHE_NAME = 'portage-v4';
const STATIC_ASSETS = ['/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept mutations: iOS WebKit drops multipart bodies when a
  // POST is replayed through respondWith(fetch(request)) — uploads arrive
  // with content-length: 0 (empty-body 500s seen 07-10 → 08-31).
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Network-first for API calls
  if (url.pathname.startsWith('/api') || url.origin !== self.location.origin) {
    return;
  }

  // Cache-first for static assets
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'style'
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
      )
    );
    return;
  }

  // Network-first for pages
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
