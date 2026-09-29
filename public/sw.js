// Schemax PWA Service Worker
// Handles offline caching and install prompt support

const CACHE_NAME = 'schemax-v3';

// Core app shell files to cache for offline support
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-512.svg',
];

// Install: cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Silently ignore cache failures during install
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: Network-first strategy (always try network, fallback to cache)
self.addEventListener('fetch', (event) => {
  // Skip non-GET and chrome-extension requests
  if (event.request.method !== 'GET') return;
  // IMPORTANT: Do NOT intercept cross-origin requests (Google Apps Script, Google APIs, AI APIs, etc.)
  // Let the browser handle cross-origin network requests directly.
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful HTML/JS/CSS responses
        if (response && response.status === 200) {
          const url = event.request.url;
          if (
            url.endsWith('.html') ||
            url.endsWith('.js') ||
            url.endsWith('.css') ||
            url.endsWith('.svg') ||
            url.endsWith('.png') ||
            url === self.location.origin + '/'
          ) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Return the cached index.html for navigation requests (SPA fallback)
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Offline or Service Unavailable' });
        });
      })
  );
});
