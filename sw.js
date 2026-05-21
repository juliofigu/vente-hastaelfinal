// sw.js - Service Worker para Evento 04-Jun
// En el evento 'fetch' o 'install' de tu sw.js
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Ignorar esquemas no soportados
  if (url.protocol === 'chrome-extension:' || 
      url.protocol === 'moz-extension:' ||
      url.protocol === 'extension:') {
    return;
  }
  
  // ... resto de tu lógica de caché
});
const CACHE_NAME = 'access-control-v1';
const ASSETS = [
  './', // index.html
  './html5-qrcode.min.js', // Librería QR (CRÍTICO)
  './manifest.json'
];

// 1. INSTALACIÓN: Guardar archivos en caché
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('✅ Cacheando archivos del evento...');
      return cache.addAll(ASSETS);
    })
  );
});

// 2. ACTIVACIÓN: Limpiar cachés viejas
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('🗑️ Eliminando cache vieja:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// 3. INTERCEPTAR PETICIONES: Cache-First Strategy
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      // Si está en caché, úsalo (funciona sin internet)
      if (response) {
        return response;
      }
      // Si no, ve a internet y guarda una copia
      return fetch(e.request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, networkResponse.clone());
          return networkResponse;
        });
      });
    })
  );
});