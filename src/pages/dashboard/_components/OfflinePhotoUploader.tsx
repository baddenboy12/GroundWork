import { useRef, useState } from "react";
import { ImagePlus, CloudUpload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import type { OfflinePhoto } from "@/hooks/use-offline-queue.ts";

// Aggressive offline compression — keeps localStorage usage low
// ~1024px + 0.65 JPEG ≈ 100–200 KB binary per photo (130–270 KB base64)
const OFFLINE_MAX_DIMENSION = 1024;
const OFFLINE_JPEG_QUALITY = 0.65;
export const OFFLINE_MAX_PHOTOS = 5;

/** Compress a File into an OfflinePhoto (base64 data URL) for local storage */
async function compressForOffline(file: File): Promise<OfflinePhoto> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      if (width > OFFLINE_MAX_DIMENSION || height > OFFLINE_MAX_DIMENSION) {
        if (width >= height) {
          height = Math.round((height / width) * OFFLINE_MAX_DIMENSION);
          width = OFFLINE_MAX_DIMENSION;
        } else {
          width = Math.round((width / height) * OFFLINE_MAX_DIMENSION);
          height = OFFLINE_MAX_DIMENSION;
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

      const dataUrl = canvas.toDataURL("image/jpeg", OFFLINE_JPEG_QUALITY);
      const fileName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
      // Approximate binary size from base64 length
      const base64Length = dataUrl.length - "data:image/jpeg;base64,".length;
      const bytes = Math.round(base64Length * 0.75);

      resolve({ dataUrl, fileName, bytes });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };

    img.src = objectUrl;
  });
}

type Props = {
  photos: OfflinePhoto[];
  onChange: (photos: OfflinePhoto[]) => void;
};

export default function OfflinePhotoUploader({ photos, onChange }: Props) {
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!fileArray.length) {
      toast.error("Only image files are supported");
      return;
    }
    const remaining = OFFLINE_MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${OFFLINE_MAX_PHOTOS} photos can be stored offline`);
      return;
    }
    setProcessing(true);
    try {
      const compressed = await Promise.all(
        fileArray.slice(0, remaining).map(compressForOffline)
      );
      onChange([...photos, ...compressed]);
    } catch {
      toast.error("Failed to process photo(s)");
    } finally {
      setProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-2.5">
      {/* Offline storage notice */}
      <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/8 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
        <CloudUpload className="w-3.5 h-3.5 shrink-0" />
        <span>
          Saved locally · automatically uploaded to cloud when you reconnect
        </span>
      </div>

      {/* Drop zone — only shown when under the limit */}
      {photos.length < OFFLINE_MAX_PHOTOS && (
        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors",
            dragOver
              ? "border-amber-500 bg-amber-500/10"
              : "border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-50/10 dark:hover:bg-amber-900/10"
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
            onChange={(e) => {
              if (e.target.files) {
                void handleFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />
          {processing ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
              <span className="text-sm">Compressing for offline storage…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-amber-600/80 dark:text-amber-400/80">
              <ImagePlus className="w-6 h-6" />
              <p className="text-sm font-medium">Tap to take photo or browse</p>
              <p className="text-xs text-muted-foreground/60">
                Up to {OFFLINE_MAX_PHOTOS} photos · compressed for offline use
              </p>
            </div>
          )}
        </div>
      )}

      {/* Photo thumbnails */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, i) => (
            <div
              key={i}
              className="relative group rounded-lg overflow-hidden aspect-square bg-muted"
            >
              <img
                src={photo.dataUrl}
                alt={photo.fileName}
                className="w-full h-full object-cover"
              />
              {/* Offline badge */}
              <div className="absolute bottom-1 left-1 bg-amber-500/80 text-white rounded px-1 py-0.5 text-[9px] font-medium leading-none">
                offline
              </div>
              <button
                type="button"
                onClick={() => onChange(photos.filter((_, idx) => idx !== i))}
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
