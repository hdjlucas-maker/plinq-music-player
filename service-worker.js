const CACHE_NAME = 'plinq-pwa-shell-v2';
const SHELL_FILES = [
  './',
  './index.html',
  './privacy.html',
  './manifest.webmanifest',
  './style.css',
  './script.js',
  './persistence.js',
  './discover.js',
  './pwa.js',
  './apple-touch-icon.png',
  './pwa-icon-192.png',
  './pwa-icon-512.png',
  './pwa-icon.svg',
  './favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(SHELL_FILES.map(async (file) => {
      const request = new Request(new URL(file, self.registration.scope), { cache: 'reload' });
      const response = await fetch(request);
      if (!response.ok) throw new Error(`Não foi possível preparar ${file} para uso offline.`);
      await cache.put(request, response);
    }));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => name.startsWith('plinq-pwa-shell-') && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET'
    || url.origin !== self.location.origin
    || url.pathname.includes('/api/')
  ) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        try {
          await cache.put(request, response.clone());
        } catch (error) {
          console.warn('PWA: não foi possível atualizar o cache offline.', error);
        }
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const appShell = await caches.match(new URL('./index.html', self.registration.scope));
        if (appShell) return appShell;
      }
      throw error;
    }
  })());
});
