import { useState } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import DashboardNavbar from "./_components/DashboardNavbar.tsx";
import SiteSidebar from "./_components/SiteSidebar.tsx";
import LogList from "./_components/LogList.tsx";
import DashboardHome from "./_components/DashboardHome.tsx";
import CreateLogDialog from "./_components/CreateLogDialog.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useIsMobile } from "@/hooks/use-mobile.ts";

function DashboardInner() {
  const isMobile = useIsMobile();
  const [selectedSiteId, setSelectedSiteId] = useState<Id<"sites"> | null>(null);
  const [globalCreateOpen, setGlobalCreateOpen] = useState(false);
  // Mobile-only: slide-in site list drawer
  const [siteDrawerOpen, setSiteDrawerOpen] = useState(false);

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
      <DashboardNavbar
        onNewLog={() => setGlobalCreateOpen(true)}
        onMenuClick={isMobile ? () => setSiteDrawerOpen(true) : undefined}
      />

      {isMobile ? (
        /* ── Mobile layout ─────────────────────────────────────────────
           No inline sidebar. Tap the hamburger to open the site drawer.
           When a site is selected: full-screen log list with back button.
           When no site is selected: full-screen "start" state.           */
        <main className="flex-1 overflow-hidden">
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
          <main className="flex-1 overflow-hidden">
            {selectedSiteId ? (
              <LogList siteId={selectedSiteId} />
            ) : (
              <DashboardHome
                onNewLog={() => setGlobalCreateOpen(true)}
                onSelectSite={setSelectedSiteId}
              />
            )}
          </main>
        </div>
      )}

      {/* Mobile site drawer */}
      <Sheet open={siteDrawerOpen} onOpenChange={setSiteDrawerOpen}>
        <SheetContent side="left" className="p-0 w-80 flex flex-col">
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
