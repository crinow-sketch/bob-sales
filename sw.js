// BOB Sales Tracker - Service Worker for Offline Support
const CACHE_NAME = 'bob-sales-v7';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/db.js',
  './js/app.js',
  './js/dashboard.js',
  './js/accounts.js',
  './js/activity.js',
  './js/pipeline.js',
  './js/sales.js',
  './js/routes.js',
  './js/import-export.js',
  './js/doc-import.js',
  './js/nearby.js',
  './js/sync.js',
  './data/seed.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
];

// Install: cache all app assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for data files, cache-first for app assets
self.addEventListener('fetch', (event) => {
  // Never cache API calls — always go to network
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first for data files so we always get fresh data
  if (event.request.url.includes('seed.json') || event.request.url.includes('sync-data.json') || event.request.url.includes('/data/')) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // Offline: fall back to cached version
        return caches.match(event.request);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache new successful requests
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // Offline fallback for HTML pages
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
