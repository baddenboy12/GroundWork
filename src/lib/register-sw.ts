/**
 * Registers the service worker in production only.
 * Called at module level from App.tsx — completely outside the React tree
 * to avoid any dependency on React hooks / duplicate React instance issues.
 */

import { toast } from "sonner";

let updateToastShown = false;

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  // Skip registration on the Vite dev server to avoid caching stale chunks
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const r of regs) r.unregister();
    });
    return;
  }

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
