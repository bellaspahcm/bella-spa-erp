// Install Event - activate immediately. V1 does not precache assets.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

// Activate Event - clean up legacy caches from older PWA experiments.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(cacheNames.map((cache) => caches.delete(cache))))
      .then(() => self.clients.claim())
  );
});

// Fetch Event - registration/installability only. No offline or runtime cache strategy in V1.
self.addEventListener('fetch', (event) => {
  // Let browser handle all requests normally (no caching)
  return;
});
