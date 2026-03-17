import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api.js";
import { useOnlineStatus } from "./use-online-status.ts";

// How many photos to fetch per batch during pre-warming
const PHOTO_BATCH_SIZE = 4;
// Delay between batches (ms) — gentle on battery and bandwidth
const PHOTO_BATCH_DELAY_MS = 1000;
// How long to wait after data arrives before starting photo pre-warm
// (lets the app UI settle first)
const PHOTO_PREWARM_INITIAL_DELAY_MS = 4000;

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
 * Proactively caches every site's logs and photos while the user is online.
 *
 * - Subscribes to `logs.listAllForOfflineCache` which returns all logs for all
 *   sites in a single reactive Convex query.  Whenever a log is added/updated
 *   the query pushes a fresh snapshot and the caches are updated automatically.
 * - Writes each site's logs to `localStorage` under `gw_cache_logs_{siteId}` —
 *   the exact same key that `LogList` reads when offline, so previously-unvisited
 *   sites load instantly offline.
 * - Batches photo pre-fetches in the background so the SW caches all images
 *   without hammering the network or blocking the UI thread.
 *
 * Must be called inside an `<Authenticated>` subtree.
 */
export function useBackgroundCacheSync() {
  const isOnline = useOnlineStatus();
  // Tracks whether a photo pre-warm pass is already in progress so we don't
  // launch duplicate passes when the query refreshes rapidly.
  const prewarmingRef = useRef(false);
  // Store the latest photo URLs so the delayed prewarm uses fresh data
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

    // ── Schedule photo pre-warming ────────────────────────────────────────────
    pendingPhotosRef.current = freshPhotoUrls;

    if (prewarmingRef.current) return; // A pass is already running — it will
    // pick up the latest pendingPhotosRef on its next tick anyway

    // Delay the first batch so the app UI has time to fully paint
    const timer = setTimeout(() => {
      void (async () => {
        prewarmingRef.current = true;
        const urls = pendingPhotosRef.current;
        let i = 0;

        while (i < urls.length) {
          // Stop pre-warming if we've gone offline mid-session
          if (!navigator.onLine) break;

          const batch = urls.slice(i, i + PHOTO_BATCH_SIZE);
          await Promise.allSettled(batch.map((url) => prewarmPhoto(url)));
          i += PHOTO_BATCH_SIZE;

          if (i < urls.length) {
            await new Promise<void>((resolve) => setTimeout(resolve, PHOTO_BATCH_DELAY_MS));
          }
        }

        prewarmingRef.current = false;
      })();
    }, PHOTO_PREWARM_INITIAL_DELAY_MS);

    return () => clearTimeout(timer);
  }, [allData]);
}
