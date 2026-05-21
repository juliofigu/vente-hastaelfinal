// sw.js - Service Worker para Evento 04-Jun
const CACHE_NAME = 'evento-04jun-v1';
const ASSETS = [
  './',
  './manifest.json',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

// 1. INSTALACIÓN
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('✅ Cacheando recursos...');
      return cache.addAll(ASSETS).catch(err => {
        console.log('⚠️ Algunos recursos no se cachearon:', err);
      });
    })
  );
  self.skipWaiting();
});

// 2. ACTIVACIÓN
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
  self.clients.claim();
});

// 3. INTERCEPTAR PETICIONES
self.addEventListener('fetch', (event) => {
  // IGNORAR esquemas no soportados
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Estrategia: Cache First, luego Network
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      
      return fetch(event.request).then((networkResponse) => {
        // No cachear respuestas no exitosas
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return networkResponse;
      }).catch(() => {
        // Si falla la red y no está en caché
        return new Response('Offline - Sin conexión', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      });
    })
  );
});