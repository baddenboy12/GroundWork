import { useState, useEffect } from "react";
import { Authenticated, Unauthenticated, AuthLoading, useConvexAuth } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useOfflineSync, useOfflineQueueState } from "@/hooks/use-offline-queue.ts";
import { hasStoredOidcSession } from "@/lib/offline-session.ts";
import OfflineBanner from "@/components/ui/offline-banner.tsx";
import DashboardNavbar from "./_components/DashboardNavbar.tsx";
import SitePopout from "./_components/SitePopout.tsx";
import LogList from "./_components/LogList.tsx";
import DashboardHome from "./_components/DashboardHome.tsx";
import StatsView from "./_components/StatsView.tsx";
import CreateLogDialog from "./_components/CreateLogDialog.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

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

  // Offline sync — auto-syncs queue when coming back online
  const { isSyncing, syncQueue, isOnline } = useOfflineSync();
  const offlineQueue = useOfflineQueueState();

  const handleSiteDeleted = (id: Id<"sites">) => {
    if (selectedSiteId === id) setSelectedSiteId(null);
  };

  const handleLogCreated = (siteId: Id<"sites">) => {
    setShowStats(false);
    setSelectedSiteId(siteId);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <BackBlocker />
      <DashboardNavbar
        onNewLog={() => setGlobalCreateOpen(true)}
        onStats={() => {
          setShowStats((v) => !v);
          setSelectedSiteId(null);
        }}
      />

      {/* Site selector sub-bar — hidden when stats view is open */}
      {!showStats && (
        <div className="flex items-center px-4 py-2 border-b border-border bg-card/80 shrink-0">
          <SitePopout
            selectedSiteId={selectedSiteId}
            onSelectSite={setSelectedSiteId}
            onSiteDeleted={handleSiteDeleted}
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
          <LogList siteId={selectedSiteId} onBack={() => setSelectedSiteId(null)} />
        ) : (
          <DashboardHome
            onNewLog={() => setGlobalCreateOpen(true)}
            onSelectSite={setSelectedSiteId}
          />
        )}
      </main>

      {/* Global create dialog */}
      <CreateLogDialog
        open={globalCreateOpen}
        onClose={() => setGlobalCreateOpen(false)}
        onCreated={handleLogCreated}
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
