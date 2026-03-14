import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
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
  const user = useQuery(api.users.getCurrentUser, {});
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
