import { useState, useEffect } from "react";
import { Authenticated, Unauthenticated, AuthLoading, useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Plus, FileDown, Lock, WifiOff, ChevronLeft } from "lucide-react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useOfflineSync, useOfflineQueueState } from "@/hooks/use-offline-queue.ts";
import { useBackgroundCacheSync } from "@/hooks/use-background-cache-sync.ts";
import { useSubscription } from "@/hooks/use-subscription.ts";
import { hasStoredOidcSession } from "@/lib/offline-session.ts";
import { cn } from "@/lib/utils.ts";
import OfflineBanner from "@/components/ui/offline-banner.tsx";
import DashboardNavbar from "./_components/DashboardNavbar.tsx";
import SitePopout from "./_components/SitePopout.tsx";
import LogList from "./_components/LogList.tsx";
import DashboardHome from "./_components/DashboardHome.tsx";
import StatsView from "./_components/StatsView.tsx";
import CreateLogDialog from "./_components/CreateLogDialog.tsx";
import ExportDialog from "./_components/ExportDialog.tsx";
import GlobalExportDialog from "./_components/GlobalExportDialog.tsx";
import UpgradeDialog from "./_components/UpgradeDialog.tsx";
import FilterBar, { type FilterState } from "./_components/FilterBar.tsx";
import { useCachedQuery } from "@/hooks/use-cached-query.ts";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const DEFAULT_FILTERS: FilterState = { search: "", category: "all", dateFrom: "", dateTo: "" };

// Blocks the Android back button / swipe-back gesture in standalone PWA mode.
function BackBlocker() {
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (!isStandalone) return;

    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };

    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return null;
}

/**
 * Watches for explicit sign-out while the dashboard is open.
 *
 * When Convex confirms the user is unauthenticated AND there is no stored
 * OIDC session (meaning the user actually signed out or their refresh token
 * expired), we redirect to the landing page.
 *
 * This does NOT redirect when offline — Convex auth stays in "loading" state
 * (isLoading = true) when the WebSocket can't connect, so the condition is
 * never satisfied offline.
 */
function DashboardSessionGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  useEffect(() => {
    // Only act when Convex has fully resolved (not just "loading")
    if (!isLoading && !isAuthenticated && !hasStoredOidcSession()) {
      window.location.replace("/");
    }
  }, [isAuthenticated, isLoading]);

  return <>{children}</>;
}

