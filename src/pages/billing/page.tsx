import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useQuery, useMutation, useAction } from "convex/react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { cn } from "@/lib/utils.ts";
import {
  Check,
  X,
  ArrowLeft,
  Zap,
  CreditCard,
  AlertTriangle,
  RefreshCw,
  Settings2,
  HardDrive,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { formatBytes } from "@/lib/utils.ts";

// Feature rows shown in the comparison table
const FEATURE_ROWS: { label: string; key: keyof typeof TIER_CONFIG.free }[] = [
  { label: "Sites", key: "maxSites" },
  { label: "Logs per site", key: "maxLogsPerSite" },
  { label: "Photo attachments", key: "photoAttachments" },
  { label: "Photo storage", key: "storageLimitBytes" },
  { label: "PDF & CSV export", key: "export" },
  { label: "Integrations & API", key: "integrations" },
];

function featureValue(
  key: keyof typeof TIER_CONFIG.free,
  tier: SubscriptionTier
): React.ReactNode {
  const v = TIER_CONFIG[tier][key];
  if (key === "storageLimitBytes") {
    const bytes = v as number;
    if (bytes === 0) return <span className="text-muted-foreground/40 text-xs">—</span>;
    return <span className="font-medium">{formatBytes(bytes)}</span>;
  }
  if (v === true) return <Check className="w-4 h-4 text-primary mx-auto" />;
  if (v === false) return <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />;
  if (v === null) return <span className="text-primary font-medium">Unlimited</span>;
  return <span className="font-medium">{String(v)}</span>;
}

/** Extract a readable error message from a ConvexError or generic Error */
function extractErrorMessage(err: unknown): string {
  if (err instanceof ConvexError) {
    const d = err.data as { message?: string } | undefined;
    return d?.message ?? "An unexpected error occurred.";
  }
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred.";
}

function PayPalBadge({ status }: { status: string }) {
  const isActive = status === "ACTIVE" || status === "APPROVED";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full",
        isActive
          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
          : "bg-muted text-muted-foreground"
      )}
    >
      <CreditCard className="w-2.5 h-2.5" />
      PayPal {isActive ? "Active" : status}
    </span>
  );
}

