import { isNative } from "@/lib/platform";

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/**
 * Get the current GPS position using the native Geolocation plugin
 * on Capacitor, or the browser Geolocation API on web.
 */
export async function getCurrentPosition(): Promise<GeoPosition> {
  if (isNative) {
    const { Geolocation } = await import("@capacitor/geolocation");
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 30000,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
  }

  // Web fallback — wrap callback API in a promise
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        const messages: Record<number, string> = {
          1: "Location permission denied",
          2: "Location unavailable",
          3: "Location request timed out",
        };
        reject(new Error(messages[err.code] ?? "Geolocation error"));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  });
}
