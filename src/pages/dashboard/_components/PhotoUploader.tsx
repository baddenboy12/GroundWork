import { useRef, useState } from "react";
import { motion, LayoutGroup } from "motion/react";
import { ImagePlus, X, Camera } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { compressImage } from "../_lib/compress-image.ts";
import { useDragReorder } from "../_lib/use-drag-reorder.ts";
import { useNativeCamera } from "@/hooks/use-native-camera.ts";

export type R2Photo = {
  url: string;       // R2 public URL — empty string while pending upload
  key: string;       // R2 object key — empty string while pending upload
  bytes: number;     // file size in bytes
  previewUrl: string; // local blob URL for immediate preview
  fileName: string;
  /** Present when the photo has NOT been uploaded to R2 yet (staged locally). */
  file?: File;
};

type Props = {
  photos: R2Photo[];
  onChange: (photos: R2Photo[]) => void;
  maxPhotos?: number;
};

export default function PhotoUploader({ photos, onChange, maxPhotos = 10 }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const { takePhoto, isNative: isCapacitor } = useNativeCamera();

  /**
   * Stage files locally — no R2 upload yet.
   * The actual upload happens in CreateLogDialog on form submit.
   */
  const stageFiles = async (files: FileList | File[]) => {
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
    const toStage = fileArray.slice(0, remaining);
    const staged: R2Photo[] = [];
    for (const file of toStage) {
      const compressed = await compressImage(file);
      staged.push({
        url: "",            // not uploaded yet
        key: "",            // not uploaded yet
        bytes: compressed.size,
        previewUrl: URL.createObjectURL(compressed),
        fileName: compressed.name,
        file: compressed,   // kept for deferred upload
      });
    }
    onChange([...photos, ...staged]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      void stageFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) void stageFiles(e.dataTransfer.files);
  };

  const removePhoto = (index: number) => {
    const photo = photos[index];
    // Revoke the local blob URL to free memory
    if (photo.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    onChange(photos.filter((_, i) => i !== index));
  };

  const { dragIndex, swappedIndex, containerRef, handlePointerDown, handlePointerMove, handlePointerUp } = useDragReorder(photos, onChange);
  const atLimit = photos.length >= maxPhotos;

  return (
    <div className="space-y-3">
      {/* Hidden inputs */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />
      {/* Camera capture — opens native camera app directly */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileInput}
      />

      {!atLimit && (
        <div className="grid grid-cols-2 gap-2">
          {/* Take Photo button */}
          <motion.button
            type="button"
            onClick={async () => {
              if (isCapacitor) {
                const file = await takePhoto();
                if (file) await stageFiles([file]);
              } else {
                cameraRef.current?.click();
              }
            }}
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.03 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="flex flex-col items-center gap-2.5 py-5 rounded-xl border-2 border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/70 transition-colors text-primary"
          >
            <Camera className="w-7 h-7" />
            <span className="text-sm font-semibold">Take Photo</span>
          </motion.button>

          {/* Browse / drop zone */}
          <motion.div
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.03 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className={cn(
              "flex flex-col items-center gap-2.5 py-5 rounded-xl border-2 border-dashed cursor-pointer transition-colors",
              dragOver
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50 hover:bg-accent/30 text-muted-foreground"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="w-7 h-7" />
            <span className="text-sm font-semibold">Browse Files</span>
          </motion.div>
        </div>
      )}

      <p className="text-xs text-muted-foreground/60 text-center">
        Auto-compressed · {photos.length}/{maxPhotos} photos
      </p>

      {/* Photo previews */}
      {photos.length > 0 && (
        <LayoutGroup>
          <div
            ref={containerRef}
            className="grid grid-cols-4 gap-2 select-none"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {photos.map((photo, i) => (
              <motion.div
                key={photo.previewUrl}
                layout
                layoutId={photo.previewUrl}
                data-reorder-index={i}
                onPointerDown={handlePointerDown(i)}
                className={cn(
                  "relative group rounded-lg overflow-hidden aspect-square bg-muted cursor-grab",
                  dragIndex === i && "ring-2 ring-primary/50 shadow-lg z-10",
                  dragIndex !== null && dragIndex !== i && "ring-1 ring-primary/30"
                )}
                animate={{
                  scale: dragIndex === i ? 1.08 : swappedIndex === i ? 0.92 : 1,
                  opacity: dragIndex === i ? 0.85 : dragIndex !== null && dragIndex !== i ? 0.75 : 1,
                }}
                transition={{
                  layout: { type: "spring", stiffness: 250, damping: 22, mass: 0.8 },
                  scale: { type: "spring", stiffness: 350, damping: 15, mass: 0.6 },
                  opacity: { duration: 0.15 },
                }}
              >
                <img
                  src={photo.previewUrl}
                  alt={photo.fileName}
                  className="w-full h-full object-cover pointer-events-none"
                  draggable={false}
                />
                {/* Pending badge */}
                {photo.file && (
                  <div className="absolute bottom-1 left-1 bg-background/80 text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-muted-foreground">
                    Pending
                  </div>
                )}
                <button
                  type="button"
                  data-no-drag
                  onClick={() => removePhoto(i)}
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
