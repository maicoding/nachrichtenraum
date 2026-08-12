const cacheName = "nachrichtenraum-v2-3";
const buildAssets = self.__V2_BUILD_ASSETS__ || [];
const shell = ["./", "./manifest.webmanifest", "./icon.svg", "../vendor/aframe-v1.8.0.min.js", "../feeds.json", ...buildAssets];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => Promise.allSettled(shell.map((url) => cache.add(url)))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("nachrichtenraum-v2-") && key !== cacheName).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS") return;
  const urls = [...new Set(event.data.urls || [])].filter((value) => {
    try {
      return new URL(value, self.location.href).origin === self.location.origin;
    } catch {
      return false;
    }
  });
  event.waitUntil(
    caches.open(cacheName).then((cache) => Promise.allSettled(urls.map((url) => cache.add(url)))),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(cacheName).then((cache) => cache.put("./", copy));
          return response;
        })
        .catch(() => caches.match("./")),
    );
    return;
  }
  if (url.pathname.endsWith("feeds.json")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(cacheName).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(cacheName).then((cache) => cache.put(event.request, copy));
      return response;
    })),
  );
});
