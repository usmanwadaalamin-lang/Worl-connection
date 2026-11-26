const CACHE_NAME = 'world-connection-shell-v1';

const STATIC_SHELL_ASSETS = [
  '/manifest.json',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/favicon-32x32.png',
];

const CACHEABLE_STATIC_PATHS = new Set(STATIC_SHELL_ASSETS);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_SHELL_ASSETS))
      .catch(() => {
        // Ignore precache issues in restricted/dev contexts
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept non-GET requests (POST/PUT/DELETE/etc.)
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Only handle HTTP/HTTPS
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // CRITICAL: Never intercept or cache cross-origin calls
  // (Google OAuth, Firebase Auth/IdentityToolkit/SecureToken, Cloud Firestore, TinyURL, etc.)
  if (url.origin !== self.location.origin) return;

  // CRITICAL: Never intercept or cache Firebase reserved auth/config endpoints or backend /api/* routes
  if (
    url.pathname.startsWith('/__/auth/') ||
    url.pathname.startsWith('/__/firebase/') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Static app icons and manifest: stale-while-revalidate
  if (CACHEABLE_STATIC_PATHS.has(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((res) => {
            if (res && res.status === 200 && res.type === 'basic') {
              const copy = res.clone();
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, copy))
                .catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      }),
    );
    return;
  }

  // Hashed Vite production assets (/assets/...): network-first with cache fallback
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, copy))
              .catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Navigation requests: always network-first, minimal offline fallback when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>World Connection</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;padding:24px;text-align:center}main{max-width:360px}h1{font-size:20px;margin:0 0 8px}p{font-size:14px;color:#cbd5e1;line-height:1.5;margin:0 0 20px}button{background:#059669;color:#fff;border:0;border-radius:12px;padding:12px 20px;font-size:14px;font-weight:600;cursor:pointer}</style></head><body><main><h1>World Connection</h1><p>Babu haɗin yanar gizo a yanzu. Duba data/Wi-Fi ɗinka sannan ka sake gwadawa.<br><br>You appear to be offline. Check your connection and try again.</p><button onclick="location.reload()">Sake Gwadawa / Retry</button></main></body></html>`,
            {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            },
          ),
      ),
    );
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { body: event.data.text() };
  }
  const title = payload.title || 'World Connection';
  const body = payload.body || 'New message on World Connection';
  const chatTarget =
    payload.data && typeof payload.data.chatTarget === 'string'
      ? payload.data.chatTarget
      : '';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [160, 80, 160],
      tag: payload.tag || 'world-connection-msg',
      renotify: true,
      data: { chatTarget },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const chatTarget =
    typeof data.chatTarget === 'string' ? data.chatTarget : '';
  const targetUrl = chatTarget
    ? `/?openChat=${encodeURIComponent(chatTarget)}`
    : '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            if (chatTarget) {
              client.postMessage({ type: 'OPEN_CHAT_TARGET', chatTarget });
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      }),
  );
});
