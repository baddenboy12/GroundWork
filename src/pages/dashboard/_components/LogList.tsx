import { useMemo, useEffect } from "react";
import { motion } from "motion/react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { MapPin, FileText } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import LogCard from "./LogCard.tsx";
import { type FilterState } from "./FilterBar.tsx";
import OfflinePendingCard from "./OfflinePendingCard.tsx";
import type { Id, Doc } from "@/convex/_generated/dataModel.d.ts";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { useCachedQuery } from "@/hooks/use-cached-query.ts";
import { useOfflineQueueState } from "@/hooks/use-offline-queue.ts";
import { type LogCategory } from "../_lib/constants.ts";

type LogWithAuthor = Doc<"logs"> & { authorName: string; photoUrls: string[] };

type Props = {
  siteId: Id<"sites">;
  filters: FilterState;
};

export default function LogList({ siteId, filters }: Props) {
  const sitesRaw = useQuery(api.sites.list, {});
  const sites = useCachedQuery("gw_cache_sites_list", sitesRaw);
  const site = sites?.find((s) => s._id === siteId);

  // ── Per-site log cache for offline fallback ───────────────────────────────
  // listBySiteSimple returns the most recent 50 logs without pagination.
  // useCachedQuery persists them to localStorage so they're available offline
  // even on a fresh cold start (before Convex auth resolves).
  const simpleCacheKey = `gw_cache_logs_${siteId}`;
  const simpleLogsRaw = useQuery(api.logs.listBySiteSimple, { siteId });
  const cachedLogs = useCachedQuery(simpleCacheKey, simpleLogsRaw);

  // Offline queue — filter entries for this site (match by name, case-insensitive)
  const offlineQueue = useOfflineQueueState();
  const pendingEntries = useMemo(() => {
    if (!site) return [];
    const siteLower = site.name.toLowerCase();
    return offlineQueue.filter((e) => e.siteName.toLowerCase() === siteLower);
  }, [offlineQueue, site]);

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
    // When the paginated query hasn't finished its first page yet (includes the
    // offline case where Convex never connects), fall back to the locally-cached
    // snapshot so the UI stays populated.
    const isPagedLoading = pagedStatus === "LoadingFirstPage";
    const base = (
      isSearchMode
        ? (searchResults ?? [])
        : isPagedLoading
        ? (cachedLogs ?? pagedResults)
        : pagedResults
    ) as LogWithAuthor[];

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
  }, [isSearchMode, searchResults, pagedResults, pagedStatus, cachedLogs, filters]);

  // Eagerly pre-cache all visible photo URLs into the SW cache
  useEffect(() => {
    if (!activeResults.length || !("caches" in window)) return;
    const urls: string[] = [];
    for (const log of activeResults) {
      if (log.photoUrls) {
        for (const url of log.photoUrls) {
          if (url) urls.push(url);
        }
      }
    }
    if (urls.length === 0) return;
    void (async () => {
      for (const url of urls) {
        try {
          const hit = await caches.match(url);
          if (!hit) await fetch(url);
        } catch { /* best-effort */ }
      }
    })();
  }, [activeResults]);

  // Show skeleton only when truly loading with no cached fallback available
  const isLoading = isSearchMode
    ? searchResults === undefined
    : pagedStatus === "LoadingFirstPage" && !cachedLogs;

  const hasMorePages = !isSearchMode && pagedStatus === "CanLoadMore";

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-4 md:px-6 py-3 bg-background shrink-0 space-y-3">

        {/* Site info */}
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">
              {site?.name ?? "Loading..."}
            </h2>
            {site?.location && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {site.location}
              </p>
            )}
          </div>
        </div>

      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
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
          </Empty>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
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
                  <LogCard log={log} siteName={site?.name} />
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

    </div>
  );
}
