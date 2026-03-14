import { useState } from "react";
import { format } from "date-fns";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { Trash2, User, Clock, ImageIcon } from "lucide-react";
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

type LogWithAuthor = Doc<"logs"> & { authorName: string; photoUrls: string[] };

type Props = {
  log: LogWithAuthor;
};

export default function LogCard({ log }: Props) {
  const removeLog = useMutation(api.logs.remove);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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
        {/* Photo strip */}
        {photos.length > 0 && (
          <div className="flex gap-1 p-3 pb-0">
            {photos.slice(0, 4).map((url, i) => (
              <button
                key={url}
                type="button"
                className="relative rounded-lg overflow-hidden bg-muted shrink-0 hover:opacity-90 transition-opacity"
                style={{ width: photos.length === 1 ? "100%" : "80px", height: "80px" }}
                onClick={() => setLightboxIndex(i)}
              >
                <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                {/* "+N more" overlay on 4th photo if there are more */}
                {i === 3 && photos.length > 4 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">+{photos.length - 4}</span>
                  </div>
                )}
              </button>
            ))}
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

          <h3 className="font-semibold text-foreground mb-2 leading-snug">{log.title}</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed line-clamp-4">
            {log.content}
          </p>

          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {format(new Date(log.loggedAt), "MMM d, yyyy 'at' h:mm a")}
            </span>
            <span className="flex items-center gap-1.5">
              <User className="w-3 h-3" />
              {log.authorName}
            </span>
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
    </>
  );
}
