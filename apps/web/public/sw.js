const TASK20_STATIC_CACHE = "book-media-library-static-v1";
const TASK20_STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/pwa-icon.svg",
  "/favicon.ico",
  "/file.svg",
  "/globe.svg",
  "/window.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(TASK20_STATIC_CACHE)
      .then((cache) => cache.addAll(TASK20_STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== TASK20_STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticRequest(request) {
  const url = new URL(request.url);

  if (url.origin !== self.location.origin || request.method !== "GET") {
    return false;
  }

  return (
    url.pathname.startsWith("/_next/static/")
    || TASK20_STATIC_ASSETS.includes(url.pathname)
    || /\.(?:css|js|mjs|map|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  if (!isStaticRequest(event.request)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(TASK20_STATIC_CACHE).then((cache) => cache.put(event.request, copy));
        }

        return response;
      });
    }),
  );
});
