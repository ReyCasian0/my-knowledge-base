const cacheName = "knowledge-base-offline-v1";
const scope = self.registration.scope;
const offlinePage = new URL("offline.html", scope).href;
const offlineScript = new URL("offline-library.js", scope).href;
const home = new URL(scope).pathname;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([new Request(offlinePage, { cache: "reload" }), new Request(offlineScript, { cache: "reload" })]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("knowledge-base-offline-") && key !== cacheName)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.url === offlineScript) {
    event.respondWith(fetch(request).catch(() => caches.match(offlineScript, { cacheName })));
  } else if (request.mode === "navigate" && [home, home + "index.html", new URL(offlinePage).pathname].includes(url.pathname)) {
    event.respondWith(fetch(request).catch(() => caches.match(offlinePage, { cacheName })));
  }
});
