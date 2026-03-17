import { Clock, ImageIcon, MapPin, WifiOff } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils.ts";
import { CATEGORY_COLORS, CATEGORY_LABELS, type LogCategory } from "../_lib/constants.ts";
import type { OfflineEntry } from "@/hooks/use-offline-queue.ts";

/**
 * Card shown for log entries that are queued offline and haven't synced yet.
 * Visually distinct from real cards — amber border, "Pending sync" badge.
 */

type Props = {
  entry: OfflineEntry;
  /** If provided, renders a clickable site badge (used in dashboard-home view). */
  showSiteBadge?: boolean;
};

export default function OfflinePendingCard({ entry, showSiteBadge }: Props) {
  const coverPhoto = entry.photos?.[0]?.dataUrl;

  return (
    <div className="w-full text-left bg-card border border-amber-500/35 rounded-xl overflow-hidden">
      {/* Cover photo (base64 dataUrl from offline capture) */}
      {coverPhoto ? (
        <div className="aspect-video w-full overflow-hidden bg-muted">
          <img
            src={coverPhoto}
            alt="Cover"
            className="w-full h-full object-cover opacity-90"
          />
        </div>
      ) : (
        <div className="aspect-video w-full bg-amber-500/5 flex items-center justify-center">
          <span className="text-amber-500/30 text-xs uppercase tracking-widest font-medium">
            No photo
          </span>
        </div>
      )}

      <div className="p-4 space-y-2.5">
        {/* Badges row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Pending badge */}
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
            <WifiOff className="w-2.5 h-2.5" />
            Pending sync
          </span>

          {/* Site badge (dashboard-home only) */}
          {showSiteBadge && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              <MapPin className="w-3 h-3" />
              {entry.siteName}
            </span>
          )}

          {/* Category badge */}
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
              CATEGORY_COLORS[entry.category as LogCategory]
            )}
          >
            {CATEGORY_LABELS[entry.category as LogCategory]}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">
          {entry.title}
        </h3>

        {/* Content excerpt */}
        {entry.content && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {entry.content}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground/70">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(entry.loggedAt), "MMM d, yyyy")}
          </span>
          {(entry.photos?.length ?? 0) > 0 && (
            <span className="flex items-center gap-1 ml-auto">
              <ImageIcon className="w-3 h-3" />
              {entry.photos!.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
