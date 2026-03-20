// ── Configuration ─────────────────────────────────────────────────────────────

const CACHE = "groundwork-sw";

// Hosts whose responses should never be intercepted or cached.
const BYPASS = [
  "convex.cloud",
  "convex.site",
  // r2.cloudflarestorage.com = internal presigned upload API — skip caching
  "r2.cloudflarestorage.com",
  // r2.dev is intentionally NOT bypassed so that R2 photo URLs are cached
  // offline via the fetch handler below. Public R2 bucket CORS is required.
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "paypal.com",
  "sandbox.paypal.com",
  "paypalobjects.com",
];

// Minimum ms between background asset refreshes (avoids hammering the CDN on
// rapid navigations but still keeps the cache fresh on longer sessions).
const REFRESH_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

// Key used to store the photo URL manifest inside Cache Storage.
// Written by the app (use-background-cache-sync.ts) whenever it syncs.
// Read by the periodicSync handler to re-cache photos in the background.
const PHOTO_MANIFEST_KEY = "/__gw-photo-manifest";

// ── Offline fallback page ─────────────────────────────────────────────────────
// Shown when the app shell is not yet cached (e.g. first ever launch offline).
const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>GroundWork – Offline</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#0f1117;color:#fff;display:flex;align-items:center;
         justify-content:center;min-height:100svh;padding:24px;text-align:center}
    .icon{font-size:48px;margin-bottom:16px}
    h1{font-size:22px;font-weight:700;color:#f97316;margin-bottom:8px}
    p{color:#9ca3af;line-height:1.5;max-width:320px}
    small{display:block;margin-top:12px;color:#6b7280;font-size:12px}
    button{margin-top:20px;padding:10px 24px;background:#f97316;border:none;
           border-radius:8px;color:#fff;font-size:15px;font-weight:600;cursor:pointer}
  </style>
</head>
<body>
  <div>
    <div class="icon">📵</div>
    <h1>You're offline</h1>
    <p>Open GroundWork while connected to the internet at least once to enable full offline support.</p>
    <small>All your data will be available offline after that first visit.</small>
    <button onclick="location.reload()">Try again</button>
  </div>
</body>
</html>`;

// ── Asset caching ─────────────────────────────────────────────────────────────

// Tracks when we last ran a full asset refresh so we don't hammer the CDN.
let lastRefreshAt = 0;

/**
 * Fetches the current app shell HTML, extracts every /assets/ URL referenced
 * in it, and caches all of them (plus icons and the manifest).
 *
 * Safe to call at any time — it simply returns early if offline or if it was
 * called recently.
 *
 * @param {boolean} force – ignore the cooldown and always refresh
 */
async function refreshCache(force = false) {
  const now = Date.now();
  if (!force && now - lastRefreshAt < REFRESH_COOLDOWN_MS) return;
  lastRefreshAt = now;

  try {
    // Fetch the latest shell HTML, bypassing the HTTP cache so we always get
    // the most recently deployed version.
    const htmlRes = await fetch("/", { cache: "reload" });
    if (!htmlRes.ok) return;

    const cache = await caches.open(CACHE);

    // Store the HTML itself so it can be served during offline navigations.
    const htmlText = await htmlRes.clone().text();
    await cache.put("/", htmlRes);

    // Extract every /assets/... path referenced in src="..." or href="..."
    // attributes.  This captures Vite's hashed JS/CSS chunks and module
    // preloads, which are the only assets we need to serve the app offline.
    const assetUrls = new Set();
    for (const m of htmlText.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
      assetUrls.add(m[1]);
    }

    // Cache static app-shell resources and all discovered asset chunks.
    await Promise.allSettled([
      cache.add("/icon/icon-192.png"),
      cache.add("/icon/icon-512.png"),
      cache.add("/site.webmanifest"),
      ...[...assetUrls].map((url) =>
        // Only re-fetch assets that aren't already cached (content-hashed URLs
        // are immutable, so we never need to revalidate them).
        caches.match(url).then((hit) => {
          if (hit) return;
          return fetch(url, { cache: "reload" })
            .then((r) => { if (r.ok) cache.put(url, r); })
            .catch(() => {});
        })
      ),
    ]);
  } catch {
    // Network unavailable — silently skip, will retry on next navigation.
  }
}

// ── Photo manifest caching ────────────────────────────────────────────────────
// The app writes all known photo URLs to PHOTO_MANIFEST_KEY in Cache Storage
// whenever it syncs with Convex. This function reads that manifest and fetches
// any URLs not already cached — used by the periodicSync handler so photos are
// kept fresh even when the app is fully closed (Android/Chrome PWA).

async function cachePhotosFromManifest() {
  try {
    const cache = await caches.open(CACHE);
    const manifestRes = await cache.match(PHOTO_MANIFEST_KEY);
    if (!manifestRes) return;

    const urls = await manifestRes.json();
    if (!Array.isArray(urls) || urls.length === 0) return;

    for (const url of urls) {
      try {
        // Skip photos that are already cached — no wasted bandwidth
        const hit = await cache.match(url);
        if (hit) continue;

        const res = await fetch(url);
        if (res.ok) await cache.put(url, res.clone());

        // Small throttle to avoid hammering the CDN
        await new Promise((r) => setTimeout(r, 250));
      } catch {
        // Network error or individual photo unavailable — skip and continue
      }
    }
  } catch {
    // Cache API unavailable — silently skip
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  // Force-refresh on install so we always get a clean cache for this SW
  // version, then skip waiting so this SW takes over immediately.
  event.waitUntil(refreshCache(true).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  // Claim all open clients so this SW controls them without a reload, then
  // prime the cache in case this is a fresh activation after a browser restart.
  event.waitUntil(
    self.clients.claim().then(() => refreshCache(true))
  );
});

// ── Periodic Background Sync ──────────────────────────────────────────────────
// Fires periodically on Android/Chrome when the PWA is installed.
// Refreshes both the app shell and all known photo URLs in the background
// even when the app is completely closed.

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "photo-cache-refresh") {
    event.waitUntil(
      Promise.all([refreshCache(true), cachePhotosFromManifest()])
    );
  }
});

// ── Fetch strategy ────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip caching for external APIs and the OIDC auth server.
  if (BYPASS.some((h) => url.hostname.includes(h))) return;

  // Never intercept the internal photo manifest key — it is only accessed
  // programmatically via caches.match/put, never via a real fetch().
  if (url.pathname === PHOTO_MANIFEST_KEY) return;

  // ── Vite content-hashed bundles: cache-first (immutable filenames) ──────
  // If a chunk is in cache serve it instantly; otherwise fetch, cache, return.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(event.request).then((hit) => {
        if (hit) return hit;
        return fetch(event.request)
          .then((r) => {
            if (r.ok) caches.open(CACHE).then((c) => c.put(event.request, r.clone()));
            return r;
          })
          .catch(() => Response.error());
      })
    );
    return;
  }

  // ── Navigation requests (HTML shell) ────────────────────────────────────
  // Serve the cached shell immediately so offline loads are instant.
  // At the same time, keep the cache fresh in the background whenever we're
  // online so that the next offline session has up-to-date assets.
  if (event.request.mode === "navigate") {
    // Background refresh — keeps SW alive long enough to finish.
    event.waitUntil(refreshCache());

    event.respondWith(
      caches.match("/").then((hit) => {
        if (hit) return hit;
        // Shell not cached yet — try the network and cache the response.
        return fetch(event.request)
          .then((r) => {
            if (r.ok) {
              caches.open(CACHE).then((c) => c.put("/", r.clone()));
            }
            return r;
          })
          .catch(() =>
            // Still no shell and no network → show a friendly offline page.
            new Response(OFFLINE_HTML, {
              status: 200,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            })
          );
      })
    );
    return;
  }

  // ── Everything else (icons, manifest, R2 photos, etc.): cache-first ─────
  event.respondWith(
    caches.match(event.request).then((hit) => {
      if (hit) return hit;
      return fetch(event.request)
        .then((r) => {
          if (r.ok) caches.open(CACHE).then((c) => c.put(event.request, r.clone()));
          return r;
        })
        .catch(() => Response.error());
    })
  );
});
