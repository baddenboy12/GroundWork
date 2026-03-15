import { useState } from "react";
import { format } from "date-fns";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { Trash2, User, Clock, ImageIcon, MapPin, Pencil } from "lucide-react";
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
import { CATEGORY_COLORS, CATEGORY_LABELS, type LogCategory } from "../_lib/constants.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";
import PhotoLightbox from "./PhotoLightbox.tsx";
import EditLogDialog from "./EditLogDialog.tsx";

type LogWithAuthor = Doc<"logs"> & { authorName: string; photoUrls: string[] };

type Props = {
  log: LogWithAuthor;
};

export default function LogCard({ log }: Props) {
  const removeLog = useMutation(api.logs.remove);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await removeLog({ logId: log._id });
      toast.success("Log entry deleted");
    } catch {
      toast.error("Failed to delete log entry");
    }
  };

  const photos = log.photoUrls ?? [];

  return (
    <>
      <div className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors">
        {/* Photo grid — consistent 4:3 tiles, fully visible, all clickable */}
        {photos.length > 0 && (
          <div
            className={cn(
              "grid gap-1 p-3 pb-0",
              photos.length === 1 && "grid-cols-1",
              photos.length === 2 && "grid-cols-2",
              photos.length >= 3 && "grid-cols-2"
            )}
          >
            {/* When 3 photos, first spans full width */}
            {photos.length === 3 && (
              <button
                type="button"
                className="col-span-2 relative rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity aspect-video"
                onClick={() => setLightboxIndex(0)}
              >
                <img
                  src={photos[0]}
                  alt="Photo 1"
                  className="w-full h-full object-contain"
                />
              </button>
            )}

            {/* For 3 photos show [1,2]; for others show first 4 */}
            {(photos.length === 3 ? photos.slice(1, 3) : photos.slice(0, 4)).map(
              (url, i) => {
                const realIndex = photos.length === 3 ? i + 1 : i;
                const isLastVisible = realIndex === 3 && photos.length > 4;
                return (
                  <button
                    key={url}
                    type="button"
                    className="relative rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity aspect-video"
                    onClick={() => setLightboxIndex(realIndex)}
                  >
                    <img
                      src={url}
                      alt={`Photo ${realIndex + 1}`}
                      className="w-full h-full object-contain"
                    />
                    {isLastVisible && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg">
                        <span className="text-white text-lg font-bold">
                          +{photos.length - 4}
                        </span>
                      </div>
                    )}
                  </button>
                );
              }
            )}
          </div>
        )}

        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                  CATEGORY_COLORS[log.category as LogCategory]
                )}
              >
                {CATEGORY_LABELS[log.category as LogCategory]}
              </span>
              {photos.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <ImageIcon className="w-3 h-3" />
                  {photos.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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

          <h3 className="font-semibold text-foreground mb-2 leading-snug">{log.title}</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed line-clamp-4">
            {log.content}
          </p>

          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {format(new Date(log.loggedAt), "MMM d, yyyy 'at' h:mm a")}
            </span>
            <span className="flex items-center gap-1.5">
              <User className="w-3 h-3" />
              {log.authorName}
            </span>
            {log.location && (
              <span className="flex items-center gap-1.5 truncate max-w-[240px]" title={log.location}>
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{log.location}</span>
              </span>
            )}
            {log.latitude != null && log.longitude != null && (
              <span className="font-mono text-[10px] text-muted-foreground/70 tabular-nums">
                {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}
              </span>
            )}
          </div>
        </div>
      </div>

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
    </>
  );
}
