import { motion } from "motion/react";
import { useSubscription } from "@/hooks/use-subscription.ts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { ArrowLeft, Key, Webhook, BookOpen, Lock } from "lucide-react";
import ApiKeysTab from "@/pages/integrations/_components/ApiKeysTab.tsx";
import WebhooksTab from "@/pages/integrations/_components/WebhooksTab.tsx";
import ApiDocsTab from "@/pages/integrations/_components/ApiDocsTab.tsx";
import { cn } from "@/lib/utils.ts";

type Props = {
  onBack: () => void;
};

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
      </div>
    );
  }

  return <>{children}</>;
}

export default function IntegrationsView({ onBack }: Props) {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Page header */}
      <motion.div
        className="border-b border-border bg-card"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center gap-3 mb-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 shrink-0 rounded-xl active:scale-90 transition-all"
              onClick={onBack}
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Integrations & API</h1>
              <p className="text-sm text-muted-foreground">
                Connect GroundWork with your external systems
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <motion.div
        className="max-w-4xl mx-auto px-4 md:px-6 py-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 25 }}
      >
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
      </motion.div>
    </div>
  );
}
