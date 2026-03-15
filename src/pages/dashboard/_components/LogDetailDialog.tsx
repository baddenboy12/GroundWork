import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx";
import { Trash2, Pencil, Clock, User, MapPin, ImageIcon, X } from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_LABELS, type LogCategory } from "../_lib/constants.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";
import PhotoLightbox from "./PhotoLightbox.tsx";
import EditLogDialog from "./EditLogDialog.tsx";

type LogWithAuthor = Doc<"logs"> & { authorName: string; photoUrls: string[] };

type Props = {
  log: LogWithAuthor;
  open: boolean;
  onClose: () => void;
};

export default function LogDetailDialog({ log, open, onClose }: Props) {
  const removeLog = useMutation(api.logs.remove);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const photos = log.photoUrls ?? [];

  // Close on Escape (only when lightbox is not open)
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && lightboxIndex === null) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, lightboxIndex, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleDelete = async () => {
    try {
      await removeLog({ logId: log._id });
      toast.success("Log entry deleted");
      onClose();
    } catch {
      toast.error("Failed to delete log entry");
    }
  };

  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop + centering wrapper */}
      <div
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4"
        onClick={onClose}
      >
        {/* Modal panel — stop clicks propagating to backdrop */}
        <div
          className="relative bg-background rounded-xl w-full max-w-5xl max-h-[94vh] overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>

          {/* Photo strip */}
          {photos.length > 0 && (
            <div
              className={cn(
                "grid gap-1 rounded-t-xl overflow-hidden",
                photos.length === 1 && "grid-cols-1",
                photos.length === 2 && "grid-cols-2",
                photos.length >= 3 && "grid-cols-3"
              )}
            >
              {photos.slice(0, 6).map((url, i) => {
                const isLast = i === 5 && photos.length > 6;
                return (
                  <button
                    key={url}
                    type="button"
                    className="relative overflow-hidden bg-muted hover:opacity-90 transition-opacity aspect-[4/3]"
                    onClick={() => setLightboxIndex(i)}
                  >
                    <img
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {isLast && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white text-xl font-bold">+{photos.length - 6}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="p-6 sm:p-8 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pr-6">
              <div className="space-y-2">
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                    CATEGORY_COLORS[log.category as LogCategory]
                  )}
                >
                  {CATEGORY_LABELS[log.category as LogCategory]}
                </span>
                <h2 className="text-2xl font-semibold leading-snug text-foreground">{log.title}</h2>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete log entry?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this log entry and all attached photos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={handleDelete}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {/* Content */}
            <p className="text-base text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {log.content}
            </p>

            {/* Meta */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 pt-3 border-t border-border/50 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {format(new Date(log.loggedAt), "MMM d, yyyy 'at' h:mm a")}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                {log.authorName}
              </span>
              {log.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {log.location}
                </span>
              )}
              {log.latitude != null && log.longitude != null && (
                <span className="font-mono text-[10px] text-muted-foreground/70 tabular-nums">
                  {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}
                </span>
              )}
              {photos.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  {photos.length} photo{photos.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox — separate portal layer above everything */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      <EditLogDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        log={log}
      />
    </>,
    document.body
  );
}
