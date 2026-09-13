/* IVAMAXO — Service Worker
 *
 * Sube VERSION en cada despliegue que cambie HTML, CSS o JS.
 * Al cambiar, se borran las cachés viejas y el navegador se queda con lo nuevo.
 *
 * Estrategias, a propósito distintas por tipo de recurso:
 *   navegación (HTML) → red primero. Nunca cache primero: una tienda que
 *                       muestra precios viejos es peor que una lenta.
 *   estáticos propios → caché primero (iconos, video del hero, favicon).
 *   Google Fonts      → caché con revalidación en segundo plano.
 *   Supabase y wa.me  → nunca se cachean. Son datos vivos.
 */

const VERSION    = 'v6';
const CACHE_APP  = `ivamaxo-app-${VERSION}`;
const CACHE_EST  = `ivamaxo-est-${VERSION}`;

// Mínimo para que la app abra sin conexión
const PRECACHE = [
  './',
  './index.html',
  './tienda.html',
  './offline.html',
  './favicon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_APP)
      // addAll falla entero si un recurso falla: se añaden de a uno
      .then(c => Promise.allSettled(PRECACHE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(
        ks.filter(k => k.startsWith('ivamaxo-') && !k.endsWith(VERSION))
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Permite forzar la actualización desde la página
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

const NUNCA_CACHEAR = [
  'supabase.co',      // productos, precios, sesión: siempre en vivo
  'wa.me',
  'zenserp.com',
  'google-analytics.com'
];

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (NUNCA_CACHEAR.some(d => url.hostname.includes(d))) return;

  // ── HTML: red primero, caché como red de seguridad ──
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copia = res.clone();
          caches.open(CACHE_APP).then(c => c.put(req, copia));
          return res;
        })
        .catch(() =>
          caches.match(req).then(hit => hit || caches.match('./offline.html'))
        )
    );
    return;
  }

  // ── Fuentes de Google: caché y refresco en segundo plano ──
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(req).then(hit => {
        const red = fetch(req).then(res => {
          const copia = res.clone();
          caches.open(CACHE_EST).then(c => c.put(req, copia));
          return res;
        }).catch(() => hit);
        return hit || red;
      })
    );
    return;
  }

  // ── Estáticos propios: caché primero ──
  if (url.origin === self.location.origin &&
      /\.(png|jpg|jpeg|webp|svg|ico|webm|mp4|css|woff2?)$/i.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(hit =>
        hit || fetch(req).then(res => {
          const copia = res.clone();
          caches.open(CACHE_EST).then(c => c.put(req, copia));
          return res;
        })
      )
    );
    return;
  }
});
