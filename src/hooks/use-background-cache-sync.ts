import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api.js";
import { useOnlineStatus } from "./use-online-status.ts";

// Cache Storage key where we write the full photo URL list.
// The SW's periodicSync handler reads this to refresh photos in the background.
const PHOTO_MANIFEST_KEY = "/__gw-photo-manifest";
const SW_CACHE_NAME = "groundwork-sw";

// How many photos to fetch per batch during pre-warming.
// Tuned per connection quality — see getNetworkProfile() below.
const DEFAULT_BATCH_SIZE = 6;
const FAST_BATCH_SIZE = 12;

// Delay between batches (ms).
const DEFAULT_BATCH_DELAY_MS = 800;
const FAST_BATCH_DELAY_MS = 200;

// How long to wait after data arrives before starting photo pre-warm
// (lets the app UI settle first).
const PHOTO_PREWARM_INITIAL_DELAY_MS = 1000;

/** Inferred network quality from the Network Information API. */
type NetworkProfile = "fast" | "medium" | "slow" | "save-data";

function getNetworkProfile(): NetworkProfile {
  type NavWithConnection = Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
  };
  const conn = (navigator as NavWithConnection).connection;
  if (conn?.saveData) return "save-data";
  const type = conn?.effectiveType ?? "4g";
  if (type === "4g") return "fast";
  if (type === "3g") return "medium";
  return "slow"; // 2g / slow-2g
}

/**
 * Fetch a single photo URL into the service worker cache.
 *
 * Uses the default fetch mode so the SW intercepts the GET request and
 * stores the response in its cache-first store — making it available even
 * when the device has no network.
 *
 * Skips the fetch if the URL is already cached to avoid redundant traffic.
 */
async function prewarmPhoto(url: string): Promise<void> {
  try {
    // Check SW / Cache Storage first — avoid re-downloading already-cached photos
    if ("caches" in window) {
      const hit = await caches.match(url);
      if (hit) return;
    }
    // A plain GET goes through the SW which caches the response automatically
    await fetch(url);
  } catch {
    // Best-effort — silently ignore network errors
  }
}

/**
 * Writes the full list of photo URLs to Cache Storage so the service worker's
 * periodicSync handler can re-cache them in the background even when the app
 * is fully closed (requires Android + Chrome + installed PWA).
 */
async function writePhotoManifest(urls: string[]): Promise<void> {
  try {
    if (!("caches" in window) || urls.length === 0) return;
    const cache = await caches.open(SW_CACHE_NAME);
    await cache.put(
      PHOTO_MANIFEST_KEY,
      new Response(JSON.stringify(urls), {
        headers: { "Content-Type": "application/json" },
      })
    );
  } catch {
    // Cache API unavailable or quota exceeded — silently skip
  }
}

/**
 * Proactively caches every site's logs and photos while the user is online.
 *
 * - Subscribes to `logs.listAllForOfflineCache` which returns all logs for all
 *   sites in a single reactive Convex query.  Whenever a log is added/updated
 *   the query pushes a fresh snapshot and the caches are updated automatically.
 * - Writes each site's logs to `localStorage` under `gw_cache_logs_{siteId}` —
 *   the exact same key that `LogList` reads when offline, so previously-unvisited
 *   sites load instantly offline.
 * - Writes all photo URLs to Cache Storage as a manifest so the SW's
 *   periodicSync handler can refresh them in the background when the app is closed.
 * - Batches photo pre-fetches in the background so the SW caches all images
 *   without hammering the network or blocking the UI thread.
 * - Adapts batch size and delay to detected network quality (faster on 4G/WiFi,
 *   gentler on 3G, skips entirely on 2G or data-saver mode).
 *
 * Must be called inside an `<Authenticated>` subtree.
 */
export function useBackgroundCacheSync() {
  const isOnline = useOnlineStatus();
  // Tracks whether a photo pre-warm pass is already in progress so we don't
  // launch duplicate passes when the query refreshes rapidly.
  const prewarmingRef = useRef(false);
  // Store the latest photo URLs so the delayed prewarm uses fresh data.
  const pendingPhotosRef = useRef<string[]>([]);

  // Skip the subscription while offline — no point subscribing when Convex
  // can't connect, and this avoids a retry loop.
  const allData = useQuery(
    api.logs.listAllForOfflineCache,
    isOnline ? {} : "skip"
  );

  useEffect(() => {
    if (!allData) return;

    // ── Persist logs to localStorage ──────────────────────────────────────────
    const freshPhotoUrls: string[] = [];

    for (const [siteId, logs] of Object.entries(allData)) {
      try {
        localStorage.setItem(`gw_cache_logs_${siteId}`, JSON.stringify(logs));
      } catch {
        // Storage quota exceeded — skip silently
      }

      // Collect all photo URLs for pre-warming
      for (const log of logs as Array<{ photoUrls?: string[] }>) {
        if (log.photoUrls) {
          for (const url of log.photoUrls) {
            if (url) freshPhotoUrls.push(url);
          }
        }
      }
    }

    // ── Write photo manifest for background SW sync ───────────────────────────
    // Done immediately (before the delayed pre-warm) so the SW's periodicSync
    // handler has up-to-date URLs as soon as possible.
    void writePhotoManifest(freshPhotoUrls);

    // ── Schedule photo pre-warming ────────────────────────────────────────────
    pendingPhotosRef.current = freshPhotoUrls;

    if (prewarmingRef.current) return; // A pass is already running — it will
    // pick up the latest pendingPhotosRef on its next tick anyway

    // Delay the first batch so the app UI has time to fully paint
    const timer = setTimeout(() => {
      void (async () => {
        // Check network quality at the point pre-warming actually starts —
        // the user may have been on cellular earlier but switched to WiFi.
        const profile = getNetworkProfile();

        // Skip pre-warming entirely on slow connections or data-saver mode to
        // avoid consuming the user's limited data budget.
        if (profile === "slow" || profile === "save-data") return;

        const batchSize = profile === "fast" ? FAST_BATCH_SIZE : DEFAULT_BATCH_SIZE;
        const batchDelay = profile === "fast" ? FAST_BATCH_DELAY_MS : DEFAULT_BATCH_DELAY_MS;

        prewarmingRef.current = true;
        const urls = pendingPhotosRef.current;
        let i = 0;

        while (i < urls.length) {
          // Stop pre-warming if we've gone offline mid-session
          if (!navigator.onLine) break;

          // Re-check if network degraded during a long session
          const currentProfile = getNetworkProfile();
          if (currentProfile === "slow" || currentProfile === "save-data") break;

          const batch = urls.slice(i, i + batchSize);
          await Promise.allSettled(batch.map((url) => prewarmPhoto(url)));
          i += batchSize;

          if (i < urls.length) {
            await new Promise<void>((resolve) => setTimeout(resolve, batchDelay));
          }
        }

        prewarmingRef.current = false;
      })();
    }, PHOTO_PREWARM_INITIAL_DELAY_MS);

    return () => clearTimeout(timer);
  }, [allData]);
}
