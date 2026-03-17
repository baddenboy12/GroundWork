import { useState, useEffect } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useOfflineSync, useOfflineQueueState } from "@/hooks/use-offline-queue.ts";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import { hasStoredOidcSession } from "@/lib/offline-session.ts";
import OfflineBanner from "@/components/ui/offline-banner.tsx";
import DashboardNavbar from "./_components/DashboardNavbar.tsx";
import SitePopout from "./_components/SitePopout.tsx";
import LogList from "./_components/LogList.tsx";
import DashboardHome from "./_components/DashboardHome.tsx";
import CreateLogDialog from "./_components/CreateLogDialog.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

// Blocks the Android back button / swipe-back gesture in standalone PWA mode.
// Uses the popstate event to detect back navigation and push a new history
// entry, keeping the user on the dashboard.
function BackBlocker() {
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (!isStandalone) return;

    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };

    // Push a sentinel entry so the first back press is absorbed
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return null;
}

function DashboardInner() {
  const [selectedSiteId, setSelectedSiteId] = useState<Id<"sites"> | null>(null);
  const [globalCreateOpen, setGlobalCreateOpen] = useState(false);

  // Offline sync — auto-syncs queue when coming back online
  const { isSyncing, syncQueue, isOnline } = useOfflineSync();
  const offlineQueue = useOfflineQueueState();

  const handleSiteDeleted = (id: Id<"sites">) => {
    if (selectedSiteId === id) setSelectedSiteId(null);
  };

  const handleLogCreated = (siteId: Id<"sites">) => {
    setSelectedSiteId(siteId);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <BackBlocker />
      <DashboardNavbar onNewLog={() => setGlobalCreateOpen(true)} />

      {/* Site selector sub-bar — sits directly under the top bar, left-anchored */}
      <div className="flex items-center px-4 py-2 border-b border-border bg-card/80 shrink-0">
        <SitePopout
          selectedSiteId={selectedSiteId}
          onSelectSite={setSelectedSiteId}
          onSiteDeleted={handleSiteDeleted}
        />
      </div>

      <OfflineBanner
        isOnline={isOnline}
        pendingCount={offlineQueue.length}
        isSyncing={isSyncing}
        onSync={syncQueue}
      />

      <main className="flex-1 overflow-hidden flex flex-col">
        {selectedSiteId ? (
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
  const isOnline = useOnlineStatus();

  // ── Offline mode ────────────────────────────────────────────────────────────
  // Convex auth needs a live WebSocket; offline it stays loading forever.
  // The OIDC library also tries to fetch the discovery document on startup,
  // which hangs. Instead, read the stored OIDC session from localStorage
  // synchronously — no network required.
  if (!isOnline) {
    return hasStoredOidcSession() ? (
      <DashboardInner />
    ) : (
      <DashboardSignInScreen message="No offline session found. Connect to the internet and sign in first." />
    );
  }

  // ── Online mode: normal Convex auth flow ────────────────────────────────────
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
