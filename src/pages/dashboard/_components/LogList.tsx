import { useState, useMemo } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Plus, MapPin, FileText, FileDown, Lock } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu.tsx";
import LogCard from "./LogCard.tsx";
import CreateLogDialog from "./CreateLogDialog.tsx";
import FilterBar, { type FilterState } from "./FilterBar.tsx";
import UpgradeDialog from "./UpgradeDialog.tsx";
import type { Id, Doc } from "@/convex/_generated/dataModel.d.ts";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { useSubscription } from "@/hooks/use-subscription.ts";
import { type LogCategory } from "../_lib/constants.ts";
import { exportCSV, exportPDF } from "../_lib/export.ts";
import { toast } from "sonner";

type LogWithAuthor = Doc<"logs"> & { authorName: string; photoUrls: string[] };

type Props = {
  siteId: Id<"sites">;
};

const DEFAULT_FILTERS: FilterState = {
  search: "",
  category: "all",
  dateFrom: "",
  dateTo: "",
};

export default function LogList({ siteId }: Props) {
  const sites = useQuery(api.sites.list, {});
  const site = sites?.find((s) => s._id === siteId);
  const { isAtLeast } = useSubscription();
  const canExport = isAtLeast("pro");

  const [createOpen, setCreateOpen] = useState(false);
  const [exportUpgradeOpen, setExportUpgradeOpen] = useState(false);
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

  const handleExportCSV = () => {
    if (!canExport) { setExportUpgradeOpen(true); return; }
    if (activeResults.length === 0) { toast.error("No logs to export"); return; }
    exportCSV({ siteName: site?.name ?? "site", siteLocation: site?.location, logs: activeResults, filters });
    toast.success(`Exported ${activeResults.length} log entries as CSV`);
  };

  const handleExportPDF = () => {
    if (!canExport) { setExportUpgradeOpen(true); return; }
    if (activeResults.length === 0) { toast.error("No logs to export"); return; }
    exportPDF({ siteName: site?.name ?? "site", siteLocation: site?.location, logs: activeResults, filters });
    toast.success(`Exported ${activeResults.length} log entries as PDF`);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-6 py-3 bg-background shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground text-lg">{site?.name ?? "Loading..."}</h2>
            </div>
            {site?.location && (
              <p className="text-xs text-muted-foreground mt-0.5 ml-6">{site.location}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Export dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-1.5">
                  {canExport ? (
                    <FileDown className="w-4 h-4" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {canExport ? (
                  <>
                    <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                      Export {activeResults.length} {activeResults.length === 1 ? "entry" : "entries"}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleExportPDF}>
                      <FileText className="w-3.5 h-3.5 mr-2 text-red-400" />
                      Download PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportCSV}>
                      <FileDown className="w-3.5 h-3.5 mr-2 text-green-400" />
                      Download CSV
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                      Export requires Pro plan
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setExportUpgradeOpen(true)}>
                      <Lock className="w-3.5 h-3.5 mr-2 text-primary" />
                      Upgrade to unlock export
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" /> New log
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
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : activeResults.length === 0 ? (
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
            <div className="space-y-4">
              {activeResults.map((log) => (
                <LogCard key={log._id} log={log} />
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
        siteId={siteId}
      />

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
