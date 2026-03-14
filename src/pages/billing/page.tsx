import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useSubscription } from "@/hooks/use-subscription.ts";
import {
  TIER_ORDER,
  TIER_CONFIG,
  type SubscriptionTier,
} from "../dashboard/_lib/subscription.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";
import {
  Check,
  X,
  ArrowLeft,
  Zap,
  Info,
} from "lucide-react";
import { toast } from "sonner";

// Feature rows shown in the comparison table
const FEATURE_ROWS: { label: string; key: keyof typeof TIER_CONFIG.free }[] = [
  { label: "Sites", key: "maxSites" },
  { label: "Logs per site", key: "maxLogsPerSite" },
  { label: "Photo attachments", key: "photoAttachments" },
  { label: "PDF & CSV export", key: "export" },
  { label: "Integrations & API", key: "integrations" },
];

function featureValue(
  key: keyof typeof TIER_CONFIG.free,
  tier: SubscriptionTier
): React.ReactNode {
  const v = TIER_CONFIG[tier][key];
  if (v === true) return <Check className="w-4 h-4 text-primary mx-auto" />;
  if (v === false) return <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />;
  if (v === null) return <span className="text-primary font-medium">Unlimited</span>;
  return <span className="font-medium">{String(v)}</span>;
}

function BillingInner() {
  const { tier, isLoading } = useSubscription();
  const setTier = useMutation(api.users.setSubscriptionTier);
  const [pending, setPending] = useState<SubscriptionTier | null>(null);
  const navigate = useNavigate();

  const handleSelect = async (newTier: SubscriptionTier) => {
    if (newTier === tier) return;
    setPending(newTier);
    try {
      await setTier({ tier: newTier });
      toast.success(`Switched to ${TIER_CONFIG[newTier].name} plan`);
    } catch {
      toast.error("Failed to update plan");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate("/dashboard")}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-bold text-foreground">Subscription</h1>
          <p className="text-xs text-muted-foreground">Manage your LogVault plan</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">

        {/* Current plan banner */}
        {!isLoading && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current plan</p>
                <p className="font-bold text-foreground text-lg">
                  {TIER_CONFIG[tier].name}
                  {tier === "free" && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      — free forever
                    </span>
                  )}
                </p>
              </div>
            </div>
            {tier !== "free" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground text-xs"
                onClick={() => handleSelect("free")}
                disabled={pending !== null}
              >
                Downgrade to Free
              </Button>
            )}
          </div>
        )}

        {/* Plans grid */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Choose your plan</h2>
          <p className="text-muted-foreground mb-8 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            Payment processing is coming soon — switching plans is free during the preview.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TIER_ORDER.map((t) => {
              const cfg = TIER_CONFIG[t];
              const isCurrent = t === tier;
              const isUpgrade =
                TIER_ORDER.indexOf(t) > TIER_ORDER.indexOf(tier);

              return (
                <div
                  key={t}
                  className={cn(
                    "relative rounded-2xl border p-5 flex flex-col gap-4 transition-colors",
                    cfg.highlight
                      ? "border-primary/60 bg-primary/5"
                      : "border-border bg-card",
                    isCurrent && "ring-2 ring-primary/40"
                  )}
                >
                  {cfg.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5">
                        Most popular
                      </Badge>
                    </div>
                  )}

                  {isCurrent && (
                    <div className="absolute -top-3 right-4">
                      <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                        Current
                      </Badge>
                    </div>
                  )}

                  <div>
                    <p className="font-bold text-foreground text-base">{cfg.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{cfg.tagline}</p>
                  </div>

                  <div>
                    <span className="text-3xl font-black text-foreground">{cfg.price}</span>
                    <span className="text-xs text-muted-foreground ml-1">{cfg.period}</span>
                  </div>

                  {/* Feature list */}
                  <ul className="space-y-1.5 flex-1">
                    <li className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      {cfg.maxSites === null ? "Unlimited sites" : `Up to ${cfg.maxSites} sites`}
                    </li>
                    <li className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      {cfg.maxLogsPerSite === null
                        ? "Unlimited logs/site"
                        : `${cfg.maxLogsPerSite} logs/site`}
                    </li>
                    <li className={cn("flex items-center gap-2 text-xs", cfg.photoAttachments ? "text-muted-foreground" : "text-muted-foreground/40")}>
                      {cfg.photoAttachments
                        ? <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                        : <X className="w-3.5 h-3.5 shrink-0" />}
                      Photo attachments
                    </li>
                    <li className={cn("flex items-center gap-2 text-xs", cfg.export ? "text-muted-foreground" : "text-muted-foreground/40")}>
                      {cfg.export
                        ? <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                        : <X className="w-3.5 h-3.5 shrink-0" />}
                      PDF & CSV export
                    </li>
                    <li className={cn("flex items-center gap-2 text-xs", cfg.integrations ? "text-muted-foreground" : "text-muted-foreground/40")}>
                      {cfg.integrations
                        ? <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                        : <X className="w-3.5 h-3.5 shrink-0" />}
                      {cfg.integrations ? "Integrations & API" : "Integrations (coming soon)"}
                    </li>
                  </ul>

                  <Button
                    size="sm"
                    className="w-full"
                    variant={isCurrent ? "secondary" : cfg.highlight ? "default" : "secondary"}
                    disabled={isCurrent || pending !== null}
                    onClick={() => handleSelect(t)}
                  >
                    {pending === t
                      ? "Updating..."
                      : isCurrent
                      ? "Current plan"
                      : isUpgrade
                      ? `Upgrade to ${cfg.name}`
                      : `Switch to ${cfg.name}`}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Feature comparison table */}
        <div>
          <h2 className="text-xl font-bold text-foreground mb-6">Full comparison</h2>
          <div className="rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-muted-foreground font-medium w-1/3">Feature</th>
                  {TIER_ORDER.map((t) => (
                    <th
                      key={t}
                      className={cn(
                        "text-center px-4 py-3 font-semibold",
                        t === tier ? "text-primary" : "text-foreground"
                      )}
                    >
                      {TIER_CONFIG[t].name}
                      {t === tier && (
                        <span className="block text-[10px] font-normal text-primary/70">current</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map((row, i) => (
                  <tr
                    key={row.key}
                    className={cn(
                      "border-b border-border last:border-0",
                      i % 2 === 0 ? "bg-background" : "bg-muted/20"
                    )}
                  >
                    <td className="px-5 py-3 text-muted-foreground font-medium">{row.label}</td>
                    {TIER_ORDER.map((t) => (
                      <td key={t} className="px-4 py-3 text-center text-foreground">
                        {featureValue(row.key, t)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-8">
          Payment processing is coming soon. Plans can be switched freely during the preview period.
          <br />
          Questions? Contact us at{" "}
          <a href="mailto:hello@logvault.app" className="text-primary hover:underline">
            hello@logvault.app
          </a>
        </p>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <>
      <AuthLoading>
        <div className="flex items-center justify-center h-screen bg-background">
          <Skeleton className="h-10 w-32" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
          <p className="text-muted-foreground">Sign in to manage your subscription</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <Authenticated>
        <BillingInner />
      </Authenticated>
    </>
  );
}
