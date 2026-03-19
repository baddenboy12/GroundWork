/**
 * Registers the service worker in production only.
 * Called at module level from App.tsx — completely outside the React tree
 * to avoid any dependency on React hooks / duplicate React instance issues.
 *
 * Also:
 *  - Requests persistent storage so the browser won't evict cached photos.
 *  - Registers a Periodic Background Sync (Android/Chrome + installed PWA only)
 *    so photos are refreshed in the background even when the app is closed.
 */

import { toast } from "sonner";

let updateToastShown = false;

// How often the browser should attempt a background photo-cache refresh.
// The browser may fire less often depending on device usage patterns.
const PERIODIC_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000; // every 12 hours
const PERIODIC_SYNC_TAG = "photo-cache-refresh";

/**
 * Requests persistent storage so the browser treats our cache as durable
 * and won't evict it under storage pressure (same behaviour as installed apps).
 * Silently ignored on browsers that don't support the Storage API.
 */
async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) return;
    const already = await navigator.storage.persisted();
    if (already) return;
    await navigator.storage.persist();
  } catch {
    // Non-critical — best effort only
  }
}

/**
 * Registers a Periodic Background Sync so the service worker can refresh
 * the photo cache roughly every 12 hours even when the app is fully closed.
 *
 * Requirements (all must be true for this to work):
 *  - Browser: Chrome/Edge on Android (not iOS Safari — Apple doesn't allow it)
 *  - PWA must be installed (added to home screen)
 *  - The `periodic-background-sync` permission must be granted
 *
 * Gracefully no-ops on any browser that doesn't support the API.
 */
async function registerPeriodicSync(registration: ServiceWorkerRegistration) {
  try {
    // Feature-detect — most browsers don't support this yet
    if (!("periodicSync" in registration)) return;

    // Check permission (Chrome requires this query before registering)
    const perm = await navigator.permissions.query({
      name: "periodic-background-sync" as PermissionName,
    });
    if (perm.state !== "granted") return;

    // Register (or re-register) the sync tag with our desired interval.
    // The browser may choose to fire less frequently based on usage patterns.
    const ps = registration as unknown as {
      periodicSync: {
        register: (tag: string, opts: { minInterval: number }) => Promise<void>;
        getTags: () => Promise<string[]>;
      };
    };

    const existingTags = await ps.periodicSync.getTags();
    if (existingTags.includes(PERIODIC_SYNC_TAG)) return; // already registered

    await ps.periodicSync.register(PERIODIC_SYNC_TAG, {
      minInterval: PERIODIC_SYNC_INTERVAL_MS,
    });
  } catch {
    // Non-critical — background sync is a progressive enhancement
  }
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  // Skip registration on the Vite dev server to avoid caching stale chunks
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const r of regs) r.unregister();
    });
    return;
  }

  // Request persistent storage immediately — doesn't need the SW to be ready
  void requestPersistentStorage();

  const showUpdateToast = () => {
    if (updateToastShown) return;
    updateToastShown = true;
    toast("A new version is available!", {
      duration: Infinity,
      action: { label: "Refresh", onClick: () => window.location.reload() },
    });
  };

  navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      // Register periodic background sync once the SW is active
      void registerPeriodicSync(registration);

      if (registration.waiting) {
        showUpdateToast();
        return;
      }
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateToast();
          }
        });
      });
    })
    .catch((err) => console.log("Service Worker registration failed:", err));
}
