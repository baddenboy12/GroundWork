/**
 * Hook for eagerly caching photo URLs in the service worker cache.
 * Improves offline availability of previously-viewed images.
 */

import { useEffect } from "react";

/**
 * Initiates eager caching of photo URLs using the Service Worker Cache API.
 * Runs in the background with no blocking behavior.
 *
 * @param photoUrls - Array of URLs to cache
 *
 * @remarks
 * - Silent failure: Failed cache operations don't affect the component
 * - No-op if `caches` API unavailable (older browsers)
 * - Skips already-cached URLs (checks cache before fetching)
 * - Safe for frequent updates (e.g., log list changes)
 *
 * @example
 * const photoUrls = logs.flatMap(log => log.photoUrls || []);
 * useCachePhotos(photoUrls);
 */
export function useCachePhotos(photoUrls: string[]): void {
  useEffect(() => {
    // Bail if caches API unavailable or no URLs to cache
    if (!("caches" in window) || photoUrls.length === 0) {
      return;
    }

    const cachePhotosInBackground = async () => {
      for (const url of photoUrls) {
        try {
          // Skip if already cached
          const hit = await caches.match(url);
          if (hit) continue;

          // Fetch without mode restriction so SW can intercept and cache it.
          // The SW will cache based on its own cache strategy.
          await fetch(url);
        } catch {
          // Silent fail: individual photo cache failures don't break the component
          // In dev mode, log for debugging
          if (import.meta.env.DEV) {
            console.debug(`[useCachePhotos] Failed to cache: ${url}`);
          }
        }
      }
    };

    // Fire-and-forget: don't block component rendering
    void cachePhotosInBackground();
  }, [photoUrls]);
}
