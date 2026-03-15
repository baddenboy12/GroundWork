import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { format } from "date-fns";
import { Clock, MapPin, ImageIcon, ClipboardList } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { CATEGORY_COLORS, CATEGORY_LABELS, type LogCategory } from "../_lib/constants.ts";
import { cn } from "@/lib/utils.ts";
import LogDetailDialog from "./LogDetailDialog.tsx";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";

type RecentLog = Doc<"logs"> & { siteName: string; photoUrls: string[] };

type Props = {
  onNewLog: () => void;
  onSelectSite: (id: Id<"sites">) => void;
};

export default function DashboardHome({ onNewLog, onSelectSite }: Props) {
  const recent = useQuery(api.logs.listRecent, { limit: 12 });
  const [openLog, setOpenLog] = useState<RecentLog | null>(null);

  const isLoading = recent === undefined;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Recent Activity</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your latest log entries across all sites</p>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <ClipboardList className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">No entries yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first log entry to get started
            </p>
          </div>
          <Button size="sm" onClick={onNewLog}>
            <Plus className="w-4 h-4 mr-1.5" /> New log entry
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {recent.map((log) => (
            <RecentLogCard
              key={log._id}
              log={log as RecentLog}
              onClick={() => setOpenLog(log as RecentLog)}
              onSiteClick={() => onSelectSite(log.siteId)}
            />
          ))}
        </div>
      )}

      {openLog && (
        <LogDetailDialog
          log={{ ...openLog, authorName: "" }}
          open
          onClose={() => setOpenLog(null)}
        />
      )}
    </div>
  );
}

type CardProps = {
  log: RecentLog;
  onClick: () => void;
  onSiteClick: (e: React.MouseEvent) => void;
};

function RecentLogCard({ log, onClick, onSiteClick }: CardProps) {
  const coverPhoto = log.photoUrls?.[0];

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* Cover photo */}
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

      <div className="p-4 space-y-2.5">
        {/* Site badge + category */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Site name — clicking navigates to that site */}
          <span
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            onClick={(e) => { e.stopPropagation(); onSiteClick(e); }}
            role="button"
            tabIndex={-1}
          >
            <MapPin className="w-3 h-3" />
            {log.siteName}
          </span>
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
              CATEGORY_COLORS[log.category as LogCategory]
            )}
          >
            {CATEGORY_LABELS[log.category as LogCategory]}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">
          {log.title}
        </h3>

        {/* Excerpt */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {log.content}
        </p>

        {/* Footer */}
        <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground/70">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(log.loggedAt), "MMM d, yyyy")}
          </span>
          {log.photoUrls?.length > 0 && (
            <span className="flex items-center gap-1 ml-auto">
              <ImageIcon className="w-3 h-3" />
              {log.photoUrls.length}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