function BillingInner() {
  const { tier, isLoading } = useSubscription();
  const user = useQuery(api.users.getCurrentUser, {});
  const paypalStatus = useQuery(api.paypal.plans.getPayPalStatus, {});

  const setTierManual = useMutation(api.users.setSubscriptionTier);
  const recalculateStorage = useMutation(api.users.recalculateStorage);
  const createSubscriptionAction = useAction(api.paypal.actions.createSubscription);
  const syncSubscriptionAction = useAction(api.paypal.actions.syncSubscription);
  const cancelSubscriptionAction = useAction(api.paypal.actions.cancelSubscription);
  const initializePlansAction = useAction(api.paypal.actions.initializePayPalPlans);

  const [paypalPending, setPaypalPending] = useState<SubscriptionTier | null>(null);
  const [syncPending, setSyncPending] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [initPending, setInitPending] = useState(false);
  const navigate = useNavigate();

  const isPayPalConfigured = paypalStatus?.isInitialized ?? false;
  const hasActivePayPalSub =
    user?.paypalSubscriptionStatus === "ACTIVE" ||
    user?.paypalSubscriptionStatus === "APPROVED";

  // Recalculate storage on mount to fix any drift from pre-cleanup deletions
  useEffect(() => {
    void recalculateStorage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle return from PayPal approval or cancellation (via /paypal/return)
  useEffect(() => {
    const subscriptionId = sessionStorage.getItem("paypal_pending_subscription_id");
    const paypalCancelled = sessionStorage.getItem("paypal_cancelled");

    // Clear immediately so a page refresh doesn't re-trigger
    sessionStorage.removeItem("paypal_pending_subscription_id");
    sessionStorage.removeItem("paypal_cancelled");

    if (paypalCancelled === "1") {
      toast.info("PayPal subscription not completed — no changes made.");
      return;
    }

    if (subscriptionId) {
      setSyncPending(true);
      syncSubscriptionAction({ subscriptionId })
        .then(({ tier: newTier }) => {
          const tierName =
            TIER_CONFIG[newTier as SubscriptionTier]?.name ?? newTier;
          toast.success(`Subscribed to ${tierName}! Your plan is now active.`);
        })
        .catch((err: unknown) => {
          toast.error(extractErrorMessage(err));
        })
        .finally(() => setSyncPending(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePayPalSubscribe = async (newTier: SubscriptionTier) => {
    if (newTier === "free" || newTier === tier) return;
    setPaypalPending(newTier);
    try {
      const origin = window.location.origin;
      const { approvalUrl } = await createSubscriptionAction({
        tier: newTier as "starter" | "pro" | "business",
        returnUrl: `${origin}/paypal/return`,
        cancelUrl: `${origin}/paypal/return?paypal_cancelled=1`,
      });
      window.location.href = approvalUrl;
    } catch (err) {
      toast.error(extractErrorMessage(err));
      setPaypalPending(null);
    }
  };

  const handleManualSelect = async (newTier: SubscriptionTier) => {
    if (newTier === tier) return;
    try {
      await setTierManual({ tier: newTier });
      toast.success(`Switched to ${TIER_CONFIG[newTier].name} plan`);
    } catch {
      toast.error("Failed to update plan");
    }
  };

  const handleCancelSubscription = async () => {
    setCancelPending(true);
    try {
      await cancelSubscriptionAction();
      toast.success("Subscription cancelled. You've been moved to the Free plan.");
      setCancelDialogOpen(false);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setCancelPending(false);
    }
  };

  const handleInitializePlans = async () => {
    setInitPending(true);
    try {
      const result = await initializePlansAction();
      toast.success(
        `PayPal plans ready! Starter: ${result.planIds.starter ?? "–"}`
      );
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setInitPending(false);
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

      {/* Sync loading overlay */}
      {syncPending && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-4 shadow-xl">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            <p className="font-semibold text-foreground">Verifying subscription…</p>
            <p className="text-sm text-muted-foreground">This may take a few seconds.</p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        {/* Current plan banner */}
        {!isLoading && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current plan</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-foreground text-lg">
                    {TIER_CONFIG[tier].name}
                    {tier === "free" && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        — free forever
                      </span>
                    )}
                  </p>
                  {(user?.paypalSubscriptionStatus === "ACTIVE" ||
                    user?.paypalSubscriptionStatus === "APPROVED") && (
                    <PayPalBadge status={user.paypalSubscriptionStatus} />
                  )}
                </div>
              </div>
            </div>
            {hasActivePayPalSub && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground text-xs"
                onClick={() => setCancelDialogOpen(true)}
              >
                Cancel subscription
              </Button>
            )}
            {!hasActivePayPalSub && tier !== "free" && !isPayPalConfigured && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground text-xs"
                onClick={() => handleManualSelect("free")}
              >
                Downgrade to Free
              </Button>
            )}
          </div>
        )}

        {/* Storage usage */}
        {!isLoading && tier !== "free" && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Photo storage</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatBytes(user?.storageUsedBytes ?? 0)} /{" "}
                {formatBytes(TIER_CONFIG[tier].storageLimitBytes)}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className={cn(
                  "h-2 rounded-full transition-all",
                  (() => {
                    const pct =
                      TIER_CONFIG[tier].storageLimitBytes > 0
                        ? ((user?.storageUsedBytes ?? 0) /
                            TIER_CONFIG[tier].storageLimitBytes) *
                          100
                        : 0;
                    if (pct > 90) return "bg-destructive";
                    if (pct > 70) return "bg-amber-500";
                    return "bg-primary";
                  })()
                )}
                style={{
                  width: `${Math.min(
                    100,
                    TIER_CONFIG[tier].storageLimitBytes > 0
                      ? ((user?.storageUsedBytes ?? 0) /
                          TIER_CONFIG[tier].storageLimitBytes) *
                          100
                      : 0
                  )}%`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Storage used by photo attachments on your account.
            </p>
          </div>
        )}

        {/* PayPal not yet configured — admin setup */}
        {!isPayPalConfigured && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Settings2 className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className="font-semibold text-foreground text-sm">PayPal not yet configured</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Make sure <code className="text-amber-600">PAYPAL_CLIENT_ID</code> and{" "}
                  <code className="text-amber-600">PAYPAL_CLIENT_SECRET</code> are added in the
                  Secrets tab, then click Initialize.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={initPending}
              onClick={handleInitializePlans}
              className="shrink-0"
            >
              {initPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Initializing…
                </>
              ) : (
                "Initialize PayPal"
              )}
            </Button>
          </div>
        )}

        {/* Plans grid */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Choose your plan</h2>
          <p className="text-muted-foreground mb-8 text-sm">
            {isPayPalConfigured
              ? "Subscribe securely via PayPal. Cancel any time."
              : "Initialize PayPal above to enable real payment processing."}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TIER_ORDER.map((t) => {
              const cfg = TIER_CONFIG[t];
              const isCurrent = t === tier;
              const isUpgrade =
                TIER_ORDER.indexOf(t) > TIER_ORDER.indexOf(tier);
              const isPendingThis = paypalPending === t;

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
                      {cfg.maxSites === null
                        ? "Unlimited sites"
                        : `Up to ${cfg.maxSites} sites`}
                    </li>
                    <li className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      {cfg.maxLogsPerSite === null
                        ? "Unlimited logs/site"
                        : `${cfg.maxLogsPerSite} logs/site`}
                    </li>
                    <li className={cn("flex items-center gap-2 text-xs", cfg.photoAttachments ? "text-muted-foreground" : "text-muted-foreground/40")}>
                      {cfg.photoAttachments ? (
                        <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      ) : (
                        <X className="w-3.5 h-3.5 shrink-0" />
                      )}
                      {cfg.storageLimitBytes > 0
                        ? `${formatBytes(cfg.storageLimitBytes)} photo storage`
                        : "Photo attachments"}
                    </li>
                    <li
                      className={cn(
                        "flex items-center gap-2 text-xs",
                        cfg.export ? "text-muted-foreground" : "text-muted-foreground/40"
                      )}
                    >
                      {cfg.export ? (
                        <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      ) : (
                        <X className="w-3.5 h-3.5 shrink-0" />
                      )}
                      PDF & CSV export
                    </li>
                    <li
                      className={cn(
                        "flex items-center gap-2 text-xs",
                        cfg.integrations
                          ? "text-muted-foreground"
                          : "text-muted-foreground/40"
                      )}
                    >
                      {cfg.integrations ? (
                        <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      ) : (
                        <X className="w-3.5 h-3.5 shrink-0" />
                      )}
                      {cfg.integrations
                        ? "Integrations & API"
                        : "Integrations (coming soon)"}
                    </li>
                  </ul>

                  {t === "free" ? (
                    <Button
                      size="sm"
                      className="w-full"
                      variant={isCurrent ? "secondary" : "secondary"}
                      disabled={isCurrent || hasActivePayPalSub}
                      onClick={() => handleManualSelect("free")}
                    >
                      {isCurrent ? "Current plan" : "Downgrade"}
                    </Button>
                  ) : isPayPalConfigured ? (
                    <Button
                      size="sm"
                      className="w-full"
                      variant={
                        isCurrent
                          ? "secondary"
                          : cfg.highlight
                          ? "default"
                          : "secondary"
                      }
                      disabled={
                        isCurrent ||
                        paypalPending !== null ||
                        (hasActivePayPalSub && !isCurrent)
                      }
                      onClick={() => handlePayPalSubscribe(t)}
                    >
                      {isPendingThis ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Redirecting…
                        </>
                      ) : isCurrent ? (
                        "Current plan"
                      ) : isUpgrade ? (
                        <>
                          <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                          Subscribe via PayPal
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                          Switch via PayPal
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      variant={isCurrent ? "secondary" : "secondary"}
                      disabled
                    >
                      PayPal required
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {hasActivePayPalSub && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              To switch plans, cancel your current subscription first then subscribe to the new plan.
            </p>
          )}
        </div>

        {/* Feature comparison table */}
        <div>
          <h2 className="text-xl font-bold text-foreground mb-6">Full comparison</h2>
          <div className="rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-muted-foreground font-medium w-1/3">
                    Feature
                  </th>
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
                        <span className="block text-[10px] font-normal text-primary/70">
                          current
                        </span>
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
                    <td className="px-5 py-3 text-muted-foreground font-medium">
                      {row.label}
                    </td>
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
          Payments are processed securely via PayPal.
          <br />
          Questions? Contact us at{" "}
          <a href="mailto:info@teezfpo.com" className="text-primary hover:underline">
            info@teezfpo.com
          </a>
        </p>
      </div>

      {/* Cancel subscription confirmation dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Cancel subscription?
            </DialogTitle>
            <DialogDescription>
              Your{" "}
              <strong>{TIER_CONFIG[tier].name}</strong> plan will remain active
              until the end of the current billing period, after which you will be
              moved to the Free plan. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelPending}
            >
              Keep plan
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={cancelPending}
            >
              {cancelPending ? "Cancelling…" : "Yes, cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
