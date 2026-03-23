import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useCachedQuery } from "@/hooks/use-cached-query.ts";
import {
  type SubscriptionTier,
  type TierConfig,
  TIER_CONFIG,
  isAtLeast,
  toTier,
} from "@/pages/dashboard/_lib/subscription.ts";

type UseSubscriptionResult = {
  tier: SubscriptionTier;
  config: TierConfig;
  isAtLeast: (minimum: SubscriptionTier) => boolean;
  isLoading: boolean;
  /** True when the team key is suspended due to a failed payment (read-only mode) */
  isPaymentSuspended: boolean;
  /** ISO deadline string when the grace period expires (null if not suspended) */
  graceDeadline: string | null;
  /** Days remaining in the grace period (null if not suspended) */
  graceDaysLeft: number | null;
};

export function useSubscription(): UseSubscriptionResult {
  const rawUser = useQuery(api.users.getCurrentUser, {});
  // Persist the user record offline so the subscription tier survives
  // Convex being unreachable (offline mode). Falls back to the last cached
  // value instead of defaulting to "free".
  const user = useCachedQuery("gw_cache_current_user", rawUser);
  const myKeyInfo = useQuery(api.licenseKeys.getMyKeyInfo, {});

  // Still loading only when both live and cache are absent
  const isLoading = user === undefined;
  const tier = toTier(user?.subscriptionTier);
  const config = TIER_CONFIG[tier];

  const isPaymentSuspended =
    myKeyInfo?.status === "suspended" &&
    myKeyInfo?.suspendedReason === "payment_failed";

  const graceDeadline = isPaymentSuspended ? (myKeyInfo.graceDeadline ?? null) : null;

  let graceDaysLeft: number | null = null;
  if (graceDeadline) {
    graceDaysLeft = Math.max(
      0,
      Math.ceil((new Date(graceDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );
  }

  return {
    tier,
    config,
    isAtLeast: (minimum: SubscriptionTier) => isAtLeast(tier, minimum),
    isLoading,
    isPaymentSuspended,
    graceDeadline,
    graceDaysLeft,
  };
}
