const CACHE_NAME = "groundwork-v4";

const BYPASS_HOSTNAMES = [
  "convex.cloud",
  "convex.site",
  "r2.cloudflarestorage.com",
  "r2.dev",
  "cdn.hercules.app",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "paypal.com",
  "sandbox.paypal.com",
  "paypalobjects.com",
];

// ── Precache everything needed to boot the app shell ─────────────────────────

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);

  // Static assets that never change
  await Promise.allSettled([
    cache.add("/icon/icon-192.png"),
    cache.add("/icon/icon-512.png"),
    cache.add("/site.webmanifest"),
  ]);

  // Fetch the root HTML (force-reload so we always get fresh hashes)
  let rootRes;
  try {
    rootRes = await fetch("/", { cache: "reload" });
  } catch {
    // Offline during SW install — skip, will retry on next online visit
    return;
  }
  if (!rootRes.ok) return;

  const html = await rootRes.clone().text();
  await cache.put("/", rootRes);

  // ── Extract ALL /assets/ URLs from the HTML ──────────────────────────────
  // Covers: <script src="/assets/...">, <link href="/assets/..."  (stylesheet
  // AND modulepreload), and any other tag that references /assets/ paths.
  const assetUrls = new Set();
  const patterns = [
    // <script ... src="/assets/...">
    /<script[^>]+src="(\/assets\/[^"?#]+)"/g,
    // <link ... href="/assets/...">  (stylesheet + modulepreload chunks)
    /<link[^>]+href="(\/assets\/[^"?#]+)"/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) assetUrls.add(m[1]);
  }

  // Cache every asset — best-effort, never block activation
  await Promise.allSettled(
    [...assetUrls].map((url) =>
      fetch(url, { cache: "reload" })
        .then((res) => {
          if (res.ok) cache.put(url, res);
        })
        .catch(() => {})
    )
  );
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch strategy ────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Always bypass external APIs / storage
  if (BYPASS_HOSTNAMES.some((h) => url.hostname.includes(h))) return;

  // ── Vite content-hashed bundles: cache-first (immutable URLs) ──────────
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((res) => {
            if (res.ok) {
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(event.request, res.clone()));
            }
            return res;
          })
          .catch(() => Response.error());
      })
    );
    return;
  }

  // ── Navigation requests: cache-first with background refresh ───────────
  // Return the cached shell IMMEDIATELY so the app loads offline, while
  // refreshing the cache in the background for the next open.
  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.match("/").then((cached) => {
        // Fire background network refresh (don't await)
        fetch(event.request)
          .then((res) => {
            if (res.ok) {
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put("/", res.clone()));
            }
          })
          .catch(() => {});

        if (cached) return cached;

        // Nothing in cache yet — wait for network
        return fetch(event.request).catch(() => Response.error());
      })
    );
    return;
  }

  // ── Everything else (icons, manifests, etc): cache-first ───────────────
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          if (res.ok) {
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, res.clone()));
          }
          return res;
        })
        .catch(() => Response.error());
    })
  );
});
