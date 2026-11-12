// Service Worker untuk PWA Presensi SMA Islam Daarul Ilmi Depok
var CACHE_NAME = 'daarulilmi-presensi-v1';

self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.map(function(k) {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Network first strategy
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET' || e.request.url.indexOf('http') !== 0) return;
  
  e.respondWith(
    fetch(e.request).catch(function() {
      return caches.match(e.request);
    })
  );
});

