import { useCallback } from "react";
import { isNative } from "@/lib/platform";

/**
 * Hook that provides a `takePhoto()` function using the native camera
 * when running inside Capacitor. Returns null on web (fall through to
 * the existing <input capture="environment"> approach).
 */
export function useNativeCamera() {
  const takePhoto = useCallback(async (): Promise<File | null> => {
    if (!isNative) return null;

    // Dynamic import to avoid bundling Capacitor camera plugin on web
    const { Camera, CameraResultType, CameraSource } = await import(
      "@capacitor/camera"
    );

    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        correctOrientation: true,
        width: 1920,
        height: 1920,
      });

      if (!photo.dataUrl) return null;

      // Convert data URL to File object for the existing upload pipeline
      const res = await fetch(photo.dataUrl);
      const blob = await res.blob();
      const fileName = `photo_${Date.now()}.jpeg`;
      return new File([blob], fileName, { type: "image/jpeg" });
    } catch {
      // User cancelled or permission denied
      return null;
    }
  }, []);

  return { takePhoto, isNative };
}
