import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import PlanCarousel from "./_components/PlanCarousel.tsx";
import { useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading, useConvexAuth } from "convex/react";
import { hasStoredOidcSession } from "@/lib/offline-session.ts";
import { useQuery, useMutation, useAction, useConvex } from "convex/react";
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
  Minus,
  ShieldCheck,
  LogOut,
  Crown,
  ArrowRightLeft,
  UserMinus,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import SubscriptionTypeDialog from "./_components/SubscriptionTypeDialog.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

// Feature rows shown in the comparison table
const FEATURE_ROWS: { label: string; key: keyof typeof TIER_CONFIG.pro }[] = [
  { label: "Sites", key: "maxSites" },
  { label: "Logs per site", key: "maxLogsPerSite" },
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

function AdminGrantedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
      <ShieldCheck className="w-2.5 h-2.5" />
      Admin granted
    </span>
  );
}

export function BillingInner({ onBack }: { onBack?: () => void } = {}) {
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
  const reviseSubscriptionSeatsAction = useAction(api.paypal.actions.reviseSubscriptionSeats);
  const applyPendingSeatsFromRevisionAction = useAction(api.paypal.actions.applyPendingSeatsFromRevision);
  const reviseSubscriptionTierAction = useAction(api.paypal.actions.reviseSubscriptionTier);
  const applyPendingTierFromRevisionAction = useAction(api.paypal.actions.applyPendingTierFromRevision);
  const cleanupOrphanedPhotosAction = useAction(api.r2.storageActions.adminCleanupOrphanedPhotos);
  const backfillUserMetadataMutation = useMutation(api.users.backfillUserMetadata);
  const applyKeyMutation = useMutation(api.licenseKeys.applyKey);
  const removeKeyMutation = useMutation(api.licenseKeys.removeKey);
  const generateKeyMutation = useMutation(api.licenseKeys.generate);
  const updateKeyStatusMutation = useMutation(api.licenseKeys.updateStatus);
  const createSelfKeyMutation = useMutation(api.licenseKeys.createSelfKey);
  const transferAdminMutation = useMutation(api.licenseKeys.transferAdmin);
  const kickMemberMutation = useMutation(api.licenseKeys.kickMember);
  const changeTierForTeamMutation = useMutation(api.licenseKeys.changeTierForTeam);
  const clearPendingTierMutation = useMutation(api.licenseKeys.clearPendingTier);
  const deleteKeyMutation = useMutation(api.licenseKeys.deleteKey);
  const updateMaxMembersMutation = useMutation(api.licenseKeys.updateMaxMembers);
  const storePendingTeamSeatsMutation = useMutation(api.users.storePendingTeamSeats);

  const convex = useConvex();

  const [paypalPending, setPaypalPending] = useState<SubscriptionTier | null>(null);
  const [syncPending, setSyncPending] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(1); // Pro starts front
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

  // Create team key (for users who subscribed as individual and want to start a team)
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [createTeamPending, setCreateTeamPending] = useState(false);
  const [createTeamSeats, setCreateTeamSeats] = useState(1);

  // Edit seats dialog
  const [editSeatsOpen, setEditSeatsOpen] = useState(false);
  const [editSeatsPending, setEditSeatsPending] = useState(false);
  const [editSeatsValue, setEditSeatsValue] = useState(1);

  // Change team tier dialog
  const [changeTeamTierOpen, setChangeTeamTierOpen] = useState(false);
  const [changeTeamTierPending, setChangeTeamTierPending] = useState(false);

  // Delete key state (admin: remove orphaned 0-member keys)
  const [deleteKeyTarget, setDeleteKeyTarget] = useState<{ keyId: Id<"licenseKeys">; code: string } | null>(null);
  const [deleteKeyPending, setDeleteKeyPending] = useState(false);

  // License key state
  const [keyInput, setKeyInput] = useState("");
  const [keyApplyPending, setKeyApplyPending] = useState(false);
  const [keyRemovePending, setKeyRemovePending] = useState(false);
  const [removeKeyDialogOpen, setRemoveKeyDialogOpen] = useState(false);
  // Admin: generate key
  const [genTier, setGenTier] = useState<"pro" | "business">("business");
  const [genNote, setGenNote] = useState("");
  const [genPending, setGenPending] = useState(false);
  const [lastGeneratedCode, setLastGeneratedCode] = useState<string | null>(null);

  const navigate = useNavigate();

  const isPayPalConfigured = paypalStatus?.isInitialized ?? false;
  const hasActivePayPalSub =
    user?.paypalSubscriptionStatus === "ACTIVE" ||
    user?.paypalSubscriptionStatus === "APPROVED";

  // Is the current user the last member of their team?
  const isLastTeamMember = myKeyInfo?.memberCount === 1;

  // Handle return from PayPal approval or cancellation (via /paypal/return)
  useEffect(() => {
    const subscriptionId = sessionStorage.getItem("paypal_pending_subscription_id");
    const paypalCancelled = sessionStorage.getItem("paypal_cancelled");
    const wantsTeam = sessionStorage.getItem("gw_sub_team");
    // NOTE: gw_sub_seats removed — seat count is now stored server-side via storePendingTeamSeats
    const pendingKeyId = sessionStorage.getItem("gw_pending_key_id");
    // NOTE: gw_pending_seats removed — pending seat count is now in DB via reviseSubscriptionSeats
    const pendingTierKeyId = sessionStorage.getItem("gw_pending_tier_key_id");

    sessionStorage.removeItem("paypal_pending_subscription_id");
    sessionStorage.removeItem("paypal_cancelled");
    sessionStorage.removeItem("gw_sub_team");
    sessionStorage.removeItem("gw_pending_key_id");
    sessionStorage.removeItem("gw_pending_tier_key_id");

    if (paypalCancelled === "1") {
      toast.info("PayPal update not completed — no changes made.");
      return;
    }

    // If user navigated back without approving (no subscriptionId), clear pending tier
    if (pendingTierKeyId && !subscriptionId) {
      // User backed out — clear the pending tier from the DB
      clearPendingTierMutation({
        keyId: pendingTierKeyId as Parameters<typeof clearPendingTierMutation>[0]["keyId"],
      }).catch(() => {});
      return;
    }

    // ── Tier revision return ──────────────────────────────────────────────────
    // Only apply when BOTH pendingTierKeyId AND subscriptionId are present,
    // meaning PayPal redirected back after approval (not browser back button).
    if (pendingTierKeyId && subscriptionId) {
      setSyncPending(true);
      (async () => {
        try {
          // Sync the subscription first if we have a subscriptionId
          if (subscriptionId) {
            await syncSubscriptionAction({ subscriptionId });
          }
          const { tier } = await applyPendingTierFromRevisionAction({
            keyId: pendingTierKeyId as Parameters<typeof applyPendingTierFromRevisionAction>[0]["keyId"],
          });
          if (tier) {
            const tierName = TIER_CONFIG[tier as SubscriptionTier]?.name ?? tier;
            toast.success(`Team tier upgraded to ${tierName} for all members!`);
          } else {
            toast.success("Subscription synced. Tier unchanged.");
          }
        } catch (err) {
          toast.error(extractErrorMessage(err));
        } finally {
          setSyncPending(false);
        }
      })();
      return;
    }

    // ── Seat revision return ──────────────────────────────────────────────────
    // pendingKeyId is just the team key ID (not sensitive — backend verifies admin role).
    // The actual seat count comes from the DB (key.pendingMaxMembers), NOT sessionStorage,
    // so it cannot be manipulated by the user to gain more seats than they paid for.
    if (subscriptionId && pendingKeyId) {
      setSyncPending(true);
      syncSubscriptionAction({ subscriptionId })
        .then(async () => {
          const { maxMembers } = await applyPendingSeatsFromRevisionAction({
            keyId: pendingKeyId as Parameters<typeof applyPendingSeatsFromRevisionAction>[0]["keyId"],
          });
          if (maxMembers !== null) {
            toast.success(`Billing updated — seat limit set to ${maxMembers}.`);
          } else {
            toast.success("Subscription synced. Seat limit unchanged.");
          }
        })
        .catch((err: unknown) => {
          toast.error(extractErrorMessage(err));
        })
        .finally(() => setSyncPending(false));
      return;
    }

    // ── New subscription return ───────────────────────────────────────────────
    if (subscriptionId) {
      setSyncPending(true);
      syncSubscriptionAction({ subscriptionId })
        .then(async ({ tier: newTier }) => {
          const tierName =
            TIER_CONFIG[newTier as SubscriptionTier]?.name ?? newTier;
          toast.success(`Subscribed to ${tierName}! Your plan is now active.`);

          // If the user chose team subscription, auto-create their team key.
          // Seat count is read from the DB (user.pendingTeamSeats stored before
          // PayPal redirect) instead of sessionStorage to prevent tampering.
          if (wantsTeam === "1") {
            try {
              const latestUser = await convex.query(api.users.getCurrentUser, {});
              // Use DB-stored pending seat count — NOT sessionStorage
              const maxMembers = latestUser?.pendingTeamSeats ?? undefined;
              const { code } = await createSelfKeyMutation({
                tier: newTier as "pro" | "business",
                maxMembers: maxMembers && maxMembers > 0 ? maxMembers : undefined,
              });
              const seatsLabel = maxMembers && maxMembers > 1 ? ` (${maxMembers} seats)` : "";
              toast.success(`Team workspace created${seatsLabel}! Share key ${code} with your team members.`);
            } catch {
              toast.error("Subscription activated but team key creation failed. You can set up your team from the billing page.");
            }
          }
        })
        .catch((err: unknown) => {
          toast.error(extractErrorMessage(err));
        })
        .finally(() => setSyncPending(false));
      return;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Landing page sign-up with tier intent ─────────────────────────────────
  // Runs once tier is loaded so we can skip the dialog if user already has the plan.
  const signupTierHandled = useRef(false);
  useEffect(() => {
    if (isLoading || signupTierHandled.current) return;
    const signupTier = sessionStorage.getItem("gw_signup_tier");
    if (!signupTier || (signupTier !== "pro" && signupTier !== "business")) return;
    signupTierHandled.current = true;
    sessionStorage.removeItem("gw_signup_tier");
    // Only prompt if user doesn't already have this tier (or higher)
    const tierRank = { free: 0, starter: 1, pro: 2, business: 3 };
    if ((tierRank[tier] ?? 0) >= (tierRank[signupTier as SubscriptionTier] ?? 0)) return;
    setSubTypeDialogTier(signupTier as SubscriptionTier);
  }, [isLoading, tier]);

  const handlePayPalSubscribe = async (newTier: SubscriptionTier, isTeam: boolean, maxMembers: number) => {
    if (newTier === "free" || newTier === "starter" || newTier === tier) return;
    setPaypalPending(newTier);
    try {
      if (isTeam) {
        // Store team flag in sessionStorage (boolean, not sensitive)
        sessionStorage.setItem("gw_sub_team", "1");
        // Store seat count SERVER-SIDE to prevent client tampering.
        // Previously stored in sessionStorage (gw_sub_seats) which could be manipulated
        // to get more seats than the user paid for after PayPal approval.
        if (maxMembers > 1) {
          await storePendingTeamSeatsMutation({ seats: maxMembers });
        }
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
      sessionStorage.removeItem("gw_sub_team");
      setPaypalPending(null);
    }
  };

  // Opens the individual vs team dialog before going to PayPal
  const handleSubscribeClick = (newTier: SubscriptionTier) => {
    if (newTier === "free" || newTier === "starter" || newTier === tier) return;
    setSubTypeDialogTier(newTier);
  };

  const handleSubTypeConfirm = (isTeam: boolean, maxMembers: number) => {
    if (!subTypeDialogTier) return;
    const t = subTypeDialogTier;
    setSubTypeDialogTier(null);
    void handlePayPalSubscribe(t, isTeam, maxMembers);
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
      toast.error(extractErrorMessage(err));
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

      // Don't auto-reduce seat count — the admin may want to swap in a
      // replacement before the next billing cycle. They can manually reduce
      // seats via "Edit Seats" when they're done. A persistent inline banner
      // in the team section handles the notification (no toast needed).
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setKickPending(false);
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

      const hasPayPalSub =
        user.paypalSubscriptionStatus === "ACTIVE" ||
        user.paypalSubscriptionStatus === "APPROVED";

      if (createTeamSeats > 1 && hasPayPalSub) {
        // Multi-seat team with active PayPal: create team with 1 seat first,
        // then revise the subscription to charge for extra seats via PayPal.
        const { keyId, code } = await createSelfKeyMutation({
          tier: activeTier,
          maxMembers: 1,
        });
        toast.info(`Team created (key: ${code}). Redirecting to PayPal to add ${createTeamSeats - 1} extra seat(s)…`);

        // Use the existing seat revision flow to charge for extra seats
        sessionStorage.setItem("gw_pending_key_id", keyId);
        const origin = window.location.origin;
        const { approvalUrl, applied } = await reviseSubscriptionSeatsAction({
          keyId: keyId as Parameters<typeof reviseSubscriptionSeatsAction>[0]["keyId"],
          maxMembers: createTeamSeats,
          returnUrl: `${origin}/paypal/return`,
          cancelUrl: `${origin}/paypal/return?paypal_cancelled=1`,
        });

        if (applied) {
          // Price decrease or no change — applied immediately
          sessionStorage.removeItem("gw_pending_key_id");
          toast.success(`Team workspace created with ${createTeamSeats} seats!`);
          setCreateTeamOpen(false);
          setCreateTeamSeats(1);
        } else if (approvalUrl) {
          // Redirect to PayPal for approval of the seat charge increase
          window.location.href = approvalUrl;
        }
      } else {
        // Single seat team or no PayPal sub — create directly
        if (createTeamSeats > 1) {
          await storePendingTeamSeatsMutation({ seats: createTeamSeats });
        }
        const { code } = await createSelfKeyMutation({
          tier: activeTier,
          maxMembers: createTeamSeats > 0 ? createTeamSeats : undefined,
        });
        const seatsLabel = createTeamSeats > 1 ? ` (${createTeamSeats} seats)` : "";
        toast.success(`Team workspace created${seatsLabel}! Share this key with your team: ${code}`);
        setCreateTeamOpen(false);
        setCreateTeamSeats(1);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setCreateTeamPending(false);
    }
  };

  const handleEditSeats = async () => {
    if (!myKeyInfo) return;
    setEditSeatsPending(true);
    try {
      const hasPayPalSub =
        user?.paypalSubscriptionStatus === "ACTIVE" ||
        user?.paypalSubscriptionStatus === "APPROVED";

      if (hasPayPalSub) {
        // Store only the keyId in sessionStorage (not the seat count — that is stored
        // server-side by reviseSubscriptionSeats to prevent sessionStorage tampering)
        sessionStorage.setItem("gw_pending_key_id", myKeyInfo.keyId);
        const origin = window.location.origin;
        const { approvalUrl, applied } = await reviseSubscriptionSeatsAction({
          keyId: myKeyInfo.keyId,
          maxMembers: editSeatsValue,
          returnUrl: `${origin}/paypal/return`,
          cancelUrl: `${origin}/paypal/return?paypal_cancelled=1`,
        });

        if (applied) {
          // No approval needed — revision applied immediately (price decrease)
          sessionStorage.removeItem("gw_pending_key_id");
          toast.success(`Seat limit updated to ${editSeatsValue}.`);
          setEditSeatsOpen(false);
        } else if (approvalUrl) {
          // Redirect to PayPal for subscriber approval (price increase).
          // Seat count is stored in DB (key.pendingMaxMembers) by reviseSubscriptionSeats.
          window.location.href = approvalUrl;
        }
      } else {
        // No PayPal subscription — update seat count directly
        await updateMaxMembersMutation({ keyId: myKeyInfo.keyId, maxMembers: editSeatsValue });
        toast.success(`Seat limit updated to ${editSeatsValue}.`);
        setEditSeatsOpen(false);
      }
    } catch (err) {
      sessionStorage.removeItem("gw_pending_key_id");
      toast.error(extractErrorMessage(err));
    } finally {
      setEditSeatsPending(false);
    }
  };

  const handleChangeTeamTier = async (newTier: "pro" | "business") => {
    if (!myKeyInfo) return;
    setChangeTeamTierPending(true);

    // Determine if this is an upgrade on an active PayPal subscription
    const tierRank: Record<string, number> = { free: 0, starter: 0, pro: 1, business: 2 };
    const isUpgrade = (tierRank[newTier] ?? 0) > (tierRank[myKeyInfo.tier] ?? 0);
    const hasPayPalSub =
      user?.paypalSubscriptionStatus === "ACTIVE" ||
      user?.paypalSubscriptionStatus === "APPROVED";
    const needsPayPalRevision = isUpgrade && hasPayPalSub && myKeyInfo.selfCreated;

    try {
      if (needsPayPalRevision) {
        // Go directly to PayPal revision — don't call the mutation first
        sessionStorage.setItem("gw_pending_tier_key_id", myKeyInfo.keyId);
        const { approvalUrl, applied } = await reviseSubscriptionTierAction({
          keyId: myKeyInfo.keyId,
          newTier,
          returnUrl: `${window.location.origin}/paypal/return`,
          cancelUrl: `${window.location.origin}/paypal/return?paypal_cancelled=1`,
        });
        if (applied) {
          sessionStorage.removeItem("gw_pending_tier_key_id");
          toast.success(`Team tier changed to ${TIER_CONFIG[newTier].name} for all members.`);
          setChangeTeamTierOpen(false);
        } else if (approvalUrl) {
          window.location.href = approvalUrl;
          return; // Don't clear pending state — user is leaving the page
        }
      } else {
        // Downgrade or no PayPal sub — apply directly
        await changeTierForTeamMutation({ keyId: myKeyInfo.keyId, tier: newTier });
        toast.success(`Team tier changed to ${TIER_CONFIG[newTier].name} for all members.`);
        setChangeTeamTierOpen(false);
      }
    } catch (err) {
      sessionStorage.removeItem("gw_pending_tier_key_id");
      toast.error(extractErrorMessage(err));
    } finally {
      setChangeTeamTierPending(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!deleteKeyTarget) return;
    setDeleteKeyPending(true);
    try {
      await deleteKeyMutation({ keyId: deleteKeyTarget.keyId });
      toast.success(`Key ${deleteKeyTarget.code} deleted.`);
      setDeleteKeyTarget(null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setDeleteKeyPending(false);
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

  const [backfillPending, setBackfillPending] = useState(false);
  const handleBackfillUserMetadata = async () => {
    setBackfillPending(true);
    try {
      const result = await backfillUserMetadataMutation();
      toast.success(`Backfill complete — updated ${result.updated} user${result.updated !== 1 ? "s" : ""}.`);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setBackfillPending(false);
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
      toast.error(extractErrorMessage(err));
    } finally {
      setKeyApplyPending(false);
    }
  };

  const handleRemoveKey = async () => {
    setKeyRemovePending(true);
    try {
      await removeKeyMutation();
      toast.success(
        isLastTeamMember
          ? "Team workspace dissolved. You have returned to your individual account."
          : "You have left the team and returned to your individual account."
      );
      setRemoveKeyDialogOpen(false);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setKeyRemovePending(false);
    }
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenPending(true);
    try {
      const { code } = await generateKeyMutation({ tier: genTier, note: genNote || undefined });
      setLastGeneratedCode(code);
      toast.success(`Key generated: ${code}`);
      setGenNote("");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setGenPending(false);
    }
  };

  // Tier order for comparison (use index from full order)
  const tierOrder: SubscriptionTier[] = ["free", "pro", "business"];

  return (
    <div className={onBack ? "flex-1 overflow-y-auto" : "min-h-screen bg-background"}>
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4 flex items-center gap-3">
        <button
          onClick={onBack ?? (() => navigate("/dashboard"))}
          className="p-3 w-14 h-14 flex items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:bg-accent active:scale-90 transition-all text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-7 h-7" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Subscription</h1>
          <p className="text-sm text-muted-foreground">Manage your plan</p>
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

      <motion.div
        className="max-w-4xl mx-auto px-6 py-12 space-y-12"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
        }}
      >
        {/* Current plan banner */}
        {!isLoading && (() => {
          const bannerColors = {
            free: { border: "border-zinc-400/50", bg: "rgba(161,161,170,0.15)", bgEnd: "rgba(161,161,170,0.05)", iconBg: "bg-zinc-500/30", iconColor: "text-zinc-200" },
            starter: { border: "border-blue-400/50", bg: "rgba(59,130,246,0.20)", bgEnd: "rgba(59,130,246,0.06)", iconBg: "bg-blue-500/30", iconColor: "text-blue-200" },
            pro: { border: "border-blue-400/50", bg: "rgba(59,130,246,0.20)", bgEnd: "rgba(59,130,246,0.06)", iconBg: "bg-blue-500/30", iconColor: "text-blue-200" },
            business: { border: "border-amber-400/50", bg: "rgba(245,158,11,0.20)", bgEnd: "rgba(245,158,11,0.06)", iconBg: "bg-amber-500/30", iconColor: "text-amber-200" },
          };
          const bc = bannerColors[tier];
          return (
          <motion.div
            className={cn("rounded-2xl border p-5 flex items-center justify-between gap-4 flex-wrap", bc.border)}
            style={{ background: `linear-gradient(135deg, ${bc.bg} 0%, ${bc.bgEnd} 70%, transparent 100%)` }}
            variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
          >
            <div className="flex items-center gap-4">
              <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center", bc.iconBg)}>
                <Crown className={cn("w-8 h-8", bc.iconColor)} />
              </div>
              <div>
                <p className="text-lg text-muted-foreground">Current plan</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-foreground text-2xl">
                    {tier === "free" ? "No active subscription" : TIER_CONFIG[tier].name}
                  </p>
                  {user?.adminGrantedTier ? (
                    <AdminGrantedBadge />
                  ) : (user?.paypalSubscriptionStatus === "ACTIVE" ||
                    user?.paypalSubscriptionStatus === "APPROVED") ? (
                    <PayPalBadge status={user.paypalSubscriptionStatus} />
                  ) : null}
                </div>
              </div>
            </div>
            {hasActivePayPalSub && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground text-base"
                onClick={() => setCancelDialogOpen(true)}
              >
                Cancel subscription
              </Button>
            )}
          </motion.div>
          );
        })()}

        {/* ── License Key / Team Section ─────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Team</h2>
          </div>

          {myKeyInfo ? (
            /* Key is applied — show team info */
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <span className="font-mono font-bold text-foreground tracking-widest text-base">
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
                  <p className="text-sm text-muted-foreground">
                    {myKeyInfo.memberCount} member{myKeyInfo.memberCount !== 1 ? "s" : ""}
                    {myKeyInfo.maxMembers !== null && (
                      <span className="ml-1">
                        / {myKeyInfo.maxMembers} seat{myKeyInfo.maxMembers !== 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Change team tier — only for admin */}
                  {myKeyInfo.isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground text-sm gap-1.5"
                      onClick={() => setChangeTeamTierOpen(true)}
                    >
                      <Settings2 className="w-4 h-4" />
                      Change tier
                    </Button>
                  )}
                  {/* Edit seats — only for admin */}
                  {myKeyInfo.isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground text-sm gap-1.5"
                      onClick={() => {
                        setEditSeatsValue(myKeyInfo.maxMembers ?? myKeyInfo.memberCount);
                        setEditSeatsOpen(true);
                      }}
                    >
                      <Users className="w-4 h-4" />
                      Edit seats
                    </Button>
                  )}
                  {/* Transfer admin — only shown to current admin */}
                  {myKeyInfo.isAdmin && myKeyInfo.members.filter(m => !m.isMe).length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground text-sm gap-1.5"
                      onClick={() => setTransferAdminOpen(true)}
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      Transfer admin
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive text-sm gap-1.5"
                    onClick={() => setRemoveKeyDialogOpen(true)}
                  >
                    <LogOut className="w-4 h-4" />
                    Leave team
                  </Button>
                </div>
              </div>

              {/* Invite members — admin only */}
              {myKeyInfo.isAdmin && (
                <div className="rounded-xl border border-border bg-background/60 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    <Plus className="w-4 h-4" />
                    Invite Members
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Share this key with teammates. They enter it in the Team section to join.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted rounded-md px-3 py-2 font-mono text-base font-bold text-foreground tracking-widest">
                      {myKeyInfo.code}
                    </code>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="shrink-0 gap-1.5 text-xs"
                      onClick={() => {
                        void navigator.clipboard.writeText(myKeyInfo.code);
                        toast.success("Key copied to clipboard!");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}

              {/* Team members list */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  <Users className="w-4 h-4" />
                  Team Members
                </div>
                <div className="space-y-1.5">
                  {myKeyInfo.members.map((m) => (
                    <div
                      key={String(m.userId)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-background/60 border border-border/50"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {(m.name?.[0] ?? "?").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-base font-medium text-foreground truncate">
                            {m.name}
                          </p>
                          {m.isMe && <span className="text-xs text-primary font-normal">(you)</span>}
                          {m.isAdmin && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                              <Crown className="w-3 h-3" />
                              Admin
                            </span>
                          )}
                        </div>
                        {m.email && (
                          <p className="text-sm text-muted-foreground truncate">{m.email}</p>
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
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Persistent open-seat banner — shown when members < maxMembers */}
              {myKeyInfo.isAdmin &&
                myKeyInfo.maxMembers !== null &&
                myKeyInfo.memberCount < myKeyInfo.maxMembers && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-200">
                    You have {myKeyInfo.maxMembers - myKeyInfo.memberCount} open seat{myKeyInfo.maxMembers - myKeyInfo.memberCount !== 1 ? "s" : ""}.
                    {" "}Invite a replacement or use <button type="button" onClick={() => { setEditSeatsValue(myKeyInfo.memberCount); setEditSeatsOpen(true); }} className="underline font-semibold hover:text-amber-100 transition-colors">Edit Seats</button> to
                    reduce your seat count and lower your next bill.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* No key — show input form */
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <p className="text-lg text-muted-foreground">
                Enter a license key to join a team workspace. Team sites are separate
                from your personal sites. The team tier will be applied to your account.
              </p>
              <form onSubmit={handleApplyKey} className="flex gap-3">
                <Input
                  placeholder="GW-XXXX-XXXX-XXXX"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                  className="font-mono flex-1 h-14 !text-[20px] rounded-xl"
                  maxLength={17}
                />
                <Button type="submit" className="text-lg px-6 h-14 rounded-xl" disabled={keyApplyPending || !keyInput.trim()}>
                  {keyApplyPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    "Apply"
                  )}
                </Button>
              </form>
              <p className="text-base text-muted-foreground">
                Keys are provided by your team administrator or subscription owner.
              </p>
            </div>
          )}
        </div>

        {/* ── Admin: Generate & manage keys ───────────────────────────── */}
        {isAdmin && myKeyInfo && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-bold text-foreground">Admin — License Keys</h2>
            </div>

            {/* Generate new key form */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <p className="text-sm font-semibold text-foreground">Generate a new key</p>
              <form onSubmit={handleGenerateKey} className="space-y-3">
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
                  <Label className="text-xs">Note (optional)</Label>
                  <Input
                    placeholder="e.g. Acme Corp — Business team"
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
                        <td className="px-3 py-2.5 text-xs text-center text-muted-foreground">{k.memberCount}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                            k.status === "active" ? "bg-green-500/15 text-green-600 dark:text-green-400" :
                            "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          )}>
                            {k.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[120px] truncate">{k.note ?? "—"}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <select
                              value={k.status}
                              onChange={async (e) => {
                                try {
                                  await updateKeyStatusMutation({ keyId: k._id, status: e.target.value as "active" | "suspended" });
                                  toast.success("Key status updated");
                                } catch { toast.error("Failed to update"); }
                              }}
                              className="text-xs rounded border border-input bg-background px-1.5 py-0.5"
                            >
                              <option value="active">Active</option>
                              <option value="suspended">Suspended</option>
                            </select>
                            {k.memberCount === 0 && (
                              <button
                                type="button"
                                title="Delete orphaned key"
                                onClick={() => setDeleteKeyTarget({ keyId: k._id, code: k.code })}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
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

        {/* Backfill user metadata — admin only */}
        {isAdmin && (
          <div className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-semibold text-foreground text-sm">Backfill user metadata</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Stamps <code>createdAt</code> and <code>role</code> on existing users missing those fields. Run once after upgrading.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={backfillPending}
              onClick={handleBackfillUserMetadata}
              className="shrink-0"
            >
              {backfillPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Running…
                </>
              ) : (
                "Run backfill"
              )}
            </Button>
          </div>
        )}

        {/* Plans grid — hidden while user is on a team (non-super-admins must leave first) */}
        {myKeyInfo && !isAdmin ? (
          <div className="rounded-2xl border border-border bg-card p-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Plan managed by your team</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your subscription tier is set by your team workspace. To manage your own plan
                independently, leave the team first.
              </p>
            </div>
          </div>
        ) : (
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Choose your plan</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            {isPayPalConfigured
              ? "Subscribe securely via PayPal. Cancel any time."
              : "Initialize PayPal above to enable real payment processing."}
          </p>

          <PlanCarousel
            frontIndex={carouselIndex}
            onFrontIndexChange={setCarouselIndex}
            items={TIER_ORDER.map((t) => {
              const cfg = TIER_CONFIG[t];
              const isCurrent = t === tier;
              const isUpgrade =
                tierOrder.indexOf(t) > tierOrder.indexOf(tier);
              const isPendingThis = paypalPending === t;
              const isFree = t === "free";

              const cardTint = {
                free: { border: "border-zinc-500/50", gradient: "linear-gradient(160deg, hsl(240 8% 9%) 0%, hsl(240 5% 7%) 60%, hsl(30 6% 6%) 100%)" },
                pro: { border: "border-blue-500/50", gradient: "linear-gradient(160deg, hsl(220 35% 9%) 0%, hsl(220 20% 7%) 60%, hsl(30 6% 6%) 100%)" },
                business: { border: "border-amber-500/50", gradient: "linear-gradient(160deg, hsl(35 40% 9%) 0%, hsl(35 25% 7%) 60%, hsl(30 6% 6%) 100%)" },
              }[t === "starter" ? "pro" : t]!;

              return (
                <div
                  key={t}
                  className={cn(
                    "relative rounded-2xl border p-4 flex flex-col gap-3 transition-colors",
                    cardTint.border,
                    isCurrent && "ring-2 ring-primary/40"
                  )}
                  style={{ background: cardTint.gradient }}
                >
                  {cfg.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground text-sm px-3 py-1">
                        Most popular
                      </Badge>
                    </div>
                  )}

                  {isCurrent && (
                    <div className="absolute -top-3 right-4">
                      <Badge variant="secondary" className="text-sm px-3 py-1">
                        Current
                      </Badge>
                    </div>
                  )}

                  <div>
                    <p className="font-bold text-foreground text-xl">{cfg.name}</p>
                    <p className="text-lg text-muted-foreground mt-0.5 whitespace-nowrap">{cfg.tagline}</p>
                  </div>

                  <div>
                    <span className="text-4xl font-black text-foreground">{cfg.price}</span>
                    <span className="text-base text-muted-foreground ml-1">{cfg.period}</span>
                  </div>

                  {/* Feature list */}
                  <ul className="space-y-2 flex-1">
                    <li className="flex items-center gap-2 text-lg text-muted-foreground whitespace-nowrap">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      {cfg.maxSites === null
                        ? "Unlimited sites"
                        : `${cfg.maxSites} site${cfg.maxSites > 1 ? "s" : ""}`}
                    </li>
                    <li className="flex items-center gap-2 text-lg text-muted-foreground whitespace-nowrap">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      {cfg.maxLogsPerSite === null
                        ? "Unlimited logs per site"
                        : `${cfg.maxLogsPerSite} log${cfg.maxLogsPerSite > 1 ? "s" : ""} per site`}
                    </li>
                    <li className="flex items-center gap-2 text-lg text-muted-foreground whitespace-nowrap">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      Up to {cfg.maxPhotosPerEntry} photos per entry
                    </li>
                    <li
                      className={cn(
                        "flex items-center gap-2 text-lg whitespace-nowrap",
                        cfg.export ? "text-muted-foreground" : "text-muted-foreground/40"
                      )}
                    >
                      {cfg.export ? (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      ) : (
                        <X className="w-4 h-4 shrink-0" />
                      )}
                      PDF, Excel & CSV export
                    </li>
                    <li
                      className={cn(
                        "flex items-center gap-2 text-lg whitespace-nowrap",
                        cfg.integrations
                          ? "text-muted-foreground"
                          : "text-muted-foreground/40"
                      )}
                    >
                      {cfg.integrations ? (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      ) : (
                        <X className="w-4 h-4 shrink-0" />
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
          />

          {hasActivePayPalSub && (
            <p className="text-sm text-muted-foreground mt-4">
              Switching plans will cancel your current subscription and start a new one via PayPal.
            </p>
          )}

          {/* Prompt for current paid users who don't have a team yet */}
          {!myKeyInfo && (tier === "pro" || tier === "business") && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <Users className="w-5 h-5 text-primary shrink-0" />
              <p className="text-base font-semibold text-muted-foreground flex-1">
                You are on an individual plan. Want to create a team workspace?
              </p>
              <Button variant="secondary" className="text-lg px-6 h-12 rounded-xl" onClick={() => setCreateTeamOpen(true)}>
                Create Team
              </Button>
            </div>
          )}
        </div>
        )}

        {/* Feature comparison table */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-6">Full comparison</h2>
          <div className="rounded-2xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-base w-[40%]">
                    Feature
                  </th>
                  {TIER_ORDER.map((t) => (
                    <th
                      key={t}
                      className={cn(
                        "text-center px-3 py-3 font-semibold text-base whitespace-nowrap",
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
                    <td className="px-4 py-3 text-muted-foreground font-medium text-base leading-snug">
                      {row.label}
                    </td>
                    {TIER_ORDER.map((t) => (
                      <td key={t} className="px-3 py-3 text-center text-foreground text-base">
                        {featureValue(row.key, t)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center text-base text-muted-foreground pb-8">
          Payments are processed securely via PayPal.
          <br />
          Questions? Contact us at{" "}
          <a href="mailto:groundwork@teezfpo.com" className="text-primary hover:underline">
            groundwork@teezfpo.com
          </a>
        </p>
      </motion.div>

      {/* Leave team confirmation dialog */}
      <Dialog open={removeKeyDialogOpen} onOpenChange={setRemoveKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="w-5 h-5 text-amber-500" />
              {isLastTeamMember ? "Dissolve team?" : "Leave team?"}
            </DialogTitle>
            <DialogDescription>
              {isLastTeamMember
                ? "You are the last member of this team. Leaving will permanently dissolve the team workspace. All team sites and their logs will be permanently deleted."
                : "You will leave the team and return to your individual account with a free plan. Team sites you created will remain accessible to other team members. Your personal sites are not affected."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveKeyDialogOpen(false)} disabled={keyRemovePending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveKey} disabled={keyRemovePending}>
              {keyRemovePending ? "Leaving…" : isLastTeamMember ? "Dissolve team" : "Leave team"}
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
              Their account will revert to the free plan.
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

      {/* Change team tier dialog */}
      <Dialog open={changeTeamTierOpen} onOpenChange={setChangeTeamTierOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Change Team Tier
            </DialogTitle>
            <DialogDescription>
              Changing the team tier will immediately update the plan for all{" "}
              <strong>{myKeyInfo?.memberCount ?? 0}</strong> team member{(myKeyInfo?.memberCount ?? 0) !== 1 ? "s" : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {(["pro", "business"] as const).map((t) => {
              const cfg = TIER_CONFIG[t];
              const isCurrent = myKeyInfo?.tier === t;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={isCurrent || changeTeamTierPending}
                  onClick={() => handleChangeTeamTier(t)}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border transition-colors text-left",
                    isCurrent
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{cfg.name}</p>
                    <p className="text-xs text-muted-foreground">{cfg.tagline}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">{cfg.price}/mo</p>
                    {isCurrent && (
                      <span className="text-[10px] text-primary font-medium">current</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChangeTeamTierOpen(false)} disabled={changeTeamTierPending}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Team dialog (for existing individual subscribers) */}
      <Dialog open={createTeamOpen} onOpenChange={(v) => { setCreateTeamOpen(v); if (!v) setCreateTeamSeats(1); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Create Team Workspace
            </DialogTitle>
            <DialogDescription>
              This will create a new team workspace separate from your personal sites.
              You will be the admin and can invite members by sharing your team key.
            </DialogDescription>
          </DialogHeader>

          {/* Seat selector */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">Number of seats</p>
              <p className="text-xs text-muted-foreground">
                How many people (including you) will use this workspace?
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCreateTeamSeats(Math.max(1, createTeamSeats - 1))}
                className="w-8 h-8 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-40"
                disabled={createTeamSeats <= 1}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1 text-center">
                <span className="text-xl font-bold text-foreground">{createTeamSeats}</span>
                <span className="text-xs text-muted-foreground ml-1.5">
                  {createTeamSeats === 1 ? "member" : "members"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCreateTeamSeats(Math.min(50, createTeamSeats + 1))}
                className="w-8 h-8 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-40"
                disabled={createTeamSeats >= 50}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {createTeamSeats > 1 && (
              <p className="text-xs text-muted-foreground">
                {createTeamSeats - 1} extra seat{createTeamSeats > 2 ? "s" : ""} × $1.99 = ${((createTeamSeats - 1) * 1.99).toFixed(2)}/mo additional
              </p>
            )}
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

      {/* Delete orphaned key confirmation dialog */}
      <Dialog open={!!deleteKeyTarget} onOpenChange={(v) => !v && setDeleteKeyTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Delete key {deleteKeyTarget?.code}?
            </DialogTitle>
            <DialogDescription>
              This key has no members and will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteKeyTarget(null)} disabled={deleteKeyPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteKey} disabled={deleteKeyPending}>
              {deleteKeyPending ? (
                <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Deleting…</>
              ) : (
                "Delete key"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Seats dialog */}
      <Dialog open={editSeatsOpen} onOpenChange={setEditSeatsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Edit Team Seats
            </DialogTitle>
            <DialogDescription>
              Set how many members can join your team. Currently{" "}
              <strong>{myKeyInfo?.memberCount ?? 0}</strong> member{(myKeyInfo?.memberCount ?? 0) !== 1 ? "s" : ""} active.
              You cannot reduce below the current member count.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditSeatsValue(Math.max(myKeyInfo?.memberCount ?? 1, editSeatsValue - 1))}
                className="w-8 h-8 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-40"
                disabled={editSeatsValue <= (myKeyInfo?.memberCount ?? 1)}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1 text-center">
                <span className="text-xl font-bold text-foreground">{editSeatsValue}</span>
                <span className="text-xs text-muted-foreground ml-1.5">
                  {editSeatsValue === 1 ? "seat" : "seats"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditSeatsValue(Math.min(50, editSeatsValue + 1))}
                className="w-8 h-8 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-40"
                disabled={editSeatsValue >= 50}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {editSeatsValue > 1 && (
              <p className="text-xs text-muted-foreground">
                {editSeatsValue - 1} extra seat{editSeatsValue > 2 ? "s" : ""} × $1.99 = ${((editSeatsValue - 1) * 1.99).toFixed(2)}/mo additional
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditSeatsOpen(false)} disabled={editSeatsPending}>
              Cancel
            </Button>
            <Button onClick={handleEditSeats} disabled={editSeatsPending}>
              {editSeatsPending ? (
                <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Processing…</>
              ) : hasActivePayPalSub && editSeatsValue !== (myKeyInfo?.maxMembers ?? null) ? (
                <>
                  <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                  Save &amp; approve in PayPal
                </>
              ) : (
                "Save seats"
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

function BillingSessionGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !hasStoredOidcSession()) {
      window.location.replace("/");
    }
  }, [isAuthenticated, isLoading]);

  return <>{children}</>;
}

export default function BillingPage() {
  if (hasStoredOidcSession()) {
    return (
      <BillingSessionGuard>
        <BillingInner />
      </BillingSessionGuard>
    );
  }

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
