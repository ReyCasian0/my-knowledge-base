const cacheName = "knowledge-base-offline-v2";
const scope = self.registration.scope;
const offlinePage = new URL("offline", scope).href;
const offlineScript = new URL("offline-library.js", scope).href;
const home = new URL(scope).pathname;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([offlinePage, offlineScript].map(url => new Request(url, { cache: "reload", redirect: "error" })));
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

async function cachedReader() {
  const cached = await caches.match(offlinePage, { cacheName });
  return cached ? new Response(cached.body, { headers: { "Content-Type": "text/html; charset=utf-8" } }) : Response.error();
}

self.addEventListener("message", event => {
  const port = event.ports[0];
  if (event.data !== "check-offline-reader-v2" || !port) return;
  event.waitUntil((async () => {
    const page = await caches.match(offlinePage, { cacheName });
    const script = await caches.match(offlineScript, { cacheName });
    port.postMessage(Boolean(page && script));
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.url === offlineScript) {
    event.respondWith(caches.match(offlineScript, { cacheName }).then(cached => cached || fetch(request)));
  } else if (request.mode === "navigate") {
    if (url.pathname === home + "offline" || url.pathname === home + "offline.html") {
      event.respondWith(cachedReader());
    } else if (url.pathname === home || url.pathname === home + "index.html") {
      event.respondWith(self.navigator.onLine === false ? cachedReader() : fetch(request).catch(cachedReader));
    }
  }
});