function DashboardInner() {
  const [selectedSiteId, setSelectedSiteId] = useState<Id<"sites"> | null>(null);
  const [globalCreateOpen, setGlobalCreateOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportUpgradeOpen, setExportUpgradeOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [debouncedSearch] = useDebounce(filters.search.trim(), 300);
  const isSearchMode = debouncedSearch.length > 0;
  const isFiltered = isSearchMode || filters.category !== "all" || !!filters.dateFrom || !!filters.dateTo;

  // Offline sync — auto-syncs queue when coming back online
  const { isSyncing, syncQueue, isOnline } = useOfflineSync();
  const offlineQueue = useOfflineQueueState();
  const { isAtLeast } = useSubscription();
  const canExport = isAtLeast("pro");

  // Site info for per-site export dialog
  const sitesRaw = useQuery(api.sites.list, {});
  const sites = useCachedQuery("gw_cache_sites_list", sitesRaw);
  const selectedSite = sites?.find((s) => s._id === selectedSiteId);

  // Background cache — proactively caches every site's logs and photos
  // while online so they're available on any site after going offline.
  useBackgroundCacheSync();

  const selectSite = (id: Id<"sites"> | null) => {
    setSelectedSiteId(id);
    setFilters(DEFAULT_FILTERS);
  };

  const handleSiteDeleted = (id: Id<"sites">) => {
    if (selectedSiteId === id) selectSite(null);
  };

  const handleLogCreated = (siteId: Id<"sites">) => {
    setShowStats(false);
    selectSite(siteId);
  };

  const handleExport = () => {
    if (!isOnline) {
      toast.error("You're offline — export requires a connection");
      return;
    }
    if (!canExport) {
      setExportUpgradeOpen(true);
      return;
    }
    setExportOpen(true);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <BackBlocker />
      <DashboardNavbar
        onNewLog={() => setGlobalCreateOpen(true)}
        onStats={() => {
          setShowStats((v) => !v);
          selectSite(null);
        }}
      />

      {/* Site selector sub-bar — hidden when stats view is open */}
      {!showStats && (
        <div className="px-4 py-3.5 border-b border-border bg-card/80 shrink-0 space-y-3">
          {/* Top row: Sites + actions */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 shrink-0">
              {selectedSiteId && (
                <Button
                  variant="outline"
                  className="gap-1.5 font-semibold h-12 px-5 text-base rounded-xl"
                  onClick={() => selectSite(null)}
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </Button>
              )}
              <SitePopout
                selectedSiteId={selectedSiteId}
                onSelectSite={selectSite}
                onSiteDeleted={handleSiteDeleted}
              />
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <Button
                variant="secondary"
                className={cn("gap-2 h-12 px-5 text-base rounded-xl", !isOnline && "opacity-50")}
                onClick={handleExport}
                title={!isOnline ? "Export requires an internet connection" : undefined}
              >
                {!isOnline
                  ? <WifiOff className="w-5 h-5" />
                  : canExport ? <FileDown className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                <span className="hidden sm:inline">Export</span>
              </Button>
            </div>
          </div>
          {/* Bottom row: filters */}
          <FilterBar
            filters={filters}
            onChange={setFilters}
            resultCount={isFiltered ? null : null}
            isSearchMode={isFiltered}
          />
        </div>
      )}

      <OfflineBanner
        isOnline={isOnline}
        pendingCount={offlineQueue.length}
        isSyncing={isSyncing}
        onSync={syncQueue}
      />

      <main className="flex-1 overflow-hidden flex flex-col">
        {showStats ? (
          <StatsView onBack={() => setShowStats(false)} />
        ) : selectedSiteId ? (
          <LogList siteId={selectedSiteId} filters={filters} />
        ) : (
          <DashboardHome
            filters={filters}
            onSelectSite={selectSite}
          />
        )}
      </main>

      {/* Floating new log button */}
      {!showStats && (
        <button
          className="fixed bottom-36 right-12 w-20 h-20 rounded-full bg-primary text-primary-foreground shadow-2xl flex items-center justify-center hover:bg-primary/90 active:scale-90 transition-all z-50"
          onClick={() => setGlobalCreateOpen(true)}
          aria-label="New log"
        >
          <Plus className="w-9 h-9" />
        </button>
      )}

      {/* Global create dialog */}
      <CreateLogDialog
        open={globalCreateOpen}
        onClose={() => setGlobalCreateOpen(false)}
        onCreated={handleLogCreated}
        initialSiteName={selectedSite?.name}
      />

      {/* Export dialogs */}
      {selectedSiteId && selectedSite ? (
        <ExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          siteId={selectedSiteId}
          siteName={selectedSite.name}
          siteLocation={selectedSite.location}
        />
      ) : (
        <GlobalExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
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

function DashboardLoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

function DashboardSignInScreen({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background gap-4 px-6 text-center">
      <p className="text-muted-foreground">{message}</p>
      <SignInButton />
    </div>
  );
}

export default function DashboardPage() {
  // ── Local-first: render the dashboard immediately if a stored session exists ──
  // Convex will authenticate in the background (online) or use cached data
  // (offline). The DashboardSessionGuard watches for explicit sign-out and
  // redirects only when Convex confirms the session is truly gone.
  if (hasStoredOidcSession()) {
    return (
      <DashboardSessionGuard>
        <DashboardInner />
      </DashboardSessionGuard>
    );
  }

  // No stored session — require Convex auth (new user or just signed out)
  return (
    <>
      <AuthLoading>
        <DashboardLoadingScreen />
      </AuthLoading>
      <Unauthenticated>
        <DashboardSignInScreen message="Sign in to access your dashboard" />
      </Unauthenticated>
      <Authenticated>
        <DashboardInner />
      </Authenticated>
    </>
  );
}
