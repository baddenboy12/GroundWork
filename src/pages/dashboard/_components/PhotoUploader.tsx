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
        // 1. Get presigned PUT URL from backend
        const { uploadUrl, key, publicUrl } = await getUploadUrl({
          fileName: file.name,
          contentType: file.type,
          bytes: file.size,
        });

        // 2. Upload directly to R2
        const res = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);

        // 3. Build photo object
        uploaded.push({
          url: publicUrl,
          key,
          bytes: file.size,
          previewUrl: URL.createObjectURL(file),
          fileName: file.name,
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
                JPG, PNG, WEBP — up to {maxPhotos} photos
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
