const CACHE_NAME = "groundwork-v3";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch the root HTML, cache it, and cache every local JS/CSS asset it links to. */
async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);

  // Always cache icons
  await Promise.allSettled([
    cache.add("/icon/icon-192.png"),
    cache.add("/icon/icon-512.png"),
  ]);

  // Fetch the root HTML
  let rootRes;
  try {
    rootRes = await fetch("/", { cache: "reload" });
  } catch {
    return; // offline during first install — skip, will retry next visit
  }
  if (!rootRes.ok) return;

  const html = await rootRes.clone().text();
  await cache.put("/", rootRes);

  // Extract all local asset URLs from <script src="..."> and <link href="...css">
  const assetUrls = new Set();
  const patterns = [
    /<script[^>]+src="(\/[^"?#]+)"/g,
    /<link[^>]+href="(\/[^"?#]+\.css[^"]*)"/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) assetUrls.add(m[1]);
  }

  // Cache each asset — best-effort (don't block activation on failure)
  await Promise.allSettled(
    [...assetUrls].map((url) =>
      fetch(url, { cache: "reload" })
        .then((res) => { if (res.ok) cache.put(url, res); })
        .catch(() => {})
    )
  );
}

// ── Lifecycle events ──────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch strategy ────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Bypass: Convex, R2 storage, external CDNs — always go to network
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

  // Vite content-hashed bundles (/assets/...) → cache-first (immutable URLs)
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Navigation requests → network-first, fall back to cached root shell
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // Cache fresh navigation responses
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match("/").then((cached) => cached ?? Response.error()))
    );
    return;
  }

  // Everything else → network-first, cache on success, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? Response.error()))
  );
});
