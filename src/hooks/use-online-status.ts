import { useState, useEffect, useCallback, useRef } from "react";

/**
 * How long to wait for the probe before deciding we're offline.
 * Must be <= the auth-fallback timeout (5 000 ms) so the offline path
 * activates before the user sees a spinning auth state.
 */
const PROBE_TIMEOUT_MS = 4500;

/**
 * How often to re-probe while the app is open.
 * Catches silent connectivity loss (4G radio on but no data plan / captive
 * portal) without hammering the network too often.
 */
const RECHECK_INTERVAL_MS = 20_000;

/**
 * Probe real network reachability by issuing a HEAD request to the app
 * shell.  HEAD is intentionally used because:
 *
 * 1. The service worker only intercepts GET requests, so HEAD requests always
 *    go directly to the network — we never get a cached "success" while offline.
 * 2. The server returns no body, so the probe is as lightweight as possible.
 *
 * An AbortController enforces a hard timeout so that "4G connected but no
 * data" scenarios fail promptly instead of waiting for the OS TCP timeout.
 */
async function probeNetwork(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch("/", {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    // AbortError, TypeError (network failure), etc.
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns true when the device has a working internet connection.
 *
 * Unlike a raw `navigator.onLine` check this hook performs an actual
 * network probe on mount, on browser online/offline events, and every
 * RECHECK_INTERVAL_MS while the app is open.  This reliably detects:
 *
 * - Devices with a 4G/WiFi radio on but no working data connection
 * - Captive portals that block all traffic
 * - Tablets that have never had a SIM card inserted
 */
export function useOnlineStatus(): boolean {
  // Optimistic initial value from navigator.onLine; corrected by the first
  // probe within PROBE_TIMEOUT_MS.
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const probingRef = useRef(false);

  const runProbe = useCallback(async () => {
    // Deduplicate concurrent calls
    if (probingRef.current) return;
    probingRef.current = true;
    try {
      const online = await probeNetwork();
      setIsOnline(online);
    } finally {
      probingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Probe immediately so we don't rely on navigator.onLine any longer than
    // PROBE_TIMEOUT_MS.
    void runProbe();

    const handleOnline = () => {
      // Browser thinks we're back — optimistically set true then confirm.
      setIsOnline(true);
      void runProbe();
    };
    const handleOffline = () => {
      // Browser is sure we're offline — no need to probe.
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Periodic re-check catches silent data loss after the initial probe.
    const interval = setInterval(() => void runProbe(), RECHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [runProbe]);

  return isOnline;
}
