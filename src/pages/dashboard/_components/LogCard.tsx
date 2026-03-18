import { useState } from "react";
import { format } from "date-fns";
import { Clock, User, ImageIcon } from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_LABELS, type LogCategory } from "../_lib/constants.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";
import LogDetailDialog from "./LogDetailDialog.tsx";

type LogWithAuthor = Doc<"logs"> & { authorName: string; photoUrls: string[] };

type Props = {
  log: LogWithAuthor;
};

export default function LogCard({ log }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);
  const photos = log.photoUrls ?? [];
  const coverPhoto = photos[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setDetailOpen(true)}
        className="group w-full text-left bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {/* Cover photo thumbnail */}
        {coverPhoto ? (
          <div className="aspect-video w-full overflow-hidden bg-muted">
            <img
              src={coverPhoto}
              alt="Cover"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="aspect-video w-full bg-muted/40 flex items-center justify-center">
            <span className="text-muted-foreground/30 text-xs uppercase tracking-widest font-medium">
              No photo
            </span>
          </div>
        )}

        {/* Summary */}
        <div className="p-4 space-y-2.5">
          {/* Category + photo count */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium border",
                CATEGORY_COLORS[log.category as LogCategory]
              )}
            >
              {CATEGORY_LABELS[log.category as LogCategory]}
            </span>
            {photos.length > 0 && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <ImageIcon className="w-4 h-4" />
                {photos.length}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-foreground text-4xl leading-snug line-clamp-2">
            {log.title}
          </h3>

          {/* Excerpt */}
          <p className="text-2xl text-muted-foreground leading-relaxed line-clamp-2">
            {log.content}
          </p>

          {/* Footer meta */}
          <div className="flex items-center gap-3 pt-1 text-xl text-muted-foreground/70">
            <span className="flex items-center gap-2">
              <Clock className="w-6 h-6" />
              {format(new Date(log.loggedAt), "MMM d, yyyy")}
            </span>
            <span className="flex items-center gap-2 truncate">
              <User className="w-6 h-6 shrink-0" />
              <span className="truncate">{log.authorName}</span>
            </span>
          </div>
        </div>
      </button>

      <LogDetailDialog
        log={log}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </>
  );
}
