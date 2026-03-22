import { useRef, useState } from "react";
import { motion, LayoutGroup } from "motion/react";
import { ImagePlus, CloudUpload, X, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import { compressImage } from "../_lib/compress-image.ts";
import type { OfflinePhoto } from "@/hooks/use-offline-queue.ts";
import { useDragReorder } from "../_lib/use-drag-reorder.ts";

async function compressToDataUrl(file: File): Promise<OfflinePhoto> {
  const compressed = await compressImage(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve({ dataUrl, fileName: compressed.name, bytes: compressed.size });
    };
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(compressed);
  });
}

type Props = {
  photos: OfflinePhoto[];
  onChange: (photos: OfflinePhoto[]) => void;
  maxPhotos?: number;
};

export default function OfflinePhotoUploader({ photos, onChange, maxPhotos = 10 }: Props) {
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!fileArray.length) { toast.error("Only image files are supported"); return; }
    const remaining = maxPhotos - photos.length;
    if (remaining <= 0) { toast.error(`Maximum ${maxPhotos} photos allowed`); return; }
    setProcessing(true);
    try {
      const compressed = await Promise.all(fileArray.slice(0, remaining).map(compressToDataUrl));
      onChange([...photos, ...compressed]);
    } catch {
      toast.error("Failed to process photo(s)");
    } finally {
      setProcessing(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) { void handleFiles(e.target.files); e.target.value = ""; }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
  };

  const { dragIndex, containerRef, handlePointerDown, handlePointerMove, handlePointerUp } = useDragReorder(photos, onChange);
  const atLimit = photos.length >= maxPhotos;

  return (
    <div className="space-y-2.5">
      {/* Offline storage notice */}
      <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/8 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
        <CloudUpload className="w-3.5 h-3.5 shrink-0" />
        <span>Saved locally · uploaded to cloud automatically when you reconnect</span>
      </div>

      {/* Hidden file inputs */}
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleInput} />
      {/* Camera capture — opens native camera app directly */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleInput} />

      {!atLimit && (
        processing ? (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground border-2 border-dashed border-amber-500/30 rounded-xl">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-sm">Compressing for offline storage…</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {/* Take Photo */}
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center gap-2.5 py-5 rounded-xl border-2 border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/70 transition-colors text-amber-600 dark:text-amber-400"
            >
              <Camera className="w-7 h-7" />
              <span className="text-sm font-semibold">Take Photo</span>
            </button>

            {/* Browse files / drop zone */}
            <div
              className={cn(
                "flex flex-col items-center gap-2.5 py-5 rounded-xl border-2 border-dashed cursor-pointer transition-colors",
                dragOver
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-amber-500/30 hover:border-amber-500/60 text-amber-600/80 dark:text-amber-400/80"
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="w-7 h-7" />
              <span className="text-sm font-semibold">Browse Files</span>
            </div>
          </div>
        )
      )}

      <p className="text-xs text-muted-foreground/60 text-center">
        Auto-compressed · {photos.length}/{maxPhotos} photos
      </p>

      {/* Thumbnails */}
      {photos.length > 0 && (
        <LayoutGroup>
          <div
            ref={containerRef}
            className="grid grid-cols-3 gap-2 select-none"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {photos.map((photo, i) => (
              <motion.div
                key={photo.dataUrl}
                layout
                layoutId={photo.dataUrl}
                data-reorder-index={i}
                onPointerDown={handlePointerDown(i)}
                className={cn(
                  "relative group rounded-lg overflow-hidden aspect-square bg-muted cursor-grab transition-all duration-150",
                  dragIndex === i && "ring-2 ring-amber-500/50 shadow-lg scale-105 z-10 opacity-90",
                  dragIndex !== null && dragIndex !== i && "ring-1 ring-amber-500/30 opacity-80"
                )}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <img
                  src={photo.dataUrl}
                  alt={photo.fileName}
                  className="w-full h-full object-cover pointer-events-none"
                  draggable={false}
                />
                <div className="absolute bottom-1 left-1 bg-amber-500/80 text-white rounded px-1 py-0.5 text-[9px] font-medium leading-none">
                  pending
                </div>
                <button
                  type="button"
                  data-no-drag
                  onClick={() => onChange(photos.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </div>
        </LayoutGroup>
      )}
    </div>
  );
}
