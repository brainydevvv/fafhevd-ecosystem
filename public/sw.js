const CACHE_NAME = 'fafhevd-pwa-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/apropos.html',
  '/domaines.html',
  '/dons.html',
  '/avis.html',
  '/icons/FHAFEVED COMPANY.jpg'
];

// Installation du Service Worker et mise en cache des ressources de base
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interception des requêtes réseau (Mode hors-ligne)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => {
        // Optionnel : renvoyer une page de secours hors-ligne si besoin
      });
    })
  );
});