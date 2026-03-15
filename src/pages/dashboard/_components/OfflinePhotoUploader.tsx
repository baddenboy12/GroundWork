import { useRef, useState } from "react";
import { ImagePlus, CloudUpload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import { compressImage } from "../_lib/compress-image.ts";
import type { OfflinePhoto } from "@/hooks/use-offline-queue.ts";

/**
 * Compress a File using the shared compression pipeline, then convert the
 * result to a base64 data URL so it can be persisted in localStorage.
 */
async function compressToDataUrl(file: File): Promise<OfflinePhoto> {
  const compressed = await compressImage(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve({
        dataUrl,
        fileName: compressed.name,
        bytes: compressed.size,
      });
    };
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(compressed);
  });
}

type Props = {
  photos: OfflinePhoto[];
  onChange: (photos: OfflinePhoto[]) => void;
  /** Maximum photos allowed — comes from the user's plan, same as online uploader */
  maxPhotos?: number;
};

export default function OfflinePhotoUploader({ photos, onChange, maxPhotos = 10 }: Props) {
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!fileArray.length) {
      toast.error("Only image files are supported");
      return;
    }
    const remaining = maxPhotos - photos.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${maxPhotos} photos allowed`);
      return;
    }
    setProcessing(true);
    try {
      const compressed = await Promise.all(
        fileArray.slice(0, remaining).map(compressToDataUrl)
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
        <span>Saved locally · uploaded to cloud automatically when you reconnect</span>
      </div>

      {/* Drop zone */}
      {photos.length < maxPhotos && (
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
              <p className="text-sm font-medium">
                Drop photos here or <span className="underline">browse</span>
              </p>
              <p className="text-xs text-muted-foreground/60">
                JPG, PNG, WEBP — auto-compressed · up to {maxPhotos} photos
              </p>
            </div>
          )}
        </div>
      )}

      {/* Thumbnails */}
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
              {/* Pending-sync badge */}
              <div className="absolute bottom-1 left-1 bg-amber-500/80 text-white rounded px-1 py-0.5 text-[9px] font-medium leading-none">
                pending
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
