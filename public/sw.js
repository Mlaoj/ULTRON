const C = 'ultron-v2';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(C).then((c) => c.addAll(['/', '/manifest.json', '/icon.svg']))); self.skipWaiting(); });
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).pathname.startsWith('/api')) return;
  e.respondWith(fetch(e.request).then((r) => { const k = r.clone(); caches.open(C).then((c) => c.put(e.request, k)); return r; }).catch(() => caches.match(e.request)));
});
