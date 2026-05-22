// sw.js - Service Worker para Evento 04-Jun | Vente Cabimas
// Versión: 1.2.0 | Última actualización: 2024-06-04

const CACHE_NAME = 'evento-04jun-v1.2.0';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

// Recursos estáticos críticos para funcionamiento offline
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  // Librerías externas (CDN) - se cachearán bajo demanda
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

// Patrones de URLs que NO deben cachearse (APIs, Firebase, etc.)
const EXCLUDED_PATTERNS = [
  /firebaseio\.com/i,
  /firebasestorage\.app/i,
  /googleapis\.com/i,
  /analytics\.google\.com/i,
  /localhost:/i, // En desarrollo
  /127\.0\.0\.1/i
];

// ==========================================
// 1. INSTALACIÓN - Cachear recursos estáticos
// ==========================================
self.addEventListener('install', (event) => {
  console.log('🔧 [SW] Instalando Service Worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 [SW] Cacheando recursos estáticos...');
        return cache.addAll(STATIC_ASSETS)
          .then(() => {
            console.log('✅ [SW] Recursos estáticos cacheados');
            return self.skipWaiting(); // Activar inmediatamente
          })
          .catch((err) => {
            console.warn('⚠️ [SW] Algunos recursos no se cachearon:', err.message);
            // Continuar aunque falle algún recurso no crítico
            return self.skipWaiting();
          });
      })
      .catch((err) => {
        console.error('❌ [SW] Error abriendo cache estático:', err);
      })
  );
});

// ==========================================
// 2. ACTIVACIÓN - Limpiar caches antiguos
// ==========================================
self.addEventListener('activate', (event) => {
  console.log('🔄 [SW] Activando Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Eliminar caches que no sean las actuales
              return cacheName !== STATIC_CACHE && 
                     cacheName !== DYNAMIC_CACHE &&
                     cacheName !== CACHE_NAME;
            })
            .map((cacheName) => {
              console.log('🗑️ [SW] Eliminando cache antiguo:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('✅ [SW] Caches antiguos limpiados');
        return self.clients.claim(); // Tomar control de todas las pestañas
      })
      .catch((err) => {
        console.error('❌ [SW] Error en activación:', err);
      })
  );
});

// ==========================================
// 3. FETCH - Estrategia de caché inteligente
// ==========================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 🔒 IGNORAR esquemas no soportados (evita errores de caché)
  if (!url.protocol.startsWith('http') && !url.protocol.startsWith('https')) {
    // console.log(`[SW] Ignorando esquema no soportado: ${url.protocol}`);
    return;
  }
  
  // 🚫 IGNORAR peticiones que coincidan con patrones excluidos
  if (EXCLUDED_PATTERNS.some(pattern => pattern.test(url.href))) {
    // console.log(`[SW] Ignorando petición excluida: ${url.href}`);
    return;
  }
  
  // 📋 Estrategia según el tipo de recurso
  if (isStaticAsset(url.href)) {
    // === ESTRATEGIA: CACHE FIRST (para assets estáticos) ===
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // console.log(`[SW] ✅ Sirviendo desde caché: ${url.pathname}`);
            return cachedResponse;
          }
          // Si no está en caché, buscar en red y cachear
          return fetchAndCache(request, STATIC_CACHE);
        })
        .catch((err) => {
          console.warn(`[SW] ⚠️ Error con recurso estático: ${url.pathname}`, err.message);
          // Fallback offline para HTML principal
          if (request.mode === 'navigate' && url.pathname.endsWith('/')) {
            return caches.match('./index.html');
          }
          return new Response('Recurso no disponible offline', {
            status: 404,
            statusText: 'Not Found',
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
  } else {
    // === ESTRATEGIA: NETWORK FIRST (para APIs y contenido dinámico) ===
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Cachear respuestas exitosas de APIs si son GET y JSON
          if (request.method === 'GET' && 
              networkResponse.status === 200 && 
              networkResponse.headers.get('content-type')?.includes('application/json')) {
            
            const responseClone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE)
              .then((cache) => cache.put(request, responseClone))
              .catch((err) => console.warn('[SW] No se pudo cachear respuesta dinámica:', err));
          }
          return networkResponse;
        })
        .catch((networkError) => {
          // Si falla la red, intentar servir desde caché dinámico
          console.log(`[SW] 🔁 Red fallida, intentando caché para: ${url.pathname}`);
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                console.log(`[SW] ✅ Sirviendo desde caché dinámico: ${url.pathname}`);
                return cachedResponse;
              }
              // Si no hay caché, mostrar error offline amigable
              return new Response(
                JSON.stringify({ 
                  error: 'offline', 
                  message: 'Sin conexión a internet. Algunas funciones pueden estar limitadas.' 
                }),
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
        })
    );
  }
});

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

