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
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

// Feature rows shown in the comparison table
const FEATURE_ROWS: { label: string; key: keyof typeof TIER_CONFIG.pro }[] = [
  { label: "Sites", key: "maxSites" },
  { label: "Logs per site", key: "maxLogsPerSite" },
  { label: "Photo attachments", key: "photoAttachments" },
  { label: "Photos per entry", key: "maxPhotosPerEntry" },
  { label: "PDF, Excel & CSV export", key: "export" },
  { label: "Integrations & API", key: "integrations" },
];

function featureValue(
  key: keyof typeof TIER_CONFIG.pro,
  tier: SubscriptionTier
): React.ReactNode {
  const v = TIER_CONFIG[tier][key];
  if (v === true) return <Check className="w-4 h-4 text-primary mx-auto" />;
  if (v === false) return <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />;
  if (v === null) return <span className="text-muted-foreground/40 text-sm">—</span>;
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
  const isAdmin = useQuery(api.users.getIsAdmin, {});

  const setTierManual = useMutation(api.users.setSubscriptionTier);
  const createSubscriptionAction = useAction(api.paypal.actions.createSubscription);
  const syncSubscriptionAction = useAction(api.paypal.actions.syncSubscription);
  const cancelSubscriptionAction = useAction(api.paypal.actions.cancelSubscription);
  const initializePlansAction = useAction(api.paypal.actions.initializePayPalPlans);

  const [paypalPending, setPaypalPending] = useState<SubscriptionTier | null>(null);
  const [syncPending, setSyncPending] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [initPending, setInitPending] = useState(false);
  // "Switch plan" flow: cancel current sub then start new PayPal subscription
  const [switchTarget, setSwitchTarget] = useState<SubscriptionTier | null>(null);
  const [switchPending, setSwitchPending] = useState(false);
  const navigate = useNavigate();

  const isPayPalConfigured = paypalStatus?.isInitialized ?? false;
  const hasActivePayPalSub =
    user?.paypalSubscriptionStatus === "ACTIVE" ||
    user?.paypalSubscriptionStatus === "APPROVED";

  // Handle return from PayPal approval or cancellation (via /paypal/return)
  useEffect(() => {
    const subscriptionId = sessionStorage.getItem("paypal_pending_subscription_id");
    const paypalCancelled = sessionStorage.getItem("paypal_cancelled");

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
    if (newTier === "free" || newTier === "starter" || newTier === tier) return;
    setPaypalPending(newTier);
    try {
      const origin = window.location.origin;
      const { approvalUrl } = await createSubscriptionAction({
        tier: newTier as "pro" | "business",
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

  // Unused but kept for potential admin use
  void handleManualSelect;

  const handleCancelSubscription = async () => {
    setCancelPending(true);
    try {
      await cancelSubscriptionAction();
      toast.success("Subscription cancelled successfully.");
      setCancelDialogOpen(false);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setCancelPending(false);
    }
  };

  const handleSwitchPlan = async () => {
    if (!switchTarget) return;
    setSwitchPending(true);
    try {
      await cancelSubscriptionAction();
      const origin = window.location.origin;
      const { approvalUrl } = await createSubscriptionAction({
        tier: switchTarget as "pro" | "business",
        returnUrl: `${origin}/paypal/return`,
        cancelUrl: `${origin}/paypal/return?paypal_cancelled=1`,
      });
      window.location.href = approvalUrl;
    } catch (err) {
      toast.error(extractErrorMessage(err));
      setSwitchPending(false);
      setSwitchTarget(null);
    }
  };

  const handleInitializePlans = async () => {
    setInitPending(true);
    try {
      const result = await initializePlansAction();
      toast.success(
        `PayPal plans ready! Pro: ${result.planIds.pro ?? "–"}`
      );
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setInitPending(false);
    }
  };

  // Tier order for comparison (use index from full order)
  const tierOrder: SubscriptionTier[] = ["free", "pro", "business"];

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
          <p className="text-xs text-muted-foreground">Manage your plan</p>
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

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
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
                    {tier === "free" ? "No active subscription" : TIER_CONFIG[tier].name}
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
          </div>
        )}

        {/* PayPal setup panel — admin only */}
        {isAdmin && (
          <div className={`rounded-2xl border p-5 flex items-center justify-between gap-4 flex-wrap ${
            isPayPalConfigured
              ? "border-border bg-card"
              : "border-amber-500/30 bg-amber-500/5"
          }`}>
            <div className="flex items-center gap-3">
              <Settings2 className={`w-5 h-5 shrink-0 ${isPayPalConfigured ? "text-muted-foreground" : "text-amber-500"}`} />
              <div>
                <p className="font-semibold text-foreground text-sm">
                  {isPayPalConfigured ? "PayPal plans configured" : "PayPal not yet configured"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isPayPalConfigured
                    ? "Re-initialize if you have switched to new PayPal credentials (e.g. sandbox → live)."
                    : <>Make sure <code className="text-amber-600">PAYPAL_CLIENT_ID</code> and{" "}
                      <code className="text-amber-600">PAYPAL_CLIENT_SECRET</code> are added in the
                      Secrets tab, then click Initialize.</>}
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
              ) : isPayPalConfigured ? (
                "Re-initialize PayPal"
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {TIER_ORDER.map((t) => {
              const cfg = TIER_CONFIG[t];
              const isCurrent = t === tier;
              const isUpgrade =
                tierOrder.indexOf(t) > tierOrder.indexOf(tier);
              const isPendingThis = paypalPending === t;
              const isFree = t === "free";

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
                        : `${cfg.maxSites} site${cfg.maxSites > 1 ? "s" : ""}`}
                    </li>
                    <li className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      {cfg.maxLogsPerSite === null
                        ? "Unlimited logs per site"
                        : `${cfg.maxLogsPerSite} log${cfg.maxLogsPerSite > 1 ? "s" : ""} per site`}
                    </li>
                    <li className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      Up to {cfg.maxPhotosPerEntry} photos per entry
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
                      PDF, Excel & CSV export
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
                      Integrations & API
                    </li>
                  </ul>

                  {/* Free tier: no PayPal needed */}
                  {isFree ? (
                    <Button
                      size="sm"
                      className="w-full"
                      variant="secondary"
                      disabled={isCurrent || !hasActivePayPalSub}
                      onClick={() => setCancelDialogOpen(true)}
                    >
                      {isCurrent ? "Current plan" : "Downgrade to Free"}
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
                      disabled={isCurrent || paypalPending !== null || switchPending}
                      onClick={() =>
                        hasActivePayPalSub && !isCurrent
                          ? setSwitchTarget(t)
                          : handlePayPalSubscribe(t)
                      }
                    >
                      {isPendingThis ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Redirecting…
                        </>
                      ) : isCurrent ? (
                        "Current plan"
                      ) : hasActivePayPalSub ? (
                        <>
                          <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                          Switch to this plan
                        </>
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
                      variant="secondary"
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
            <p className="text-xs text-muted-foreground mt-4">
              Switching plans will cancel your current subscription and start a new one via PayPal.
            </p>
          )}
        </div>

        {/* Feature comparison table */}
        <div>
          <h2 className="text-xl font-bold text-foreground mb-6">Full comparison</h2>
          <div className="rounded-2xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-sm w-[40%]">
                    Feature
                  </th>
                  {TIER_ORDER.map((t) => (
                    <th
                      key={t}
                      className={cn(
                        "text-center px-3 py-3 font-semibold text-sm whitespace-nowrap",
                        t === tier ? "text-primary" : "text-foreground"
                      )}
                    >
                      {TIER_CONFIG[t].name}
                      {t === tier && (
                        <span className="block text-xs font-normal text-primary/70 leading-tight">
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
                    <td className="px-4 py-3 text-muted-foreground font-medium text-sm leading-snug">
                      {row.label}
                    </td>
                    {TIER_ORDER.map((t) => (
                      <td key={t} className="px-3 py-3 text-center text-foreground text-sm">
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

      {/* Switch plan confirmation dialog */}
      <Dialog open={!!switchTarget} onOpenChange={(v) => !v && setSwitchTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Switch to {switchTarget ? TIER_CONFIG[switchTarget].name : ""} plan?
            </DialogTitle>
            <DialogDescription>
              Your current <strong>{TIER_CONFIG[tier].name}</strong> subscription will be
              cancelled and you will be redirected to PayPal to start a new{" "}
              <strong>{switchTarget ? TIER_CONFIG[switchTarget].name : ""}</strong> subscription.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setSwitchTarget(null)}
              disabled={switchPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSwitchPlan} disabled={switchPending}>
              {switchPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Processing…
                </>
              ) : (
                "Continue to PayPal"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              until the end of the current billing period, after which your subscription
              will end and access will be limited. This action cannot be undone.
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
