import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api.js";
import { useOnlineStatus } from "./use-online-status.ts";

// Throttle: only re-run the cache write at most once per interval (ms)
const CACHE_WRITE_THROTTLE_MS = 30_000; // 30 s
// Photo pre-warm settings — intentionally very gentle to avoid UI lag
const PHOTO_BATCH_SIZE = 2;
const PHOTO_BATCH_DELAY_MS = 3_000;  // 3 s between batches
const PHOTO_PREWARM_INITIAL_DELAY_MS = 15_000; // wait 15 s after data arrives

async function prewarmPhoto(url: string): Promise<void> {
  try {
    if ("caches" in window) {
      const hit = await caches.match(url);
      if (hit) return;
    }
    await fetch(url);
  } catch {
    // Best-effort — silently ignore network errors
  }
}

/**
 * Proactively caches every site's logs and photos while the user is online.
 *
 * Throttled to avoid constant localStorage writes and photo fetches, which
 * were causing UI sluggishness on low-end mobile devices.
 */
export function useBackgroundCacheSync() {
  const isOnline = useOnlineStatus();
  const prewarmingRef = useRef(false);
  const pendingPhotosRef = useRef<string[]>([]);
  // Timestamp of the last time we wrote logs to localStorage
  const lastCacheWriteRef = useRef<number>(0);

  const allData = useQuery(
    api.logs.listAllForOfflineCache,
    isOnline ? {} : "skip"
  );

  useEffect(() => {
    if (!allData) return;

    const now = Date.now();
    const timeSinceLast = now - lastCacheWriteRef.current;

    // Throttle: skip if we wrote recently — reactive updates fire on every
    // log change which would otherwise trigger a full localStorage write loop.
    if (timeSinceLast < CACHE_WRITE_THROTTLE_MS) return;
    lastCacheWriteRef.current = now;

    // ── Persist logs to localStorage ────────────────────────────────────────
    const freshPhotoUrls: string[] = [];

    for (const [siteId, logs] of Object.entries(allData)) {
      try {
        localStorage.setItem(`gw_cache_logs_${siteId}`, JSON.stringify(logs));
      } catch {
        // Storage quota exceeded — skip silently
      }

      for (const log of logs as Array<{ photoUrls?: string[] }>) {
        if (log.photoUrls) {
          for (const url of log.photoUrls) {
            if (url) freshPhotoUrls.push(url);
          }
        }
      }
    }

    // ── Schedule photo pre-warming (best-effort, low priority) ──────────────
    pendingPhotosRef.current = freshPhotoUrls;

    if (prewarmingRef.current) return;

    const timer = setTimeout(() => {
      void (async () => {
        prewarmingRef.current = true;
        const urls = pendingPhotosRef.current;
        let i = 0;

        while (i < urls.length) {
          if (!navigator.onLine) break;

          // Yield to the main thread between every batch so the UI stays responsive
          await new Promise<void>((resolve) =>
            // Use requestIdleCallback when available for lowest-priority execution
            "requestIdleCallback" in window
              ? (window as Window & { requestIdleCallback: (cb: () => void) => void })
                  .requestIdleCallback(resolve)
              : setTimeout(resolve, 0)
          );

          const batch = urls.slice(i, i + PHOTO_BATCH_SIZE);
          await Promise.allSettled(batch.map((url) => prewarmPhoto(url)));
          i += PHOTO_BATCH_SIZE;

          if (i < urls.length) {
            await new Promise<void>((resolve) =>
              setTimeout(resolve, PHOTO_BATCH_DELAY_MS)
            );
          }
        }

        prewarmingRef.current = false;
      })();
    }, PHOTO_PREWARM_INITIAL_DELAY_MS);

    return () => clearTimeout(timer);
  }, [allData]);
}
