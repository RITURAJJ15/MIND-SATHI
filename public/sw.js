// MIND SATHI Service Worker (PWA Offline Support v3)
const CACHE_NAME = 'mind-sathi-cache-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/caregiver.html',
  '/favicon.png',
  '/logo_icon.png',
  '/logo.png',
  '/indian_flag_wave.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Cache addAll notice:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Exclude all serverless API endpoints, Supabase cloud database, and non-GET requests from caching
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase.co') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Handle SPA Navigation requests: Network-first with immediate offline fallback to cached shell
  if (event.request.mode === 'navigate') {
    const isCaregiver = url.pathname.startsWith('/caregiver');
    const fallbackHtml = isCaregiver ? '/caregiver.html' : '/index.html';

    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(fallbackHtml, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(fallbackHtml);
          if (cached) return cached;
          const rootCached = await caches.match('/');
          if (rootCached) return rootCached;
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>MIND SATHI Offline</title></head><body><h2>MIND SATHI is Offline</h2><p>Please reconnect to the internet.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // Handle static assets (scripts, styles, images, web fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || networkResponse.type === 'cors')
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
