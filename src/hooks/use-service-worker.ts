import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Registers the service worker in production only.
 * In development the SW can cache stale Vite dependency chunks leading to
 * duplicate React instances and "Invalid hook call" errors — so we skip it
 * and proactively unregister any leftover dev-mode SW.
 */
export function useServiceWorker() {
  const toastShown = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Skip registration on the Vite dev server to avoid caching stale chunks
    if (import.meta.env.DEV) {
      // Unregister any leftover service worker from a previous session
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const r of regs) r.unregister();
      });
      return;
    }

    const showUpdateToast = () => {
      if (toastShown.current) return;
      toastShown.current = true;
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
  }, []);
}
