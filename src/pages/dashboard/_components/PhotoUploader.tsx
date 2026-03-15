import { useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

export type R2Photo = {
  url: string;       // R2 public URL (persisted to DB)
  key: string;       // R2 object key
  bytes: number;     // file size in bytes
  previewUrl: string; // local blob URL for immediate preview
  fileName: string;
};

// Max dimension (width or height) in pixels before resizing kicks in
const MAX_DIMENSION = 1920;
// JPEG quality 0–1 (0.82 ≈ high quality, ~60–70% size reduction vs original)
const JPEG_QUALITY = 0.82;

/**
 * Compresses an image file using Canvas:
 * - Resizes if either dimension exceeds MAX_DIMENSION (maintains aspect ratio)
 * - Re-encodes as JPEG at JPEG_QUALITY
 * Returns a new File with content-type image/jpeg
 */
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Scale down if too large
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
          // Use .jpg extension for compressed output
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

type Props = {
  photos: R2Photo[];
  onChange: (photos: R2Photo[]) => void;
  maxPhotos?: number;
};

export default function PhotoUploader({ photos, onChange, maxPhotos = 10 }: Props) {
  const getUploadUrl = useAction(api.r2.storageActions.getUploadUrl);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (fileArray.length === 0) {
      toast.error("Only image files are supported");
      return;
    }
    const remaining = maxPhotos - photos.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${maxPhotos} photos allowed`);
      return;
    }
    const toUpload = fileArray.slice(0, remaining);
    setUploading(true);
    try {
      const uploaded: R2Photo[] = [];
      for (const file of toUpload) {
        // 1. Compress image before uploading
        const compressed = await compressImage(file);

        // 2. Get presigned PUT URL from backend (use compressed size)
        const { uploadUrl, key, publicUrl } = await getUploadUrl({
          fileName: compressed.name,
          contentType: compressed.type,
          bytes: compressed.size,
        });

        // 3. Upload compressed file directly to R2
        const res = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": compressed.type },
          body: compressed,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);

        // 4. Build photo object with local preview of original for speed
        uploaded.push({
          url: publicUrl,
          key,
          bytes: compressed.size,
          previewUrl: URL.createObjectURL(compressed),
          fileName: compressed.name,
        });
      }
      onChange([...photos, ...uploaded]);
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Upload failed");
      } else {
        toast.error("Failed to upload photo(s). Check your R2 configuration.");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      void uploadFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) void uploadFiles(e.dataTransfer.files);
  };

  const removePhoto = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      {photos.length < maxPhotos && (
        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors",
            dragOver
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50 hover:bg-accent/30"
          )}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm">Uploading to cloud storage…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImagePlus className="w-6 h-6 text-primary/60" />
              <p className="text-sm">
                Drop photos here or{" "}
                <span className="text-primary font-medium">browse</span>
              </p>
              <p className="text-xs text-muted-foreground/60">
                JPG, PNG, WEBP — auto-compressed · up to {maxPhotos} photos
              </p>
            </div>
          )}
        </div>
      )}

      {/* Photo previews */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, i) => (
            <div
              key={photo.key}
              className="relative group rounded-lg overflow-hidden aspect-square bg-muted"
            >
              <img
                src={photo.previewUrl}
                alt={photo.fileName}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
