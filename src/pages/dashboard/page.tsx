import { useState, useEffect } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { useOfflineSync, useOfflineQueueState } from "@/hooks/use-offline-queue.ts";
import OfflineBanner from "@/components/ui/offline-banner.tsx";
import DashboardNavbar from "./_components/DashboardNavbar.tsx";
import SiteSidebar from "./_components/SiteSidebar.tsx";
import LogList from "./_components/LogList.tsx";
import DashboardHome from "./_components/DashboardHome.tsx";
import CreateLogDialog from "./_components/CreateLogDialog.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useIsMobile } from "@/hooks/use-mobile.ts";

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
  const isMobile = useIsMobile();
  const [selectedSiteId, setSelectedSiteId] = useState<Id<"sites"> | null>(null);
  const [globalCreateOpen, setGlobalCreateOpen] = useState(false);
  const [siteDrawerOpen, setSiteDrawerOpen] = useState(false);

  // Offline sync — auto-syncs queue when coming back online
  const { isSyncing, syncQueue, isOnline } = useOfflineSync();
  const offlineQueue = useOfflineQueueState();

  const handleSiteDeleted = (id: Id<"sites">) => {
    if (selectedSiteId === id) setSelectedSiteId(null);
  };

  const handleLogCreated = (siteId: Id<"sites">) => {
    setSelectedSiteId(siteId);
    setSiteDrawerOpen(false);
  };

  const handleSelectSite = (id: Id<"sites">) => {
    setSelectedSiteId(id);
    setSiteDrawerOpen(false);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <BackBlocker />
      <DashboardNavbar
        onNewLog={() => setGlobalCreateOpen(true)}
        onMenuClick={isMobile ? () => setSiteDrawerOpen(true) : undefined}
      />
      <OfflineBanner
        isOnline={isOnline}
        pendingCount={offlineQueue.length}
        isSyncing={isSyncing}
        onSync={syncQueue}
      />

      {isMobile ? (
        /* ── Mobile layout ─────────────────────────────────────────────
           No inline sidebar. Tap the hamburger to open the site drawer.
           When a site is selected: full-screen log list with back button.
           When no site is selected: full-screen "start" state.           */
        <main className="flex-1 overflow-hidden flex flex-col">
          {selectedSiteId ? (
            <LogList
              siteId={selectedSiteId}
              onBack={() => setSelectedSiteId(null)}
            />
          ) : (
            <DashboardHome
              onNewLog={() => setGlobalCreateOpen(true)}
              onSelectSite={handleSelectSite}
            />
          )}
        </main>
      ) : (
        /* ── Desktop layout ────────────────────────────────────────────
           Classic sidebar + main content                                */
        <div className="flex flex-1 overflow-hidden">
          <SiteSidebar
            selectedSiteId={selectedSiteId}
            onSelectSite={setSelectedSiteId}
            onSiteDeleted={handleSiteDeleted}
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
        </div>
      )}

      {/* Mobile site drawer — width follows stored sidebar width */}
      <Sheet open={siteDrawerOpen} onOpenChange={setSiteDrawerOpen}>
        <SheetContent side="left" className="p-0 flex flex-col [&>button]:hidden" style={{ width: (() => { try { const w = localStorage.getItem("groundwork_sidebar_width"); return w ? `${Math.max(220, parseInt(w, 10))}px` : "320px"; } catch { return "320px"; } })() }}>
          <SheetHeader className="sr-only">
            <SheetTitle>Sites</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <SiteSidebar
              selectedSiteId={selectedSiteId}
              onSelectSite={handleSelectSite}
              onSiteDeleted={handleSiteDeleted}
              fullscreen
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Global create dialog */}
      <CreateLogDialog
        open={globalCreateOpen}
        onClose={() => setGlobalCreateOpen(false)}
        onCreated={handleLogCreated}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <AuthLoading>
        <div className="flex items-center justify-center h-screen bg-background">
          <Skeleton className="h-10 w-32" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
          <p className="text-muted-foreground">Sign in to access your dashboard</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <Authenticated>
        <DashboardInner />
      </Authenticated>
    </>
  );
}
