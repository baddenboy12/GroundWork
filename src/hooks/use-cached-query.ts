import { useEffect, useRef, useState } from "react";

/**
 * Wraps a Convex query result with localStorage-backed caching.
 *
 * - When fresh data arrives from Convex it is persisted to localStorage.
 * - When Convex returns `undefined` (offline / loading) the last cached value
 *   is returned instead, so the UI stays populated after app close/reopen.
 * - The cache key must be unique per query + arguments combination.
 */
export function useCachedQuery<T>(cacheKey: string, data: T | undefined): T | undefined {
  // Initialise from localStorage so data is available immediately on mount
  const [cached, setCached] = useState<T | undefined>(() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  });

  // Track the previous cache key so we can reset when it changes
  const prevKeyRef = useRef(cacheKey);

  useEffect(() => {
    if (prevKeyRef.current !== cacheKey) {
      // Key changed (e.g. different siteId) — load from new slot
      prevKeyRef.current = cacheKey;
      try {
        const raw = localStorage.getItem(cacheKey);
        setCached(raw ? (JSON.parse(raw) as T) : undefined);
      } catch {
        setCached(undefined);
      }
    }
  }, [cacheKey]);

  useEffect(() => {
    if (data === undefined) return;
    setCached(data);
    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {
      // Storage quota exceeded — silently skip
    }
  }, [cacheKey, data]);

  // Return live data when available, fall back to cache
  return data ?? cached;
}
