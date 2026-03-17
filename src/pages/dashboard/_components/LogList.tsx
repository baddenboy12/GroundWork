import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Plus, MapPin, FileDown, Lock, ChevronLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import LogCard from "./LogCard.tsx";
import CreateLogDialog from "./CreateLogDialog.tsx";
import FilterBar, { type FilterState } from "./FilterBar.tsx";
import UpgradeDialog from "./UpgradeDialog.tsx";
import ExportDialog from "./ExportDialog.tsx";
import OfflinePendingCard from "./OfflinePendingCard.tsx";
import type { Id, Doc } from "@/convex/_generated/dataModel.d.ts";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { useSubscription } from "@/hooks/use-subscription.ts";
import { useCachedQuery } from "@/hooks/use-cached-query.ts";
import { useOfflineQueueState } from "@/hooks/use-offline-queue.ts";
import { type LogCategory } from "../_lib/constants.ts";

type LogWithAuthor = Doc<"logs"> & { authorName: string; photoUrls: string[] };

type Props = {
  siteId: Id<"sites">;
  /** Mobile: callback to navigate back to the site list */
  onBack?: () => void;
};

const DEFAULT_FILTERS: FilterState = {
  search: "",
  category: "all",
  dateFrom: "",
  dateTo: "",
};

export default function LogList({ siteId, onBack }: Props) {
  const sitesRaw = useQuery(api.sites.list, {});
  const sites = useCachedQuery("gw_cache_sites_list", sitesRaw);
  const site = sites?.find((s) => s._id === siteId);
  const { isAtLeast } = useSubscription();
  const canExport = isAtLeast("pro");

  // Offline queue — filter entries for this site (match by name, case-insensitive)
  const offlineQueue = useOfflineQueueState();
  const pendingEntries = useMemo(() => {
    if (!site) return [];
    const siteLower = site.name.toLowerCase();
    return offlineQueue.filter((e) => e.siteName.toLowerCase() === siteLower);
  }, [offlineQueue, site]);

  const [createOpen, setCreateOpen] = useState(false);
  const [exportUpgradeOpen, setExportUpgradeOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // Debounce search to avoid firing on every keystroke
  const [debouncedSearch] = useDebounce(filters.search.trim(), 300);
  const isSearchMode = debouncedSearch.length > 0;

  // --- Paginated query (no search term) ---
  const {
    results: pagedResults,
    status: pagedStatus,
    loadMore,
  } = usePaginatedQuery(
    api.logs.listBySite,
    { siteId },
    { initialNumItems: 20 }
  );

  // --- Search query (when search term present) ---
  const searchResults = useQuery(
    api.logs.searchBySite,
    isSearchMode
      ? {
          siteId,
          query: debouncedSearch,
          category: filters.category !== "all" ? (filters.category as LogCategory) : undefined,
        }
      : "skip"
  );

  // Apply client-side date + category filters to whichever result set is active
  const activeResults: LogWithAuthor[] = useMemo(() => {
    const base = (isSearchMode ? (searchResults ?? []) : pagedResults) as LogWithAuthor[];

    return base.filter((log) => {
      // Category filter (only for paged mode; search mode filters server-side)
      if (!isSearchMode && filters.category !== "all" && log.category !== filters.category) {
        return false;
      }
      // Date from
      if (filters.dateFrom) {
        const fromUtc = new Date(filters.dateFrom + "T00:00:00.000Z");
        if (new Date(log.loggedAt) < fromUtc) return false;
      }
      // Date to
      if (filters.dateTo) {
        const toUtc = new Date(filters.dateTo + "T23:59:59.999Z");
        if (new Date(log.loggedAt) > toUtc) return false;
      }
      return true;
    });
  }, [isSearchMode, searchResults, pagedResults, filters]);

  const isLoading = isSearchMode
    ? searchResults === undefined
    : pagedStatus === "LoadingFirstPage";

  const hasMorePages = !isSearchMode && pagedStatus === "CanLoadMore";

  const handleOpenExport = () => {
    if (!canExport) { setExportUpgradeOpen(true); return; }
    setExportOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-4 md:px-6 py-3 bg-background shrink-0 space-y-3">

        {/* Top row */}
        <div className="flex items-center gap-2">
          {/* Back button */}
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 -ml-1"
              onClick={onBack}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}

          {/* Site name */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <h2 className="text-lg font-bold text-foreground truncate">
                {site?.name ?? "Loading..."}
              </h2>
            </div>
            {site?.location && (
              <p className="text-sm text-muted-foreground mt-0.5 ml-6 truncate">
                {site.location}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New log</span>
            </Button>
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={handleOpenExport}>
              {canExport ? <FileDown className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <FilterBar
          filters={filters}
          onChange={setFilters}
          resultCount={isSearchMode ? activeResults.length : null}
          isSearchMode={isSearchMode}
        />
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : activeResults.length === 0 && pendingEntries.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>
                {isSearchMode
                  ? `No results for "${debouncedSearch}"`
                  : filters.category !== "all" || filters.dateFrom || filters.dateTo
                  ? "No logs match your filters"
                  : "No log entries yet"}
              </EmptyTitle>
              <EmptyDescription>
                {isSearchMode || filters.category !== "all" || filters.dateFrom || filters.dateTo
                  ? "Try adjusting your search or filters"
                  : "Start documenting activity at this site"}
              </EmptyDescription>
            </EmptyHeader>
            {!isSearchMode && filters.category === "all" && !filters.dateFrom && !filters.dateTo && (
              <EmptyContent>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" /> New log entry
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* Pending offline entries for this site at the top */}
              {!isSearchMode && pendingEntries.map((entry, i) => (
                <motion.div
                  key={`offline-${entry.id}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.25, ease: "easeOut" }}
                >
                  <OfflinePendingCard entry={entry} />
                </motion.div>
              ))}
              {activeResults.map((log, i) => (
                <motion.div
                  key={log._id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.25, ease: "easeOut" }}
                >
                  <LogCard log={log} />
                </motion.div>
              ))}
            </div>
            {hasMorePages && (
              <div className="flex justify-center mt-6">
                <Button variant="secondary" size="sm" onClick={() => loadMore(20)}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <CreateLogDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initialSiteName={site?.name}
      />

      {site && (
        <ExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          siteId={siteId}
          siteName={site.name}
          siteLocation={site.location}
        />
      )}

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
