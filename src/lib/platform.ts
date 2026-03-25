/** Detect native platform safely — works even if Capacitor bridge isn't ready yet */
function detectNative(): boolean {
  try {
    // Check user agent first (set in capacitor.config.ts appendUserAgent)
    if (typeof navigator !== "undefined" && navigator.userAgent.includes("GroundWorkNative")) {
      return true;
    }
    // Fallback: check Capacitor global
    if (typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform?.()) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** True when running inside a Capacitor native shell (Android/iOS). */
export const isNative = detectNative();

/** True when running as a PWA in the browser (not in Capacitor). */
export const isWeb = !isNative;

/** Returns "android" | "ios" | "web" */
export const platform: "android" | "ios" | "web" = (() => {
  try {
    if (typeof window !== "undefined" && (window as any).Capacitor?.getPlatform) {
      return (window as any).Capacitor.getPlatform();
    }
    return "web";
  } catch {
    return "web";
  }
})();
