import { useState, useEffect, useCallback, useRef } from "react";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";

/**
 * Returns whether the app should use the offline/cached path.
 *
 * `navigator.onLine` is unreliable — it returns `true` whenever a network
 * interface exists (e.g. 4G radio on with no data plan, WiFi connected to a
 * router with no internet). We combine it with a timeout: if Convex auth
 * hasn't resolved after 5 s, we treat the connection as unavailable.
 *
 * Usage:
 *   const { shouldUseFallback, markResolved } = useAuthFallback();
 *
 *   // Render <MarkAuthResolved onMark={markResolved} /> inside <Authenticated>
 *   // and <Unauthenticated> so the timer is cancelled when auth actually works.
 */
export function useAuthFallback(timeoutMs = 5000) {
  const isOnline = useOnlineStatus();
  const [timedOut, setTimedOut] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (resolved) return; // auth resolved — no need to time out
    const timer = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [resolved, timeoutMs]);

  const markResolved = useCallback(() => setResolved(true), []);

  // Use offline fallback when: no network at all, OR waited too long for auth
  const shouldUseFallback = !isOnline || (timedOut && !resolved);

  return { shouldUseFallback, markResolved };
}

/**
 * Drop this inside <Authenticated> and <Unauthenticated> to tell the hook
 * that Convex auth resolved so the timeout is cancelled.
 */
export function MarkAuthResolved({ onMark }: { onMark: () => void }) {
  const calledRef = useRef(false);
  useEffect(() => {
    if (!calledRef.current) {
      calledRef.current = true;
      onMark();
    }
  }, [onMark]);
  return null;
}
