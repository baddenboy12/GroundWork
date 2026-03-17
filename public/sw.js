// Fixed cache name — never bumped, so old content-hashed assets are never
// deleted when the SW updates. Old Vite chunks co-exist safely with new ones
// because each build uses unique content hashes.
const CACHE = "groundwork-sw";

const BYPASS = [
  "convex.cloud",
  "convex.site",
  // r2.cloudflarestorage.com = internal presigned upload API — skip caching
  "r2.cloudflarestorage.com",
  // r2.dev is intentionally NOT bypassed so that R2 photo URLs are cached
  // offline via the fetch handler below. Public R2 bucket CORS is required.
  "cdn.hercules.app",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "paypal.com",
  "sandbox.paypal.com",
  "paypalobjects.com",
  // NOTE: do NOT add "hercules.app" here — it would also match the app's own
  // subdomain (*.onhercules.app) and bypass caching for all app requests.
  // OIDC requests to hercules.app are cross-origin so the SW never sees them.
];

// ── Precache the app shell ────────────────────────────────────────────────────

async function precache() {
  const cache = await caches.open(CACHE);

  // Static assets that never change
  await Promise.allSettled([
    cache.add("/icon/icon-192.png"),
    cache.add("/icon/icon-512.png"),
    cache.add("/site.webmanifest"),
  ]);

  // Fetch the built HTML shell (force-reload to bypass HTTP cache)
  let html;
  try {
    const res = await fetch("/", { cache: "reload" });
    if (!res.ok) return;
    html = await res.clone().text();
    await cache.put("/", res);
  } catch {
    // Offline during install — skip, assets will be cached as they're fetched
    return;
  }

  // Extract every /assets/ URL from src="..." and href="..." attributes.
  // This covers <script src>, <link rel="stylesheet">, and
  // <link rel="modulepreload"> — all the Vite-generated chunks.
  const assetUrls = new Set();
  for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
    assetUrls.add(m[1]);
  }

  await Promise.allSettled(
    [...assetUrls].map((url) =>
      fetch(url, { cache: "reload" })
        .then((r) => {
          if (r.ok) cache.put(url, r);
        })
        .catch(() => {})
    )
  );
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  // skipWaiting regardless of whether precaching succeeded — the fetch handler
  // will cache any missed assets on-the-fly the next time they're requested.
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  // Do NOT delete old caches. Old content-hashed Vite bundles are still valid
  // and keeping them ensures the app loads offline even when precaching was
  // interrupted. Just claim clients so this SW controls the page immediately.
  event.waitUntil(self.clients.claim());
});

// ── Fetch strategy ────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip caching for external APIs and the OIDC auth server
  if (BYPASS.some((h) => url.hostname.includes(h))) return;

  // ── Vite content-hashed bundles: cache-first (immutable filenames) ──────
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(event.request).then((hit) => {
        if (hit) return hit;
        return fetch(event.request)
          .then((r) => {
            if (r.ok)
              caches.open(CACHE).then((c) => c.put(event.request, r.clone()));
            return r;
          })
          .catch(() => Response.error());
      })
    );
    return;
  }

  // ── Navigation: serve cached shell instantly, refresh in background ─────
  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.match("/").then((hit) => {
        // Always try to refresh the cached shell in the background
        fetch(event.request)
          .then((r) => {
            if (r.ok) caches.open(CACHE).then((c) => c.put("/", r.clone()));
          })
          .catch(() => {});

        // Serve cached shell immediately; if nothing cached yet, wait for network
        return hit ?? fetch(event.request).catch(() => Response.error());
      })
    );
    return;
  }

  // ── Everything else (icons, manifest, etc.): cache-first ────────────────
  event.respondWith(
    caches.match(event.request).then((hit) => {
      if (hit) return hit;
      return fetch(event.request)
        .then((r) => {
          if (r.ok)
            caches.open(CACHE).then((c) => c.put(event.request, r.clone()));
          return r;
        })
        .catch(() => Response.error());
    })
  );
});
