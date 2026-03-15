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
  free: {
    name: "Free",
    tagline: "Get started with basic logging",
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
    tagline: "More sites, more storage",
    price: "$9",
    period: "per month",
    maxSites: 15,
    maxLogsPerSite: null,
    photoAttachments: true,
    storageLimitBytes: 100 * 1024 * 1024, // 100 MB
    export: false,
    integrations: false,
  },
  pro: {
    name: "Pro",
    tagline: "Full power for professional teams",
    price: "$29",
    period: "per month",
    maxSites: null,
    maxLogsPerSite: null,
    photoAttachments: true,
    storageLimitBytes: 1 * 1024 * 1024 * 1024, // 1 GB
    export: true,
    integrations: false,
    highlight: true,
  },
  business: {
    name: "Business",
    tagline: "Enterprise-grade with integrations",
    price: "$79",
    period: "per month",
    maxSites: null,
    maxLogsPerSite: null,
    photoAttachments: true,
    storageLimitBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    export: true,
    integrations: true,
  },
};

export const TIER_ORDER: SubscriptionTier[] = [
  "free",
  "starter",
  "pro",
  "business",
];

/** Returns true if `tier` is at least as high as `minimum` */
export function isAtLeast(
  tier: SubscriptionTier,
  minimum: SubscriptionTier
): boolean {
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(minimum);
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
