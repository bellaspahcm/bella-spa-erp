const CACHE_NAME = 'bella-spa-erp-v2';
const IS_LOCAL_DEV =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1' ||
  self.location.hostname === '::1';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/FullLogo_Transparent_NoBuffer.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/favicon.ico'
];

// Install Event - Precache static assets
self.addEventListener('install', (event) => {
  // Skip precaching - just activate immediately
  event.waitUntil(self.skipWaiting());
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  // Clear all caches and claim clients immediately
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(cacheNames.map((cache) => caches.delete(cache))))
      .then(() => self.clients.claim())
  );
});

// Fetch Event - Disable all caching temporarily
self.addEventListener('fetch', (event) => {
  // Let browser handle all requests normally (no caching)
  return;
});
