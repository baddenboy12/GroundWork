import { useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { ImagePlus, X, Loader2, Camera } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { compressImage } from "../_lib/compress-image.ts";

export type R2Photo = {
  url: string;       // R2 public URL (persisted to DB)
  key: string;       // R2 object key
  bytes: number;     // file size in bytes
  previewUrl: string; // local blob URL for immediate preview
  fileName: string;
};

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
  const cameraRef = useRef<HTMLInputElement>(null);

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
        const compressed = await compressImage(file);
        const { uploadUrl, key, publicUrl } = await getUploadUrl({
          fileName: compressed.name,
          contentType: compressed.type,
          bytes: compressed.size,
        });
        const res = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": compressed.type },
          body: compressed,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
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
        uploading ? (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground border-2 border-dashed border-border rounded-xl">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-sm">Uploading to cloud storage…</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {/* Take Photo button */}
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center gap-2.5 py-5 rounded-xl border-2 border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/70 transition-colors text-primary"
            >
              <Camera className="w-7 h-7" />
              <span className="text-sm font-semibold">Take Photo</span>
            </button>

            {/* Browse / drop zone */}
            <div
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
            </div>
          </div>
        )
      )}

      <p className="text-xs text-muted-foreground/60 text-center">
        Auto-compressed · {photos.length}/{maxPhotos} photos
      </p>

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
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
