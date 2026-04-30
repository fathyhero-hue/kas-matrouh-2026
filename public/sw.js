const CACHE_NAME = 'matrouh-cup-cache-v1';
const urlsToCache = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // لو لقى الداتا متخزنة يفتحها، لو ملقاش يطلبها من النت
        return response || fetch(event.request);
      })
  );
});