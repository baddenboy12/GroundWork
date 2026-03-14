import { useState } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import DashboardNavbar from "./_components/DashboardNavbar.tsx";
import SiteSidebar from "./_components/SiteSidebar.tsx";
import LogList from "./_components/LogList.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { MapPin } from "lucide-react";

function DashboardInner() {
  const [selectedSiteId, setSelectedSiteId] = useState<Id<"sites"> | null>(null);

  return (
    <div className="flex flex-col h-screen bg-background">
      <DashboardNavbar />
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
                  <MapPin />
                </EmptyMedia>
                <EmptyTitle>Select a site</EmptyTitle>
                <EmptyDescription>
                  Choose a site from the sidebar to view its log entries, or create a new site to get started.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </main>
      </div>
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
