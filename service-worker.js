/**
 * Sit-Still Digital Business Card — Service Worker
 * Provides offline support via a cache-first strategy for app shell assets.
 */

const CACHE_NAME = 'sit-still-v11';

// Assets to pre-cache on install (app shell)
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './contact.html',
  './style.css',
  './app.js',
  './manifest.json',
  './qrcode.min.js',
  './will-dibernardo.vcf',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // Inter Variable font (covers all weights in a single file)
  './fonts/Inter-VariableFont_opsz,wght.ttf',
];

// ─── Install ─────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Activate immediately without waiting for existing clients to close
  self.skipWaiting();
});

// ─── Activate ────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

// ─── Fetch ───────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (e.g. CDN-loaded QR library) —
  // let the browser handle those normally so the app still works offline
  // using whatever is already in the HTTP cache.
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    // Network-first for external CDN assets; fall back to cache if offline
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first strategy for same-origin app shell assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((networkResponse) => {
        // Cache a clone of the new response for next time
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});
