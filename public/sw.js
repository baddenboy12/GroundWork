const CACHE_NAME = "logvault-v1";
const STATIC_ASSETS = ["/", "/icon/icon-192.png", "/icon/icon-512.png"];

// Install — pre-cache core shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — purge old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.map((name) => {
            if (name !== CACHE_NAME) return caches.delete(name);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch — network-first; fall back to cache for navigation
self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  // Skip Convex WebSocket / API, R2 storage (both upload API and public CDN), and external CDNs
  const url = new URL(event.request.url);
  if (
    url.hostname.includes("convex.cloud") ||
    url.hostname.includes("convex.site") ||
    url.hostname.includes("r2.cloudflarestorage.com") ||
    url.hostname.includes("r2.dev") ||
    url.hostname.includes("cdn.hercules.app") ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com")
  ) {
    return;
  }

  // Navigation requests: try network, fall back to cached root
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/"))
    );
    return;
  }

  // Other GET requests: network-first, cache on success
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response.ok) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
