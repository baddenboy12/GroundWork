// Subscription tier definitions, limits, and utilities

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
  /** Photo attachments on log entries */
  photoAttachments: boolean;
  /** Storage limit in bytes (0 = no photos) */
  storageLimitBytes: number;
  /** PDF/CSV export */
  export: boolean;
  /** Third-party integrations (API, webhooks) */
  integrations: boolean;
  /** Highlight as recommended */
  highlight?: boolean;
};

export const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  // Internal fallback — not shown as a selectable plan
  free: {
    name: "Free",
    tagline: "No active subscription",
    price: "$0",
    period: "forever",
    maxSites: 2,
    maxLogsPerSite: 10,
    photoAttachments: false,
    storageLimitBytes: 0,
    export: false,
    integrations: false,
  },
  starter: {
    name: "Starter",
    tagline: "Essential logging for small teams",
    price: "$3.99",
    period: "per month",
    maxSites: 5,
    maxLogsPerSite: null,
    photoAttachments: false,
    storageLimitBytes: 50 * 1024 * 1024, // 50 MB
    export: false,
    integrations: false,
  },
  pro: {
    name: "Pro",
    tagline: "Photo-enabled for growing teams",
    price: "$7.99",
    period: "per month",
    maxSites: 15,
    maxLogsPerSite: null,
    photoAttachments: true,
    storageLimitBytes: 250 * 1024 * 1024, // 250 MB
    export: false,
    integrations: false,
    highlight: true,
  },
  business: {
    name: "Business",
    tagline: "Full power with exports & integrations",
    price: "$11.99",
    period: "per month",
    maxSites: null,
    maxLogsPerSite: null,
    photoAttachments: true,
    storageLimitBytes: 3 * 1024 * 1024 * 1024, // 3 GB
    export: true,
    integrations: true,
  },
};

// Only paid plans are shown in the billing UI ("free" is an internal fallback)
export const TIER_ORDER: SubscriptionTier[] = ["starter", "pro", "business"];

/** Returns true if `tier` is at least as high as `minimum` */
export function isAtLeast(
  tier: SubscriptionTier,
  minimum: SubscriptionTier
): boolean {
  const order: SubscriptionTier[] = ["free", "starter", "pro", "business"];
  return order.indexOf(tier) >= order.indexOf(minimum);
}

/** Human-readable label for a tier */
export function tierLabel(tier: SubscriptionTier): string {
  return TIER_CONFIG[tier].name;
}

/** Coerce a raw DB value to a valid SubscriptionTier (defaults to "free") */
export function toTier(raw: string | undefined | null): SubscriptionTier {
  if (raw === "starter" || raw === "pro" || raw === "business") return raw;
  return "free";
}
