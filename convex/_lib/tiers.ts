// Canonical tier type definitions shared across the Convex backend.
// The frontend has its own copy at src/pages/dashboard/_lib/subscription.ts
// (different tsconfig — can't share directly).

export type PaidTier = "pro" | "business";
export type SubscriptionTier = "free" | "starter" | PaidTier;
