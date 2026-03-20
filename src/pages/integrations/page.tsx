import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading, useConvexAuth } from "convex/react";
import { hasStoredOidcSession } from "@/lib/offline-session.ts";
import { useSubscription } from "@/hooks/use-subscription.ts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { ArrowLeft, Key, Webhook, BookOpen, Lock } from "lucide-react";
import ApiKeysTab from "./_components/ApiKeysTab.tsx";
import WebhooksTab from "./_components/WebhooksTab.tsx";
import ApiDocsTab from "./_components/ApiDocsTab.tsx";
import { cn } from "@/lib/utils.ts";

function IntegrationsGate({ children }: { children: React.ReactNode }) {
  const { tier, config, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  if (!config.integrations) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-5">
          <Lock className="w-6 h-6 text-amber-500" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Business plan required</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Integrations & API access is available on the Business plan. Upgrade to connect
          GroundWork with your own systems via REST API and webhooks.
        </p>
        <Badge
          variant="secondary"
          className={cn(
            "mb-6 text-xs px-3 py-1",
            tier === "starter"
              ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
              : "bg-muted text-muted-foreground"
          )}
        >
          Current plan: {config.name}
        </Badge>
        <Button onClick={() => window.location.assign("/billing")} className="gap-2">
          Upgrade to Business
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

function IntegrationsInner() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center gap-3 mb-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Integrations & API</h1>
              <p className="text-xs text-muted-foreground">
                Connect GroundWork with your external systems
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
        <IntegrationsGate>
          <Tabs defaultValue="api-keys">
            <TabsList className="mb-6">
              <TabsTrigger value="api-keys" className="gap-2">
                <Key className="w-3.5 h-3.5" />
                API Keys
              </TabsTrigger>
              <TabsTrigger value="webhooks" className="gap-2">
                <Webhook className="w-3.5 h-3.5" />
                Webhooks
              </TabsTrigger>
              <TabsTrigger value="docs" className="gap-2">
                <BookOpen className="w-3.5 h-3.5" />
                API Docs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="api-keys">
              <ApiKeysTab />
            </TabsContent>
            <TabsContent value="webhooks">
              <WebhooksTab />
            </TabsContent>
            <TabsContent value="docs">
              <ApiDocsTab />
            </TabsContent>
          </Tabs>
        </IntegrationsGate>
      </div>
    </div>
  );
}

function IntegrationsSessionGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !hasStoredOidcSession()) {
      window.location.replace("/");
    }
  }, [isAuthenticated, isLoading]);

  return <>{children}</>;
}

export default function IntegrationsPage() {
  if (hasStoredOidcSession()) {
    return (
      <IntegrationsSessionGuard>
        <IntegrationsInner />
      </IntegrationsSessionGuard>
    );
  }

  return (
    <>
      <Unauthenticated>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Sign in to manage integrations</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-12 w-48" />
        </div>
      </AuthLoading>
      <Authenticated>
        <IntegrationsInner />
      </Authenticated>
    </>
  );
}
