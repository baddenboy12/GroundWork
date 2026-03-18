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
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
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
  RefreshCw,
  Settings2,
  Trash2,
  Key,
  Users,
  Plus,
  ShieldCheck,
  LogOut,
  Crown,
  ArrowRightLeft,
  UserMinus,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import SubscriptionTypeDialog from "./_components/SubscriptionTypeDialog.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

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
  const myKeyInfo = useQuery(api.licenseKeys.getMyKeyInfo, {});
  const allKeys = useQuery(api.licenseKeys.listAll, {});

  const setTierManual = useMutation(api.users.setSubscriptionTier);
  const createSubscriptionAction = useAction(api.paypal.actions.createSubscription);
  const syncSubscriptionAction = useAction(api.paypal.actions.syncSubscription);
  const cancelSubscriptionAction = useAction(api.paypal.actions.cancelSubscription);
  const initializePlansAction = useAction(api.paypal.actions.initializePayPalPlans);
  const cleanupOrphanedPhotosAction = useAction(api.r2.storageActions.adminCleanupOrphanedPhotos);
  const applyKeyMutation = useMutation(api.licenseKeys.applyKey);
  const removeKeyMutation = useMutation(api.licenseKeys.removeKey);
  const generateKeyMutation = useMutation(api.licenseKeys.generate);
  const updateKeyStatusMutation = useMutation(api.licenseKeys.updateStatus);
  const createSelfKeyMutation = useMutation(api.licenseKeys.createSelfKey);
  const transferAdminMutation = useMutation(api.licenseKeys.transferAdmin);
  const kickMemberMutation = useMutation(api.licenseKeys.kickMember);
  const updateMaxMembersMutation = useMutation(api.licenseKeys.updateMaxMembers);

  const [paypalPending, setPaypalPending] = useState<SubscriptionTier | null>(null);
  const [syncPending, setSyncPending] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [initPending, setInitPending] = useState(false);
  const [cleanupPending, setCleanupPending] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number; checked: number } | null>(null);
  const [switchTarget, setSwitchTarget] = useState<SubscriptionTier | null>(null);
  const [switchPending, setSwitchPending] = useState(false);

  // Subscription type dialog (individual vs team)
  const [subTypeDialogTier, setSubTypeDialogTier] = useState<SubscriptionTier | null>(null);

  // Admin transfer dialog
  const [transferAdminOpen, setTransferAdminOpen] = useState(false);
  const [transferAdminTarget, setTransferAdminTarget] = useState<Id<"users"> | null>(null);
  const [transferAdminPending, setTransferAdminPending] = useState(false);

  // Kick member state
  const [kickTarget, setKickTarget] = useState<{ userId: Id<"users">; name: string } | null>(null);
  const [kickPending, setKickPending] = useState(false);

  // Update max members (seat count)
  const [editSeats, setEditSeats] = useState(false);
  const [newMaxMembers, setNewMaxMembers] = useState(1);
  const [updateSeatsPending, setUpdateSeatsPending] = useState(false);

  // Create team key manually (for users who subscribed as individual and want to add members later)
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [createTeamMembers, setCreateTeamMembers] = useState(1);
  const [createTeamPending, setCreateTeamPending] = useState(false);

  // License key state
  const [keyInput, setKeyInput] = useState("");
  const [keyApplyPending, setKeyApplyPending] = useState(false);
  const [keyRemovePending, setKeyRemovePending] = useState(false);
  const [removeKeyDialogOpen, setRemoveKeyDialogOpen] = useState(false);
  // Admin: generate key
  const [genTier, setGenTier] = useState<"pro" | "business">("business");
  const [genMaxMembers, setGenMaxMembers] = useState("10");
  const [genNote, setGenNote] = useState("");
  const [genPending, setGenPending] = useState(false);
  const [lastGeneratedCode, setLastGeneratedCode] = useState<string | null>(null);

  const navigate = useNavigate();

  const isPayPalConfigured = paypalStatus?.isInitialized ?? false;
  const hasActivePayPalSub =
    user?.paypalSubscriptionStatus === "ACTIVE" ||
    user?.paypalSubscriptionStatus === "APPROVED";

  // Handle return from PayPal approval or cancellation (via /paypal/return)
  useEffect(() => {
    const subscriptionId = sessionStorage.getItem("paypal_pending_subscription_id");
    const paypalCancelled = sessionStorage.getItem("paypal_cancelled");
    const teamMembersStr = sessionStorage.getItem("gw_sub_team_members");

    sessionStorage.removeItem("paypal_pending_subscription_id");
    sessionStorage.removeItem("paypal_cancelled");
    sessionStorage.removeItem("gw_sub_team_members");

    if (paypalCancelled === "1") {
      toast.info("PayPal subscription not completed — no changes made.");
      return;
    }

    if (subscriptionId) {
      setSyncPending(true);
      syncSubscriptionAction({ subscriptionId })
        .then(async ({ tier: newTier }) => {
          const tierName =
            TIER_CONFIG[newTier as SubscriptionTier]?.name ?? newTier;
          toast.success(`Subscribed to ${tierName}! Your plan is now active.`);

          // If the user chose team subscription, auto-create their team key
          if (teamMembersStr) {
            const additionalMembers = parseInt(teamMembersStr, 10);
            if (!isNaN(additionalMembers) && additionalMembers > 0) {
              try {
                const { code } = await createSelfKeyMutation({
                  tier: newTier as "pro" | "business",
                  maxMembers: additionalMembers + 1, // +1 to include the admin
                });
                toast.success(`Team workspace created! Share key ${code} with your team members.`);
              } catch {
                toast.error("Subscription activated but team key creation failed. You can set up your team from the billing page.");
              }
            }
          }
        })
        .catch((err: unknown) => {
          toast.error(extractErrorMessage(err));
        })
        .finally(() => setSyncPending(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePayPalSubscribe = async (newTier: SubscriptionTier, additionalMembers = 0) => {
    if (newTier === "free" || newTier === "starter" || newTier === tier) return;
    setPaypalPending(newTier);
    try {
      // Store team member count in sessionStorage so the callback can create the key
      if (additionalMembers > 0) {
        sessionStorage.setItem("gw_sub_team_members", String(additionalMembers));
      }
      const origin = window.location.origin;
      const { approvalUrl } = await createSubscriptionAction({
        tier: newTier as "pro" | "business",
        returnUrl: `${origin}/paypal/return`,
        cancelUrl: `${origin}/paypal/return?paypal_cancelled=1`,
      });
      window.location.href = approvalUrl;
    } catch (err) {
      toast.error(extractErrorMessage(err));
      sessionStorage.removeItem("gw_sub_team_members");
      setPaypalPending(null);
    }
  };

  // Opens the individual vs team dialog before going to PayPal
  const handleSubscribeClick = (newTier: SubscriptionTier) => {
    if (newTier === "free" || newTier === "starter" || newTier === tier) return;
    setSubTypeDialogTier(newTier);
  };

  const handleSubTypeConfirm = (additionalMembers: number) => {
    if (!subTypeDialogTier) return;
    const t = subTypeDialogTier;
    setSubTypeDialogTier(null);
    void handlePayPalSubscribe(t, additionalMembers);
  };

  const handleTransferAdmin = async () => {
    if (!transferAdminTarget || !myKeyInfo) return;
    setTransferAdminPending(true);
    try {
      await transferAdminMutation({ keyId: myKeyInfo.keyId, newAdminUserId: transferAdminTarget });
      toast.success("Admin role transferred successfully.");
      setTransferAdminOpen(false);
      setTransferAdminTarget(null);
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string } | undefined;
        toast.error(d?.message ?? "Failed to transfer admin");
      } else {
        toast.error("Failed to transfer admin");
      }
    } finally {
      setTransferAdminPending(false);
    }
  };

  const handleKickMember = async () => {
    if (!kickTarget || !myKeyInfo) return;
    setKickPending(true);
    try {
      await kickMemberMutation({ keyId: myKeyInfo.keyId, targetUserId: kickTarget.userId });
      toast.success(`${kickTarget.name} has been removed from the team.`);
      setKickTarget(null);
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string } | undefined;
        toast.error(d?.message ?? "Failed to remove member");
      } else {
        toast.error("Failed to remove member");
      }
    } finally {
      setKickPending(false);
    }
  };

  const handleUpdateSeats = async () => {
    if (!myKeyInfo) return;
    setUpdateSeatsPending(true);
    try {
      await updateMaxMembersMutation({ keyId: myKeyInfo.keyId, maxMembers: newMaxMembers });
      toast.success(`Team capacity updated to ${newMaxMembers} member${newMaxMembers !== 1 ? "s" : ""}.`);
      setEditSeats(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string } | undefined;
        toast.error(d?.message ?? "Failed to update seat count");
      } else {
        toast.error("Failed to update seat count");
      }
    } finally {
      setUpdateSeatsPending(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!user) return;
    setCreateTeamPending(true);
    try {
      const activeTier = (user.subscriptionTier === "pro" || user.subscriptionTier === "business")
        ? user.subscriptionTier
        : null;
      if (!activeTier) {
        toast.error("An active Pro or Business subscription is required to create a team.");
        return;
      }
      const { code } = await createSelfKeyMutation({
        tier: activeTier,
        maxMembers: createTeamMembers + 1,
      });
      toast.success(`Team workspace created! Share this key with your team: ${code}`);
      setCreateTeamOpen(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string } | undefined;
        toast.error(d?.message ?? "Failed to create team");
      } else {
        toast.error("Failed to create team");
      }
    } finally {
      setCreateTeamPending(false);
    }
  };

  const [adminSwitchPending, setAdminSwitchPending] = useState<SubscriptionTier | null>(null);

  const handleAdminSelect = async (newTier: SubscriptionTier) => {
    if (newTier === tier) return;
    setAdminSwitchPending(newTier);
    try {
      await setTierManual({ tier: newTier });
      toast.success(`Switched to ${TIER_CONFIG[newTier].name} plan`);
    } catch {
      toast.error("Failed to update plan");
    } finally {
      setAdminSwitchPending(null);
    }
  };

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

  const handleCleanupOrphanedPhotos = async () => {
    setCleanupPending(true);
    setCleanupResult(null);
    try {
      const result = await cleanupOrphanedPhotosAction();
      setCleanupResult(result);
      if (result.deleted === 0) {
        toast.success(`All ${result.checked} R2 objects are referenced — nothing to clean up.`);
      } else {
        toast.success(`Deleted ${result.deleted} orphaned photo${result.deleted !== 1 ? "s" : ""} from R2.`);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setCleanupPending(false);
    }
  };

  const handleApplyKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;
    setKeyApplyPending(true);
    try {
      const { tier: newTier } = await applyKeyMutation({ code: keyInput.trim() });
      toast.success(`License key applied — you now have ${TIER_CONFIG[newTier as SubscriptionTier]?.name ?? newTier} access!`);
      setKeyInput("");
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string } | undefined;
        toast.error(d?.message ?? "Failed to apply key");
      } else {
        toast.error("Failed to apply key");
      }
    } finally {
      setKeyApplyPending(false);
    }
  };

  const handleRemoveKey = async () => {
    setKeyRemovePending(true);
    try {
      await removeKeyMutation();
      toast.success("License key removed — you have been returned to your individual account.");
      setRemoveKeyDialogOpen(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string } | undefined;
        toast.error(d?.message ?? "Failed to remove key");
      } else {
        toast.error("Failed to remove key");
      }
    } finally {
      setKeyRemovePending(false);
    }
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const max = parseInt(genMaxMembers, 10);
    if (isNaN(max) || max < 1) { toast.error("Max members must be at least 1"); return; }
    setGenPending(true);
    try {
      const { code } = await generateKeyMutation({ tier: genTier, maxMembers: max, note: genNote || undefined });
      setLastGeneratedCode(code);
      toast.success(`Key generated: ${code}`);
      setGenNote("");
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string } | undefined;
        toast.error(d?.message ?? "Failed to generate key");
      } else {
        toast.error("Failed to generate key");
      }
    } finally {
      setGenPending(false);
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

        {/* ── License Key Section ─────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">License Key</h2>
          </div>

          {myKeyInfo ? (
            /* Key is applied — show team info */
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span className="font-mono font-bold text-foreground tracking-widest">
                      {myKeyInfo.code}
                    </span>
                    <Badge
                      className={cn(
                        "text-[10px]",
                        myKeyInfo.status === "active"
                          ? "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      )}
                    >
                      {myKeyInfo.status}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {TIER_CONFIG[myKeyInfo.tier as SubscriptionTier]?.name ?? myKeyInfo.tier}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {myKeyInfo.memberCount} / {myKeyInfo.maxMembers} members
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Transfer admin — only shown to current admin */}
                  {myKeyInfo.isAdmin && myKeyInfo.members.filter(m => !m.isMe).length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground text-xs gap-1.5"
                      onClick={() => setTransferAdminOpen(true)}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      Transfer admin
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive text-xs gap-1.5"
                    onClick={() => setRemoveKeyDialogOpen(true)}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Leave team
                  </Button>
                </div>
              </div>

              {/* Team members list */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Users className="w-3.5 h-3.5" />
                  Team members
                </div>
                <div className="space-y-1.5">
                  {myKeyInfo.members.map((m) => (
                    <div
                      key={String(m.userId)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-background/60 border border-border/50"
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {(m.name?.[0] ?? "?").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate">
                            {m.name}
                          </p>
                          {m.isMe && <span className="text-[10px] text-primary font-normal">(you)</span>}
                          {m.isAdmin && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                              <Crown className="w-2.5 h-2.5" />
                              Admin
                            </span>
                          )}
                        </div>
                        {m.email && (
                          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                        )}
                      </div>
                      {/* Admin kick button — only shown to admin, not for themselves */}
                      {myKeyInfo.isAdmin && !m.isMe && (
                        <button
                          type="button"
                          onClick={() => setKickTarget({ userId: m.userId as Id<"users">, name: m.name })}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                          title={`Remove ${m.name}`}
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Admin: edit seat count */}
                {myKeyInfo.isAdmin && (
                  <div className="pt-1">
                    {editSeats ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Max seats:</span>
                        <button
                          type="button"
                          onClick={() => setNewMaxMembers((n) => Math.max(myKeyInfo.memberCount, n - 1))}
                          className="w-7 h-7 rounded border border-border bg-background flex items-center justify-center text-sm hover:bg-accent"
                        >−</button>
                        <span className="text-sm font-bold w-6 text-center">{newMaxMembers}</span>
                        <button
                          type="button"
                          onClick={() => setNewMaxMembers((n) => Math.min(100, n + 1))}
                          className="w-7 h-7 rounded border border-border bg-background flex items-center justify-center text-sm hover:bg-accent"
                        >+</button>
                        <Button size="sm" onClick={handleUpdateSeats} disabled={updateSeatsPending} className="text-xs h-7 px-2.5 gap-1">
                          {updateSeatsPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditSeats(false)} disabled={updateSeatsPending} className="text-xs h-7 px-2.5">
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setNewMaxMembers(myKeyInfo.maxMembers); setEditSeats(true); }}
                        className="text-xs text-primary hover:underline"
                      >
                        Edit seat limit ({myKeyInfo.memberCount}/{myKeyInfo.maxMembers} used)
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* No key — show input form */
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter a license key to join a team workspace. All members sharing a key will
                have access to the same sites and logs, and the key tier will be applied to
                your account.
              </p>
              <form onSubmit={handleApplyKey} className="flex gap-2">
                <Input
                  placeholder="GW-XXXX-XXXX-XXXX"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                  className="font-mono flex-1"
                  maxLength={15}
                />
                <Button type="submit" disabled={keyApplyPending || !keyInput.trim()}>
                  {keyApplyPending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Apply"
                  )}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground">
                Keys are provided by your team administrator or subscription owner.
              </p>
            </div>
          )}
        </div>

        {/* ── Admin: Generate & manage keys ───────────────────────────── */}
        {isAdmin && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-bold text-foreground">Admin — License Keys</h2>
            </div>

            {/* Generate new key form */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <p className="text-sm font-semibold text-foreground">Generate a new key</p>
              <form onSubmit={handleGenerateKey} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tier</Label>
                    <select
                      value={genTier}
                      onChange={(e) => setGenTier(e.target.value as "pro" | "business")}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="pro">Pro</option>
                      <option value="business">Business</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max members</Label>
                    <Input
                      type="number"
                      min={1}
                      value={genMaxMembers}
                      onChange={(e) => setGenMaxMembers(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Note (optional)</Label>
                  <Input
                    placeholder="e.g. Acme Corp — Business 10-seat"
                    value={genNote}
                    onChange={(e) => setGenNote(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                {lastGeneratedCode && (
                  <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                    <Key className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="font-mono font-bold text-foreground tracking-widest text-sm">
                      {lastGeneratedCode}
                    </span>
                    <button
                      type="button"
                      className="ml-auto text-xs text-primary hover:underline"
                      onClick={() => {
                        void navigator.clipboard.writeText(lastGeneratedCode);
                        toast.success("Copied!");
                      }}
                    >
                      Copy
                    </button>
                  </div>
                )}
                <Button type="submit" size="sm" disabled={genPending} className="gap-1.5">
                  {genPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Generate key
                </Button>
              </form>
            </div>

            {/* All keys table */}
            {allKeys && allKeys.length > 0 && (
              <div className="rounded-2xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Code</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Tier</th>
                      <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs">Members</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Note</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {allKeys.map((k, i) => (
                      <tr key={k._id} className={cn("border-b border-border last:border-0", i % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                        <td className="px-4 py-2.5 font-mono text-xs font-bold text-foreground">{k.code}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground capitalize">{k.tier}</td>
                        <td className="px-3 py-2.5 text-xs text-center text-muted-foreground">{k.memberCount}/{k.maxMembers}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                            k.status === "active" ? "bg-green-500/15 text-green-600 dark:text-green-400" :
                            k.status === "expired" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
                            "bg-red-500/15 text-red-600 dark:text-red-400"
                          )}>
                            {k.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[120px] truncate">{k.note ?? "—"}</td>
                        <td className="px-3 py-2.5">
                          <select
                            value={k.status}
                            onChange={async (e) => {
                              try {
                                await updateKeyStatusMutation({ keyId: k._id, status: e.target.value as "active" | "expired" | "suspended" });
                                toast.success("Key status updated");
                              } catch { toast.error("Failed to update"); }
                            }}
                            className="text-xs rounded border border-input bg-background px-1.5 py-0.5"
                          >
                            <option value="active">Active</option>
                            <option value="expired">Expired</option>
                            <option value="suspended">Suspended</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
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

        {/* R2 orphan cleanup — admin only */}
        {isAdmin && (
          <div className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-semibold text-foreground text-sm">R2 orphan cleanup</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Scans the R2 bucket and removes any photos not attached to a log entry.
                  {cleanupResult && (
                    <span className="ml-1 text-primary font-medium">
                      Last run: checked {cleanupResult.checked}, deleted {cleanupResult.deleted}.
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={cleanupPending}
              onClick={handleCleanupOrphanedPhotos}
              className="shrink-0"
            >
              {cleanupPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Scanning…
                </>
              ) : (
                "Run cleanup"
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
              const isPaid = t === "pro" || t === "business";

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
                    {isPaid && <span className="text-primary font-bold text-lg">*</span>}
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

                  {/* Admin override: instant plan switch without PayPal */}
                  {isAdmin ? (
                    <Button
                      size="sm"
                      className="w-full"
                      variant={isCurrent ? "secondary" : cfg.highlight ? "default" : "secondary"}
                      disabled={isCurrent || adminSwitchPending !== null}
                      onClick={() => handleAdminSelect(t)}
                    >
                      {adminSwitchPending === t ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Switching…
                        </>
                      ) : isCurrent ? (
                        "Current plan"
                      ) : (
                        "Switch to this plan"
                      )}
                    </Button>
                  ) : /* Free tier: no PayPal needed */
                  isFree ? (
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
                          : handleSubscribeClick(t)
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

          {/* Asterisk footnote + "Add Team" prompt for existing individual subscribers */}
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              <span className="text-primary font-bold">*</span> $1.99 per additional team member / month.
              Team workspaces share a single pool of sites and logs across all members.
            </p>
            {/* Prompt for current paid users who don't have a team yet */}
            {!myKeyInfo && (tier === "pro" || tier === "business") && (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <Users className="w-4 h-4 text-primary shrink-0" />
                <p className="text-sm text-muted-foreground flex-1">
                  You are on an individual plan. Want to add team members?
                </p>
                <Button size="sm" variant="secondary" onClick={() => setCreateTeamOpen(true)}>
                  Add Team
                </Button>
              </div>
            )}
          </div>
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

      {/* Leave team confirmation dialog */}
      <Dialog open={removeKeyDialogOpen} onOpenChange={setRemoveKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="w-5 h-5 text-amber-500" />
              Leave team?
            </DialogTitle>
            <DialogDescription>
              Your license key will be removed from your account. You will return to your
              individual account with a free plan. Your personal sites and logs will remain
              intact and are not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveKeyDialogOpen(false)} disabled={keyRemovePending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveKey} disabled={keyRemovePending}>
              {keyRemovePending ? "Leaving…" : "Leave team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <Zap className="w-5 h-5 text-amber-500" />
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

      {/* Kick member confirmation dialog */}
      <Dialog open={!!kickTarget} onOpenChange={(v) => !v && setKickTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserMinus className="w-5 h-5 text-destructive" />
              Remove {kickTarget?.name}?
            </DialogTitle>
            <DialogDescription>
              <strong>{kickTarget?.name}</strong> will be removed from the team immediately.
              Their account will revert to the free plan and their personal sites will be
              unlinked from the team workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setKickTarget(null)} disabled={kickPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleKickMember} disabled={kickPending}>
              {kickPending ? (
                <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Removing…</>
              ) : (
                "Remove member"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Admin dialog */}
      <Dialog open={transferAdminOpen} onOpenChange={setTransferAdminOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              Transfer Admin Role
            </DialogTitle>
            <DialogDescription>
              Select a team member to become the new admin. You will remain a regular member
              after the transfer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {myKeyInfo?.members.filter(m => !m.isMe).map((m) => (
              <button
                key={String(m.userId)}
                type="button"
                onClick={() => setTransferAdminTarget(m.userId as Id<"users">)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left",
                  transferAdminTarget === m.userId
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {(m.name?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                  {m.email && <p className="text-xs text-muted-foreground truncate">{m.email}</p>}
                </div>
                {transferAdminTarget === m.userId && (
                  <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                )}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setTransferAdminOpen(false); setTransferAdminTarget(null); }} disabled={transferAdminPending}>
              Cancel
            </Button>
            <Button onClick={handleTransferAdmin} disabled={!transferAdminTarget || transferAdminPending}>
              {transferAdminPending ? (
                <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Transferring…</>
              ) : (
                "Transfer Admin"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Team dialog (for existing individual subscribers) */}
      <Dialog open={createTeamOpen} onOpenChange={setCreateTeamOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Create Team Workspace
            </DialogTitle>
            <DialogDescription>
              All your current sites and logs will become part of the shared team pool.
              Team members will see and contribute to the same workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Additional members (beyond you)</Label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCreateTeamMembers((n) => Math.max(1, n - 1))}
                  className="w-9 h-9 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-accent transition-colors"
                >
                  −
                </button>
                <span className="text-lg font-bold text-foreground w-8 text-center">{createTeamMembers}</span>
                <button
                  type="button"
                  onClick={() => setCreateTeamMembers((n) => Math.min(50, n + 1))}
                  className="w-9 h-9 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-accent transition-colors"
                >
                  +
                </button>
                <span className="text-xs text-muted-foreground">+${(createTeamMembers * 1.99).toFixed(2)}/mo</span>
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Max total members</span>
                <span>{createTeamMembers + 1} (you + {createTeamMembers})</span>
              </div>
              <p className="text-[11px] pt-1">Additional member fees are billed separately at $1.99/member/month.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateTeamOpen(false)} disabled={createTeamPending}>Cancel</Button>
            <Button onClick={handleCreateTeam} disabled={createTeamPending}>
              {createTeamPending ? (
                <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Creating…</>
              ) : (
                "Create Team"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription type dialog (individual vs team) */}
      {subTypeDialogTier && (
        <SubscriptionTypeDialog
          open={!!subTypeDialogTier}
          onClose={() => setSubTypeDialogTier(null)}
          tier={subTypeDialogTier}
          onConfirm={handleSubTypeConfirm}
          isPending={paypalPending !== null}
        />
      )}
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
