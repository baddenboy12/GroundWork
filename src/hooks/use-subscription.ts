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
};

export function useSubscription(): UseSubscriptionResult {
  const rawUser = useQuery(api.users.getCurrentUser, {});
  // Persist the user record offline so the subscription tier survives
  // Convex being unreachable (offline mode). Falls back to the last cached
  // value instead of defaulting to "free".
  const user = useCachedQuery("gw_cache_current_user", rawUser);

  // Still loading only when both live and cache are absent
  const isLoading = user === undefined;
  const tier = toTier(user?.subscriptionTier);
  const config = TIER_CONFIG[tier];

  return {
    tier,
    config,
    isAtLeast: (minimum: SubscriptionTier) => isAtLeast(tier, minimum),
    isLoading,
  };
}
