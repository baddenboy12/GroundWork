import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { format } from "date-fns";
import { Clock, MapPin, ImageIcon, ClipboardList, Plus, FileDown, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { CATEGORY_COLORS, CATEGORY_LABELS, type LogCategory } from "../_lib/constants.ts";
import { cn } from "@/lib/utils.ts";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { useSubscription } from "@/hooks/use-subscription.ts";
import FilterBar, { type FilterState } from "./FilterBar.tsx";
import GlobalExportDialog from "./GlobalExportDialog.tsx";
import UpgradeDialog from "./UpgradeDialog.tsx";
import LogDetailDialog from "./LogDetailDialog.tsx";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";

type RecentLog = Doc<"logs"> & { siteName: string; photoUrls: string[] };

const DEFAULT_FILTERS: FilterState = {
  search: "",
  category: "all",
  dateFrom: "",
  dateTo: "",
};

type Props = {
  onNewLog: () => void;
  onSelectSite: (id: Id<"sites">) => void;
};

export default function DashboardHome({ onNewLog, onSelectSite }: Props) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [openLog, setOpenLog] = useState<RecentLog | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportUpgradeOpen, setExportUpgradeOpen] = useState(false);
  const { isAtLeast } = useSubscription();
  const canExport = isAtLeast("pro");

  const [debouncedSearch] = useDebounce(filters.search.trim(), 300);

  const isFiltered =
    debouncedSearch.length > 0 ||
    filters.category !== "all" ||
    !!filters.dateFrom ||
    !!filters.dateTo;

  const isSearchMode = debouncedSearch.length > 0;

  const categoryArg =
    filters.category !== "all" ? filters.category : undefined;

  // Default recent logs (no filters)
  const recent = useQuery(
    api.logs.listRecent,
    !isFiltered ? { limit: 24 } : "skip"
  );

  // Filtered (no text search)
  const filtered = useQuery(
    api.logs.listRecentFiltered,
    isFiltered && !isSearchMode
      ? {
          category: categoryArg,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          limit: 50,
        }
      : "skip"
  );

  // Full-text search
  const searched = useQuery(
    api.logs.searchAllLogs,
    isSearchMode
      ? {
          query: debouncedSearch,
          category: categoryArg,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
        }
      : "skip"
  );

  const logs: RecentLog[] | undefined = isSearchMode
    ? (searched as RecentLog[] | undefined)
    : isFiltered
    ? (filtered as RecentLog[] | undefined)
    : (recent as RecentLog[] | undefined);

  const isLoading = logs === undefined;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Recent Activity</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your latest log entries across all sites
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => canExport ? setExportOpen(true) : setExportUpgradeOpen(true)}
        >
          {canExport ? <FileDown className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          <span className="hidden sm:inline">Export</span>
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="mb-5">
        <FilterBar
          filters={filters}
          onChange={setFilters}
          resultCount={isFiltered && !isLoading ? (logs?.length ?? 0) : null}
          isSearchMode={isFiltered}
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <ClipboardList className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            {isFiltered ? (
              <>
                <p className="font-medium text-foreground">No results found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your search or filters
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-foreground">No entries yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first log entry to get started
                </p>
              </>
            )}
          </div>
          {!isFiltered && (
            <Button size="sm" onClick={onNewLog}>
              <Plus className="w-4 h-4 mr-1.5" /> New log entry
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {logs.map((log) => (
            <RecentLogCard
              key={log._id}
              log={log}
              onClick={() => setOpenLog(log)}
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

      <GlobalExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />

      <UpgradeDialog
        open={exportUpgradeOpen}
        onClose={() => setExportUpgradeOpen(false)}
        requiredTier="pro"
        featureName="PDF & CSV Export"
        featureDescription="Export your log entries as PDF reports or CSV spreadsheets with a Pro plan."
      />
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
