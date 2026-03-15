// Shared image compression used by both the online uploader (before R2 upload)
// and the offline uploader (before local storage). Same settings mean the same
// quality whether the user is on- or offline.

/** Max dimension (width or height) before downscaling kicks in */
export const MAX_DIMENSION = 1920;
/** JPEG quality 0–1 (0.82 ≈ high quality, ~60–70% smaller than original) */
export const JPEG_QUALITY = 0.82;

/**
 * Compress an image File using Canvas:
 * - Scales down if either dimension exceeds MAX_DIMENSION (preserves aspect ratio)
 * - Re-encodes as JPEG at JPEG_QUALITY
 * Returns a new File with content-type image/jpeg
 */
export async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width >= height) {
          height = Math.round((height / width) * MAX_DIMENSION);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width / height) * MAX_DIMENSION);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas toBlob failed"));
            return;
          }
          const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
          resolve(new File([blob], name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };

    img.src = objectUrl;
  });
}