/**
 * Verifica si una URL es un recurso estático que debe usar Cache First
 */
function isStaticAsset(url) {
  const staticExtensions = [
    '.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', 
    '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'
  ];
  
  return STATIC_ASSETS.some(asset => url.includes(asset)) ||
         staticExtensions.some(ext => url.toLowerCase().endsWith(ext));
}

/**
 * Obtiene recurso de red y lo cachea para futuras peticiones
 */
async function fetchAndCache(request, cacheName) {
  try {
    const response = await fetch(request);
    
    // Solo cachear respuestas exitosas
    if (response.ok) {
      const cache = await caches.open(cacheName);
      const responseClone = response.clone();
      await cache.put(request, responseClone);
      console.log(`[SW] 💾 Cacheado: ${new URL(request.url).pathname}`);
    }
    
    return response;
  } catch (error) {
    console.warn(`[SW] ❌ Error fetch-and-cache: ${error.message}`);
    throw error;
  }
}

// ==========================================
// 4. MENSAJES - Comunicación con la app
// ==========================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Recibido SKIP_WAITING, activando...');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[SW] Recibido CLEAR_CACHE, limpiando...');
    event.waitUntil(
      caches.delete(event.data.cacheName || DYNAMIC_CACHE)
        .then(() => {
          console.log(`✅ [SW] Cache ${event.data.cacheName || DYNAMIC_CACHE} eliminado`);
          return self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({ type: 'CACHE_CLEARED', success: true });
            });
          });
        })
        .catch(err => {
          console.error('[SW] Error limpiando cache:', err);
          return self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({ type: 'CACHE_CLEARED', success: false, error: err.message });
            });
          });
        })
    );
  }
});

// ==========================================
// 5. PUSH NOTIFICATIONS (Opcional - Futuro)
// ==========================================
// self.addEventListener('push', (event) => {
//   const options = {
//     body: event.data?.text() || 'Nueva actualización disponible',
//     icon: './icons/icon-192x192.png',
//     badge: './icons/badge-72x72.png',
//     vibrate: [100, 50, 100],
//     data: { dateOfArrival: Date.now(), primaryKey: 1 }
//   };
//   
//   event.waitUntil(
//     self.registration.showNotification('🎟️ Evento 04-Jun', options)
//   );
// });

// ==========================================
// 6. SYNC EN BACKGROUND (Opcional - Futuro)
// ==========================================
// self.addEventListener('sync', (event) => {
//   if (event.tag === 'sync-attendees') {
//     console.log('[SW] Sync de asistentes iniciado');
//     event.waitUntil(syncAttendees());
//   }
// });
// 
// async function syncAttendees() {
//   // Lógica para sincronizar datos pendientes cuando haya conexión
//   console.log('[SW] Sincronizando datos...');
// }

// ==========================================
// LOGS DE DIAGNÓSTICO (Desactivar en producción)
// ==========================================
// self.addEventListener('fetch', (event) => {
//   // console.log(`[SW] Fetch: ${event.request.method} ${event.request.url}`);
// });

console.log('✅ Service Worker cargado | Cache: ' + CACHE_NAME);