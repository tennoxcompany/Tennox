const CACHE_NAME = 'tennox-cache-v4';
const STATIC_ASSETS = [
  './favicon.png',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  
  // HTML ve API isteklerinde her zaman Ağ Öncelikli (Network First) çalış
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/' || url.hostname.includes('supabase') || url.hostname.includes('vidsrc') || url.hostname.includes('sibnet') || url.hostname.includes('vidmoly')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Statik varlıklar için
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

