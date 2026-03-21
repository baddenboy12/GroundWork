import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { ClipboardList } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { useCachedQuery } from "@/hooks/use-cached-query.ts";
import { useOfflineQueueState } from "@/hooks/use-offline-queue.ts";
import { type FilterState } from "./FilterBar.tsx";
import LogCard from "./LogCard.tsx";
import OfflinePendingCard from "./OfflinePendingCard.tsx";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";

type RecentLog = Doc<"logs"> & { siteName: string; authorName: string; photoUrls: string[] };

type Props = {
  filters: FilterState;
  onSelectSite: (id: Id<"sites">) => void;
};

export default function DashboardHome({ filters, onSelectSite }: Props) {
  const myKeyInfo = useQuery(api.licenseKeys.getMyKeyInfo, {});
  const isInTeam = !!myKeyInfo;

  // Offline queue — show pending entries even when offline
  const offlineQueue = useOfflineQueueState();

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
  const recentRaw = useQuery(
    api.logs.listRecent,
    !isFiltered ? { limit: 24 } : "skip"
  );
  const recent = useCachedQuery("gw_cache_recent_logs", recentRaw);

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

  // Eagerly pre-cache all visible photo URLs into the SW cache
  useEffect(() => {
    if (!logs || !("caches" in window)) return;
    const urls: string[] = [];
    for (const log of logs) {
      if (log.photoUrls) {
        for (const url of log.photoUrls) {
          if (url) urls.push(url);
        }
      }
    }
    if (urls.length === 0) return;
    // Fire-and-forget: fetch each URL so the SW caches it
    void (async () => {
      for (const url of urls) {
        try {
          const hit = await caches.match(url);
          if (!hit) await fetch(url);
        } catch { /* best-effort */ }
      }
    })();
  }, [logs]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-foreground">Recent Activity</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isInTeam
            ? "Latest log entries across your team's sites"
            : "Your latest log entries across your personal sites"}
        </p>
      </div>


      {/* Grid */}
      {isLoading && offlineQueue.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : !isLoading && (logs ?? []).length === 0 && offlineQueue.length === 0 ? (
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
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {/* Pending offline entries at the top (only shown when not filtering) */}
          {!isFiltered && offlineQueue.map((entry, i) => (
            <motion.div
              key={`offline-${entry.id}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25, ease: "easeOut" }}
            >
              <OfflinePendingCard entry={entry} showSiteBadge />
            </motion.div>
          ))}
          {logs?.map((log, i) => (
            <motion.div
              key={log._id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (offlineQueue.length + i) * 0.05, duration: 0.25, ease: "easeOut" }}
            >
              <LogCard log={log} siteName={log.siteName} />
            </motion.div>
          ))}
        </div>
      )}

    </div>
  );
}

