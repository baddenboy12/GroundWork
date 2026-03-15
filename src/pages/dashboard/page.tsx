import { useState } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import DashboardNavbar from "./_components/DashboardNavbar.tsx";
import SiteSidebar from "./_components/SiteSidebar.tsx";
import LogList from "./_components/LogList.tsx";
import CreateLogDialog from "./_components/CreateLogDialog.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Plus, ClipboardList } from "lucide-react";

function DashboardInner() {
  const [selectedSiteId, setSelectedSiteId] = useState<Id<"sites"> | null>(null);
  const [globalCreateOpen, setGlobalCreateOpen] = useState(false);

  const handleLogCreated = (siteId: Id<"sites">) => {
    // Auto-navigate to the site that was just logged against
    setSelectedSiteId(siteId);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <DashboardNavbar onNewLog={() => setGlobalCreateOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <SiteSidebar
          selectedSiteId={selectedSiteId}
          onSelectSite={(id) => setSelectedSiteId(id)}
        />
        <main className="flex-1 overflow-hidden">
          {selectedSiteId ? (
            <LogList siteId={selectedSiteId} />
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardList />
                </EmptyMedia>
                <EmptyTitle>Start logging</EmptyTitle>
                <EmptyDescription>
                  Create a log entry and type the site name — it will be created automatically.
                  Or select a site from the sidebar to browse existing entries.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => setGlobalCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" /> New log entry
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </main>
      </div>

      {/* Global create dialog — no site pre-selected */}
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
