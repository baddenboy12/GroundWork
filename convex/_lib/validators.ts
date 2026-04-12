// Shared Convex validators used across schema and mutations.
import { v } from "convex/values";

/** Stripe subscription status union — used in schema.ts and users.ts */
export const STRIPE_SUBSCRIPTION_STATUS = v.union(
  v.literal("incomplete"),
  v.literal("incomplete_expired"),
  v.literal("trialing"),
  v.literal("active"),
  v.literal("past_due"),
  v.literal("canceled"),
  v.literal("unpaid"),
  v.literal("paused"),
  v.literal("cancel_pending")
);
