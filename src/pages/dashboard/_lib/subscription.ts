// Subscription tier definitions, limits, and utilities

// "starter" kept as a valid type for backward DB compatibility but treated as "pro" in toTier()
export type SubscriptionTier = "free" | "starter" | "pro" | "business";

export type TierConfig = {
  name: string;
  tagline: string;
  price: string;
  period: string;
  /** Max number of sites (null = unlimited) */
  maxSites: number | null;
  /** Max logs per site (null = unlimited) */
  maxLogsPerSite: number | null;
  /** Max photos per log entry */
  maxPhotosPerEntry: number;
  /** PDF/CSV export */
  export: boolean;
  /** Third-party integrations (API, webhooks) */
  integrations: boolean;
  /** Highlight as recommended */
  highlight?: boolean;
};

export const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  // Free tier — shown as a selectable plan
  free: {
    name: "Free",
    tagline: "Try it out at no cost",
    price: "$0",
    period: "forever",
    maxSites: 1,
    maxLogsPerSite: 1,
    maxPhotosPerEntry: 5,
    export: false,
    integrations: false,
  },
  // Kept for backward compat only — treated as "pro" by toTier()
  starter: {
    name: "Pro",
    tagline: "No logging limit for growing teams",
    price: "$8.99",
    period: "per month",
    maxSites: 15,
    maxLogsPerSite: null,
    maxPhotosPerEntry: 5,
    export: false,
    integrations: false,
    highlight: true,
  },
  pro: {
    name: "Pro",
    tagline: "No logging limit for growing teams",
    price: "$8.99",
    period: "per month",
    maxSites: 15,
    maxLogsPerSite: null,
    maxPhotosPerEntry: 5,
    export: false,
    integrations: false,
    highlight: true,
  },
  business: {
    name: "Business",
    tagline: "Full power with exports & integrations",
    price: "$19.99",
    period: "per month",
    maxSites: null,
    maxLogsPerSite: null,
    maxPhotosPerEntry: 20,
    export: true,
    integrations: true,
  },
};

// All tiers shown in billing UI (starter is hidden – treated as pro)
export const TIER_ORDER: SubscriptionTier[] = ["free", "pro", "business"];

/** Returns true if `tier` is at least as high as `minimum` */
export function isAtLeast(
  tier: SubscriptionTier,
  minimum: SubscriptionTier
): boolean {
  const order: SubscriptionTier[] = ["free", "pro", "business"];
  const normalizedTier = tier === "starter" ? "pro" : tier;
  return order.indexOf(normalizedTier) >= order.indexOf(minimum);
}

/** Human-readable label for a tier */
export function tierLabel(tier: SubscriptionTier): string {
  return TIER_CONFIG[tier].name;
}

/** Coerce a raw DB value to a valid SubscriptionTier.
 *  "starter" is remapped to "pro" since the plan no longer exists. */
export function toTier(raw: string | undefined | null): SubscriptionTier {
  if (raw === "starter") return "pro"; // legacy → upgrade silently
  if (raw === "pro" || raw === "business") return raw;
  return "free";
}
