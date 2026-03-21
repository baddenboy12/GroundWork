import { useState } from "react";
import { format } from "date-fns";
import { motion } from "motion/react";
import { Clock, User, ImageIcon, MapPin } from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_LABELS, type LogCategory } from "../_lib/constants.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";
import LogDetailDialog from "./LogDetailDialog.tsx";

type LogWithAuthor = Doc<"logs"> & { authorName: string; photoUrls: string[] };

type Props = {
  log: LogWithAuthor;
  /** When provided, renders a site name badge above the category tag */
  siteName?: string;
};

export default function LogCard({ log, siteName }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);
  const photos = log.photoUrls ?? [];
  const coverPhoto = photos[0];

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setDetailOpen(true)}
        className="group w-full h-full text-left bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary flex flex-col"
        whileTap={{ scale: 0.96 }}
        whileHover={{ y: -2 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
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
        <div className="p-5 space-y-3 flex-1 flex flex-col">
          {/* Site badge + category */}
          <div className="flex items-center gap-2.5 overflow-hidden">
            {siteName && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary min-w-0">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{siteName}</span>
              </span>
            )}
            <span
              className={cn(
                "inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium border shrink-0",
                CATEGORY_COLORS[log.category as LogCategory]
              )}
            >
              {CATEGORY_LABELS[log.category as LogCategory]}
            </span>
            {photos.length > 0 && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground ml-auto">
                <ImageIcon className="w-4 h-4" />
                {photos.length}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-foreground text-2xl leading-snug line-clamp-2">
            {log.title}
          </h3>

          {/* Excerpt */}
          <p className="text-xl text-muted-foreground leading-relaxed line-clamp-2">
            {log.content}
          </p>

          {/* Footer meta */}
          <div className="flex items-center gap-3 pt-1 text-lg text-muted-foreground/70 mt-auto">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {format(new Date(log.loggedAt), "MMM d, yyyy")}
            </span>
            <span className="flex items-center gap-1.5 truncate">
              <User className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{log.authorName}</span>
            </span>
          </div>
        </div>
      </motion.button>

      <LogDetailDialog
        log={log}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </>
  );
}
