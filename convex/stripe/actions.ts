"use node";
// Node.js runtime — all Stripe API interactions for GroundWork.
//
// Replaces convex/paypal/actions.ts. See .claude/plans/ethereal-sprouting-corbato.md
// for the full migration design.

import Stripe from "stripe";
import { action, internalAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { PaidTier, SubscriptionTier } from "../_lib/tiers";
import { TRIAL_DAYS } from "../_lib/trial";

// ── Stripe client ────────────────────────────────────────────────────────────

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "STRIPE_SECRET_KEY not configured. Add it in the Convex Secrets tab.",
    });
  }
  // Pin the Stripe API version so changes upstream don't silently break us.
  // Matches the default in stripe-node v22.x.
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

// ── Pricing constants ────────────────────────────────────────────────────────

// Amounts in minor units (cents). Keep in sync with src/pages/dashboard/_lib/subscription.ts.
const BASE_PRICE_CENTS = { pro: 899, business: 1999 } as const;
const SEAT_PRICE_CENTS = 199;
const MAX_TEAM_SEATS = 50;

// Stripe status values we persist. Mirrors the union in convex/schema.ts.
type StripeStatusLiteral =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused"
  | "cancel_pending";

const KNOWN_STRIPE_STATUSES: ReadonlySet<string> = new Set([
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
]);

function normalizeStripeStatus(raw: string): StripeStatusLiteral {
  if (KNOWN_STRIPE_STATUSES.has(raw)) return raw as StripeStatusLiteral;
  console.warn("Unknown Stripe subscription status — defaulting to incomplete:", raw);
  return "incomplete";
}

function toIsoOrNull(unixSeconds: number | null | undefined): string | null {
  if (unixSeconds == null || Number.isNaN(unixSeconds)) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

// ── initializeStripePrices ───────────────────────────────────────────────────

/**
 * One-time setup: creates the Stripe products and four recurring prices.
 * Idempotent — returns existing IDs if already initialized.
 * Requires super_admin.
 */
export const initializeStripePrices = action({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    productIds: Record<PaidTier, string>;
    priceIds: Record<PaidTier, { base: string; seat: string }>;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    }
    // Only super_admin can initialize prices
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail || (identity.email ?? "").toLowerCase() !== adminEmail.toLowerCase()) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    // Return existing IDs if already initialized
    const existing = await ctx.runQuery(internal.stripe.prices._getAll);
    if (existing.length >= 4) {
      const productIds = { pro: "", business: "" } as Record<PaidTier, string>;
      const priceIds = {
        pro: { base: "", seat: "" },
        business: { base: "", seat: "" },
      } as Record<PaidTier, { base: string; seat: string }>;
      for (const row of existing) {
        priceIds[row.tier][row.kind] = row.priceId;
        productIds[row.tier] = row.productId;
      }
      return { productIds, priceIds };
    }

    const stripe = getStripe();

    const productIds: Record<PaidTier, string> = { pro: "", business: "" };
    const priceIds: Record<PaidTier, { base: string; seat: string }> = {
      pro: { base: "", seat: "" },
      business: { base: "", seat: "" },
    };

    for (const tier of ["pro", "business"] as PaidTier[]) {
      const tierLabel = tier === "pro" ? "Pro" : "Business";
      const product = await stripe.products.create({
        name: `GroundWork ${tierLabel}`,
        description: `GroundWork ${tierLabel} subscription`,
      });
      productIds[tier] = product.id;

      const basePrice = await stripe.prices.create({
        product: product.id,
        unit_amount: BASE_PRICE_CENTS[tier],
        currency: "usd",
        recurring: { interval: "month" },
        nickname: `${tierLabel} base`,
      });
      priceIds[tier].base = basePrice.id;

      const seatPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: SEAT_PRICE_CENTS,
        currency: "usd",
        recurring: { interval: "month" },
        nickname: `${tierLabel} extra seat`,
      });
      priceIds[tier].seat = seatPrice.id;

      await ctx.runMutation(internal.stripe.prices._upsertPrice, {
        tier,
        kind: "base",
        priceId: basePrice.id,
        productId: product.id,
      });
      await ctx.runMutation(internal.stripe.prices._upsertPrice, {
        tier,
        kind: "seat",
        priceId: seatPrice.id,
        productId: product.id,
      });
    }

    return { productIds, priceIds };
  },
});

/**
 * Internal admin recovery tool. Wipes the stripePrices table and recreates
 * fresh products + prices in the live Stripe account associated with this
 * deployment's STRIPE_SECRET_KEY. Use when existing Price IDs become stale
 * (account swap, archived prices, test/live mode swap on the dev deployment).
 *
 * Run via:
 *   npx convex run stripe/actions:_forceReinitializeStripePrices '{}'   # dev
 *   npx convex run --prod stripe/actions:_forceReinitializeStripePrices '{}'  # prod
 *
 * Internal action — not callable from clients, so no auth check needed.
 */
export const _forceReinitializeStripePrices = internalAction({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    deleted: number;
    productIds: Record<PaidTier, string>;
    priceIds: Record<PaidTier, { base: string; seat: string }>;
  }> => {
    const purged: { deleted: number } = await ctx.runMutation(
      internal.stripe.prices._deleteAll,
      {}
    );

    const stripe = getStripe();
    const productIds: Record<PaidTier, string> = { pro: "", business: "" };
    const priceIds: Record<PaidTier, { base: string; seat: string }> = {
      pro: { base: "", seat: "" },
      business: { base: "", seat: "" },
    };

    for (const tier of ["pro", "business"] as PaidTier[]) {
      const tierLabel = tier === "pro" ? "Pro" : "Business";
      const product = await stripe.products.create({
        name: `GroundWork ${tierLabel}`,
        description: `GroundWork ${tierLabel} subscription`,
      });
      productIds[tier] = product.id;

      const basePrice = await stripe.prices.create({
        product: product.id,
        unit_amount: BASE_PRICE_CENTS[tier],
        currency: "usd",
        recurring: { interval: "month" },
        nickname: `${tierLabel} base`,
      });
      priceIds[tier].base = basePrice.id;

      const seatPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: SEAT_PRICE_CENTS,
        currency: "usd",
        recurring: { interval: "month" },
        nickname: `${tierLabel} extra seat`,
      });
      priceIds[tier].seat = seatPrice.id;

      await ctx.runMutation(internal.stripe.prices._upsertPrice, {
        tier,
        kind: "base",
        priceId: basePrice.id,
        productId: product.id,
      });
      await ctx.runMutation(internal.stripe.prices._upsertPrice, {
        tier,
        kind: "seat",
        priceId: seatPrice.id,
        productId: product.id,
      });
    }

    return { deleted: purged.deleted, productIds, priceIds };
  },
});

// ── createCheckoutSession ────────────────────────────────────────────────────

/**
 * Creates a Stripe Checkout Session in subscription mode.
 * Returns the hosted checkout URL for the frontend to redirect to.
 *
 * For teams, maxMembers must match the server-side `pendingTeamSeats` value
 * (set via users.storePendingTeamSeats before calling) to prevent clients from
 * paying for 1 seat while then creating a 50-seat team key.
 */
export const createCheckoutSession = action({
  args: {
    tier: v.union(v.literal("pro"), v.literal("business")),
    isTeam: v.boolean(),
    maxMembers: v.number(),
    returnUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ checkoutUrl: string; sessionId: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    }

    if (args.maxMembers < 1 || args.maxMembers > MAX_TEAM_SEATS) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `maxMembers must be between 1 and ${MAX_TEAM_SEATS}.`,
      });
    }

    const user = await ctx.runQuery(internal.users._getByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    // Anti-tamper: multi-seat teams must have a matching pendingTeamSeats
    // set server-side before the checkout redirect.
    if (args.isTeam && args.maxMembers > 1) {
      const pendingSeats = user.pendingTeamSeats;
      const pendingAt = user.pendingTeamSeatsAt ?? 0;
      const ageMs = Date.now() - pendingAt;
      if (pendingSeats !== args.maxMembers || ageMs > 30 * 60 * 1000) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Team seat count not committed. Please retry.",
        });
      }
    }

    // Look up the base + seat price IDs for this tier
    const basePrice = await ctx.runQuery(
      internal.stripe.prices._getPriceByTierAndKind,
      { tier: args.tier, kind: "base" }
    );
    if (!basePrice) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Stripe prices are not initialized. Click 'Set up Stripe' first.",
      });
    }
    const seatPrice = await ctx.runQuery(
      internal.stripe.prices._getPriceByTierAndKind,
      { tier: args.tier, kind: "seat" }
    );

    const stripe = getStripe();

    // Create or reuse the Stripe Customer for this user
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: user.name ?? undefined,
        metadata: { userId: user._id },
      });
      customerId = customer.id;
      await ctx.runMutation(internal.users._setStripeCustomerId, {
        userId: user._id,
        stripeCustomerId: customerId,
      });
    }

    // Build line items: base (qty 1) + seat (qty maxMembers - 1) for teams
    const lineItems: Array<{ price: string; quantity: number }> = [
      { price: basePrice.priceId, quantity: 1 },
    ];
    if (args.isTeam && args.maxMembers > 1) {
      if (!seatPrice) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Seat price not initialized for this tier.",
        });
      }
      lineItems.push({
        price: seatPrice.priceId,
        quantity: args.maxMembers - 1,
      });
    }

    const metadata = {
      userId: user._id,
      tier: args.tier,
      isTeam: args.isTeam ? "1" : "0",
      maxMembers: String(args.maxMembers),
      purpose: "new_subscription",
    };

    // Eligibility check — one-time 30-day trial per account. Server-side source
    // of truth; UI hints are advisory. Also hard-gated so admin-granted and
    // sandbox users never accidentally consume the flag.
    const trialEligible = await ctx.runQuery(
      internal.users._getTrialEligibility,
      { userId: user._id }
    );

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: lineItems,
      success_url: `${args.returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: args.cancelUrl,
      metadata,
      subscription_data: {
        metadata,
        ...(trialEligible
          ? {
              trial_period_days: TRIAL_DAYS,
              trial_settings: {
                end_behavior: { missing_payment_method: "cancel" },
              },
            }
          : {}),
      },
      // Explicit: collect card upfront even during trial so auto-charge works
      // when trial ends. Also defends against Stripe default drift.
      payment_method_collection: "always",
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: "Stripe did not return a checkout URL.",
      });
    }

    await ctx.runMutation(internal.users._setStripeCheckoutSession, {
      userId: user._id,
      sessionId: session.id,
    });

    return { checkoutUrl: session.url, sessionId: session.id };
  },
});

// ── takeOverSubscription ─────────────────────────────────────────────────────

/**
 * Creates a new Checkout Session for a new team admin who just received
 * admin transfer. Uses the key's current tier and seat count. On return,
 * the frontend calls completePaymentTransferMutation which updates
 * key.stripeSubscriberId to the new admin.
 */
export const takeOverSubscription = action({
  args: {
    keyId: v.id("licenseKeys"),
    returnUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ checkoutUrl: string; sessionId: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    }

    const user = await ctx.runQuery(internal.users._getByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    const key = await ctx.runQuery(internal.licenseKeys._getKeyById, {
      keyId: args.keyId,
    });
    if (!key) {
      throw new ConvexError({ code: "NOT_FOUND", message: "License key not found" });
    }
    const currentAdmin = key.adminUserId ?? key.createdBy;
    if (currentAdmin !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only the new team admin can take over billing.",
      });
    }

    const tier = key.tier as PaidTier;
    const seats = key.maxMembers ?? 1;

    const basePrice = await ctx.runQuery(
      internal.stripe.prices._getPriceByTierAndKind,
      { tier, kind: "base" }
    );
    const seatPrice = await ctx.runQuery(
      internal.stripe.prices._getPriceByTierAndKind,
      { tier, kind: "seat" }
    );
    if (!basePrice || !seatPrice) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Stripe prices not initialized.",
      });
    }

    const stripe = getStripe();

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: user.name ?? undefined,
        metadata: { userId: user._id },
      });
      customerId = customer.id;
      await ctx.runMutation(internal.users._setStripeCustomerId, {
        userId: user._id,
        stripeCustomerId: customerId,
      });
    }

    const lineItems: Array<{ price: string; quantity: number }> = [
      { price: basePrice.priceId, quantity: 1 },
    ];
    if (seats > 1) {
      lineItems.push({ price: seatPrice.priceId, quantity: seats - 1 });
    }

    const metadata = {
      userId: user._id,
      tier,
      isTeam: "1",
      maxMembers: String(seats),
      purpose: "takeover",
      keyId: args.keyId,
    };

    // No trial on admin transfer — this is a continuation of an existing
    // paying team, not a new subscription. The new admin's hasUsedTrial flag
    // is intentionally not consulted here.
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: lineItems,
      success_url: `${args.returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: args.cancelUrl,
      metadata,
      subscription_data: { metadata },
      payment_method_collection: "always",
    });

    if (!session.url) {
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: "Stripe did not return a checkout URL.",
      });
    }

    await ctx.runMutation(internal.users._setStripeCheckoutSession, {
      userId: user._id,
      sessionId: session.id,
    });

    return { checkoutUrl: session.url, sessionId: session.id };
  },
});

// ── syncSubscription ─────────────────────────────────────────────────────────

/**
 * Called from the /stripe/return handler after a user completes (or cancels)
 * Stripe Checkout. Looks up the session, verifies it belongs to the calling
 * user, and writes the resulting tier/status to Convex.
 *
 * The webhook handler does the same work in the background; this action
 * provides fast UI feedback so the user doesn't wait for the webhook.
 */
export const syncSubscription = action({
  args: {
    sessionId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ tier: SubscriptionTier; status: StripeStatusLiteral }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    }
    const user = await ctx.runQuery(internal.users._getByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    const stripe = getStripe();
    let subscription: Stripe.Subscription | null = null;

    if (args.sessionId) {
      const session = await stripe.checkout.sessions.retrieve(args.sessionId, {
        expand: ["subscription"],
      });
      if ((session.metadata?.userId ?? "") !== user._id) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Checkout session does not belong to this user.",
        });
      }
      if (session.subscription && typeof session.subscription !== "string") {
        subscription = session.subscription as Stripe.Subscription;
      } else if (typeof session.subscription === "string") {
        subscription = await stripe.subscriptions.retrieve(session.subscription);
      }
    } else if (args.subscriptionId) {
      subscription = await stripe.subscriptions.retrieve(args.subscriptionId);
      if ((subscription.metadata?.userId ?? "") !== user._id) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Subscription does not belong to this user.",
        });
      }
    } else {
      // No session/subscription ID — look up the customer's latest subscription.
      // Used on native after Stripe Checkout closes in Chrome Custom Tabs, since
      // the session_id never gets back to the app's WebView sessionStorage.
      if (!user.stripeCustomerId) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "No Stripe customer on file for this user.",
        });
      }
      const list = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "all",
        limit: 1,
      });
      subscription = list.data[0] ?? null;
    }

    if (!subscription) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Stripe did not return a subscription for this session.",
      });
    }

    const status = normalizeStripeStatus(subscription.status);
    const isActiveLike = status === "active" || status === "trialing";

    // Resolve tier: price lookup first, then subscription metadata, then
    // user's applied key tier, then current user tier.
    let resolvedTier: SubscriptionTier = user.subscriptionTier ?? "free";
    const firstItem = subscription.items.data[0];
    const firstPriceId = firstItem?.price?.id;
    if (firstPriceId) {
      const priceRow = await ctx.runQuery(internal.stripe.prices._getByPriceId, {
        priceId: firstPriceId,
      });
      if (priceRow) {
        resolvedTier = priceRow.tier;
      }
    }
    if (resolvedTier === "free" || resolvedTier === "starter") {
      const metaTier = subscription.metadata?.tier as PaidTier | undefined;
      if (metaTier === "pro" || metaTier === "business") {
        resolvedTier = metaTier;
      } else if (user.appliedLicenseKeyId) {
        const appliedKey = await ctx.runQuery(
          internal.licenseKeys._getKeyById,
          { keyId: user.appliedLicenseKeyId }
        );
        if (appliedKey?.tier) {
          resolvedTier = appliedKey.tier;
        }
      }
    }

    // Detect that a trial was used: trial_end is non-null if Stripe attached
    // a trial to this subscription, and stays set after the trial converts
    // to active — so this catches the case where the webhook raced past the
    // "trialing" window before we observed it here.
    const usedTrial = subscription.trial_end != null;

    await ctx.runMutation(internal.users._setStripeSubscription, {
      userId: user._id,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: status,
      subscriptionTier: isActiveLike ? resolvedTier : null,
      ...(usedTrial ? { hasUsedTrial: true } : {}),
    });

    return { tier: resolvedTier, status };
  },
});

// ── cancelSubscription ───────────────────────────────────────────────────────

/**
 * Sets cancel_at_period_end=true on the user's Stripe subscription. The user
 * keeps their tier until the current billing cycle ends. The daily cron at
 * 3:17 UTC is a safety net if the customer.subscription.deleted webhook is
 * missed.
 */
export const cancelSubscription = action({
  args: {},
  handler: async (ctx): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    }
    const user = await ctx.runQuery(internal.users._getByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }
    if (!user.stripeSubscriptionId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "No active subscription to cancel.",
      });
    }

    const stripe = getStripe();
    const sub = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // In the 2026-03-25 API version, current_period_end lives on subscription
    // items, not on the subscription itself.
    const periodEnd = sub.items?.data?.[0]?.current_period_end ?? null;
    const cancelEffectiveDate = toIsoOrNull(periodEnd);

    await ctx.runMutation(internal.users._setStripeSubscription, {
      userId: user._id,
      stripeSubscriptionId: sub.id,
      stripeSubscriptionStatus: "cancel_pending",
      subscriptionTier: null, // keep current tier until period end
    });
    await ctx.runMutation(internal.users._setStripeCancelEffectiveDate, {
      userId: user._id,
      date: cancelEffectiveDate ?? "",
    });
  },
});

// ── _adminCancelSubscriptionByEmail (admin tooling) ──────────────────────────

/**
 * Admin tooling: immediately cancels the Stripe subscription on the user
 * identified by email (no proration, ends right now). Used by the launch-day
 * wipe flow before cascade-deleting the Convex user. Idempotent — returns
 * `{canceled:false, reason:"no stripe sub"}` for users without a sub.
 */
export const _adminCancelSubscriptionByEmail = internalAction({
  args: { email: v.string() },
  handler: async (
    ctx,
    args
  ): Promise<{ canceled: boolean; subId?: string; reason?: string }> => {
    const userId: Id<"users"> | null = await ctx.runQuery(
      internal.users._findUserIdByEmail,
      { email: args.email }
    );
    if (!userId) return { canceled: false, reason: "user not found" };
    const user = await ctx.runQuery(internal.users._getUserById, { userId });
    if (!user) return { canceled: false, reason: "user not found" };
    if (!user.stripeSubscriptionId) {
      return { canceled: false, reason: "no stripe sub on user" };
    }
    const stripe = getStripe();
    try {
      const sub = await stripe.subscriptions.cancel(user.stripeSubscriptionId, {
        prorate: false,
      });
      return { canceled: true, subId: sub.id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { canceled: false, reason: `stripe error: ${msg}` };
    }
  },
});

// ── reactivateSubscription ───────────────────────────────────────────────────

/**
 * Undoes a cancel_at_period_end before the billing cycle ends. New feature
 * (PayPal didn't support this cleanly).
 */
export const reactivateSubscription = action({
  args: {},
  handler: async (ctx): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    }
    const user = await ctx.runQuery(internal.users._getByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }
    if (!user.stripeSubscriptionId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "No subscription to reactivate.",
      });
    }

    const stripe = getStripe();
    const sub = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    await ctx.runMutation(internal.users._setStripeSubscription, {
      userId: user._id,
      stripeSubscriptionId: sub.id,
      stripeSubscriptionStatus: normalizeStripeStatus(sub.status),
      subscriptionTier: null,
    });
    await ctx.runMutation(internal.users._setStripeCancelEffectiveDate, {
      userId: user._id,
      date: "",
    });
  },
});

// ── Shared seat-change prep (used by preview + apply actions) ────────────────

/**
 * Authenticates, authorizes, and builds the Stripe `items` diff needed to
 * change a team's seat quantity. Returns everything the caller needs to either
 * preview the charge (via `invoices.createPreview`) or apply it (via
 * `subscriptions.update`), so the two flows can't drift on the items math.
 */
async function _prepareSeatChange(
  ctx: ActionCtx,
  args: { keyId: Id<"licenseKeys">; maxMembers: number }
): Promise<{
  tier: PaidTier;
  subscriptionId: string;
  stripe: Stripe;
  subscription: Stripe.Subscription;
  items: Stripe.SubscriptionUpdateParams.Item[];
}> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
  }
  if (args.maxMembers < 1 || args.maxMembers > MAX_TEAM_SEATS) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `maxMembers must be between 1 and ${MAX_TEAM_SEATS}.`,
    });
  }
  const user = await ctx.runQuery(internal.users._getByToken, {
    tokenIdentifier: identity.tokenIdentifier,
  });
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }

  const key = await ctx.runQuery(internal.licenseKeys._getKeyById, {
    keyId: args.keyId,
  });
  if (!key) {
    throw new ConvexError({ code: "NOT_FOUND", message: "License key not found" });
  }
  const currentAdmin = key.adminUserId ?? key.createdBy;
  if (currentAdmin !== user._id) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Only the team admin can revise billing.",
    });
  }

  const subscriberId = key.stripeSubscriberId ?? key.createdBy;
  const subscriber =
    subscriberId === user._id
      ? user
      : await ctx.runQuery(internal.users._getById, { userId: subscriberId });
  const subscriptionId = subscriber?.stripeSubscriptionId;
  if (!subscriptionId) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "No active subscription to revise.",
    });
  }

  const tier = key.tier as PaidTier;
  const seatPrice = await ctx.runQuery(
    internal.stripe.prices._getPriceByTierAndKind,
    { tier, kind: "seat" }
  );
  if (!seatPrice) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Seat price not initialized for this tier.",
    });
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data"],
  });

  const seatItem = subscription.items.data.find(
    (it) => it.price.id === seatPrice.priceId
  );
  const newSeatQty = args.maxMembers - 1;

  const items: Stripe.SubscriptionUpdateParams.Item[] = [];
  if (seatItem && newSeatQty > 0) {
    items.push({ id: seatItem.id, quantity: newSeatQty });
  } else if (seatItem && newSeatQty === 0) {
    items.push({ id: seatItem.id, deleted: true });
  } else if (!seatItem && newSeatQty > 0) {
    items.push({ price: seatPrice.priceId, quantity: newSeatQty });
  }
  // else: !seatItem && newSeatQty === 0 — nothing to do

  return { tier, subscriptionId, stripe, subscription, items };
}

// ── previewSubscriptionSeats ─────────────────────────────────────────────────

/**
 * Dry-run of `reviseSubscriptionSeats`: asks Stripe what the prorated invoice
 * would look like for the new seat count without actually applying the change.
 * Returns the immediate charge and the next full-cycle total so the UI can
 * show the real dollars before the user confirms.
 */
export const previewSubscriptionSeats = action({
  args: {
    keyId: v.id("licenseKeys"),
    maxMembers: v.number(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    immediateChargeCents: number;
    nextInvoiceTotalCents: number;
    nextInvoiceDate: string | null;
    currency: string;
  }> => {
    const { tier, subscriptionId, stripe, subscription, items } =
      await _prepareSeatChange(ctx, args);

    const periodEndSec = subscription.items.data[0]?.current_period_end ?? null;
    const nextInvoiceDate = toIsoOrNull(periodEndSec);
    const nextInvoiceTotalCents =
      BASE_PRICE_CENTS[tier] + SEAT_PRICE_CENTS * Math.max(0, args.maxMembers - 1);

    // If nothing would actually change, there's no proration to preview.
    if (items.length === 0) {
      return {
        immediateChargeCents: 0,
        nextInvoiceTotalCents,
        nextInvoiceDate,
        currency: subscription.currency,
      };
    }

    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;

    const preview = await stripe.invoices.createPreview({
      customer: customerId,
      subscription: subscriptionId,
      subscription_details: {
        items,
        proration_behavior: "always_invoice",
      },
    });

    return {
      immediateChargeCents: preview.amount_due,
      nextInvoiceTotalCents,
      nextInvoiceDate,
      currency: preview.currency,
    };
  },
});

// ── reviseSubscriptionSeats ──────────────────────────────────────────────────

/**
 * Changes the seat quantity on a team subscription. Stripe applies the change
 * immediately with automatic proration — no redirect, no pending state.
 */
export const reviseSubscriptionSeats = action({
  args: {
    keyId: v.id("licenseKeys"),
    maxMembers: v.number(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ maxMembers: number; applied: true }> => {
    const { subscriptionId, stripe, items } = await _prepareSeatChange(ctx, args);

    if (items.length > 0) {
      await stripe.subscriptions.update(subscriptionId, {
        proration_behavior: "always_invoice",
        items,
      });
    }

    await ctx.runMutation(internal.licenseKeys._setKeyMaxMembers, {
      keyId: args.keyId,
      maxMembers: args.maxMembers,
    });

    return { maxMembers: args.maxMembers, applied: true };
  },
});

// ── _trimExtraSeats ──────────────────────────────────────────────────────────

/**
 * Drops the extra-seat line item on a user's subscription back to zero (base
 * tier only). Used when the last member of a self-created team leaves —
 * the team is dissolved on our side, and the subscriber should stop paying
 * for seats they can't use. Takes a user ID + tier directly (no keyId) so
 * it can be called from mutations that are tearing down the key itself.
 *
 * No-ops if the user has no subscription, no seat price row, or no seat
 * item on the current Stripe sub.
 */
export const _trimExtraSeats = internalAction({
  args: {
    userId: v.id("users"),
    tier: v.union(v.literal("pro"), v.literal("business")),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ trimmed: boolean; reason?: string }> => {
    const user = await ctx.runQuery(internal.users._getById, {
      userId: args.userId,
    });
    if (!user?.stripeSubscriptionId) {
      return { trimmed: false, reason: "no_subscription" };
    }

    const seatPrice = await ctx.runQuery(
      internal.stripe.prices._getPriceByTierAndKind,
      { tier: args.tier, kind: "seat" }
    );
    if (!seatPrice) {
      return { trimmed: false, reason: "no_seat_price" };
    }

    const stripe = getStripe();
    let sub: Stripe.Subscription;
    try {
      sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
        expand: ["items.data"],
      });
    } catch (err) {
      console.warn("_trimExtraSeats: subscription retrieve failed", err);
      return { trimmed: false, reason: "retrieve_failed" };
    }

    const seatItem = sub.items.data.find(
      (it) => it.price.id === seatPrice.priceId
    );
    if (!seatItem) {
      return { trimmed: false, reason: "no_seat_item" };
    }

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      proration_behavior: "always_invoice",
      items: [{ id: seatItem.id, deleted: true }],
    });

    return { trimmed: true };
  },
});

// ── reviseSubscriptionTier ───────────────────────────────────────────────────

/**
 * Upgrades or downgrades a team's tier. Swaps both the base item AND the seat
 * item Price IDs (so line items stay consistent with the new product) and
 * lets Stripe prorate automatically.
 */
export const reviseSubscriptionTier = action({
  args: {
    keyId: v.id("licenseKeys"),
    newTier: v.union(v.literal("pro"), v.literal("business")),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ tier: PaidTier; applied: true }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    }
    const user = await ctx.runQuery(internal.users._getByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    const key = await ctx.runQuery(internal.licenseKeys._getKeyById, {
      keyId: args.keyId,
    });
    if (!key) {
      throw new ConvexError({ code: "NOT_FOUND", message: "License key not found" });
    }
    const currentAdmin = key.adminUserId ?? key.createdBy;
    if (currentAdmin !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only the team admin can revise billing.",
      });
    }

    const subscriberId = key.stripeSubscriberId ?? key.createdBy;
    const subscriber =
      subscriberId === user._id
        ? user
        : await ctx.runQuery(internal.users._getById, { userId: subscriberId });
    const subscriptionId = subscriber?.stripeSubscriptionId;
    if (!subscriptionId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "No active subscription to revise.",
      });
    }

    const newBase = await ctx.runQuery(
      internal.stripe.prices._getPriceByTierAndKind,
      { tier: args.newTier, kind: "base" }
    );
    const newSeat = await ctx.runQuery(
      internal.stripe.prices._getPriceByTierAndKind,
      { tier: args.newTier, kind: "seat" }
    );
    const oldBase = await ctx.runQuery(
      internal.stripe.prices._getPriceByTierAndKind,
      { tier: key.tier, kind: "base" }
    );
    const oldSeat = await ctx.runQuery(
      internal.stripe.prices._getPriceByTierAndKind,
      { tier: key.tier, kind: "seat" }
    );
    if (!newBase || !newSeat || !oldBase || !oldSeat) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Stripe prices not initialized for one of the tiers.",
      });
    }

    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data"],
    });

    const items: Stripe.SubscriptionUpdateParams.Item[] = [];
    for (const it of sub.items.data) {
      if (it.price.id === oldBase.priceId) {
        items.push({ id: it.id, price: newBase.priceId });
      } else if (it.price.id === oldSeat.priceId) {
        items.push({ id: it.id, price: newSeat.priceId });
      }
    }

    if (items.length > 0) {
      // No trial concern here — this swaps price IDs on an existing sub;
      // Stripe only honors trial_period_days at Checkout Session creation.
      await stripe.subscriptions.update(subscriptionId, {
        proration_behavior: "always_invoice",
        items,
      });
    }

    await ctx.runMutation(internal.licenseKeys._setTierForTeam, {
      keyId: args.keyId,
      tier: args.newTier,
    });

    return { tier: args.newTier, applied: true };
  },
});

// ── processWebhook ───────────────────────────────────────────────────────────

/**
 * Verifies Stripe webhook signature, applies idempotency guard, dispatches
 * by event type. Called from the httpAction in convex/http.ts.
 *
 * CRITICAL: body must be the RAW request body text. constructEventAsync uses
 * SubtleCrypto for HMAC which works in both Node and V8 runtimes.
 */
export const processWebhook = internalAction({
  args: {
    body: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      console.error("STRIPE_WEBHOOK_SECRET is not configured — rejecting webhook");
      return;
    }

    const stripe = getStripe();
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        args.body,
        args.signature,
        secret
      );
    } catch (e) {
      console.error("Stripe webhook signature verification failed", e);
      return;
    }

    // Idempotency — bail if we've already processed this event
    const already = await ctx.runQuery(internal.stripe.events._isProcessed, {
      eventId: event.id,
    });
    if (already) {
      console.log("Stripe webhook duplicate:", event.id, event.type);
      return;
    }

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleCheckoutCompleted(
          ctx,
          event.data.object as Stripe.Checkout.Session,
          stripe
        );
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpserted(
          ctx,
          event.data.object as Stripe.Subscription
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          ctx,
          event.data.object as Stripe.Subscription
        );
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(
          ctx,
          event.data.object as Stripe.Invoice,
          stripe
        );
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(
          ctx,
          event.data.object as Stripe.Invoice,
          stripe
        );
        break;

      case "customer.subscription.trial_will_end":
        // Acknowledged so Stripe doesn't log it as unhandled. Fires ~3 days
        // before a trial ends. TODO: wire email notifications once the
        // transactional email pipeline is in place.
        break;

      default:
        console.log("Stripe webhook unhandled event type:", event.type);
    }

    // Only mark as processed AFTER successful handling. If the handler threw,
    // Stripe will retry the event (the httpAction returns 500 on uncaught errors).
    await ctx.runMutation(internal.stripe.events._markProcessed, {
      eventId: event.id,
    });
  },
});

// ── Webhook handlers ─────────────────────────────────────────────────────────

type WebhookCtx = ActionCtx;

async function handleCheckoutCompleted(
  ctx: WebhookCtx,
  session: Stripe.Checkout.Session,
  stripe: Stripe
): Promise<void> {
  if (session.mode !== "subscription") return;
  if (!session.subscription) return;
  const subId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;
  const sub = await stripe.subscriptions.retrieve(subId);
  await handleSubscriptionUpserted(ctx, sub);
}

async function resolveUserFromSubscription(
  ctx: WebhookCtx,
  sub: Stripe.Subscription
): Promise<Id<"users"> | null> {
  const metaUserId = sub.metadata?.userId as Id<"users"> | undefined;
  if (metaUserId) return metaUserId;
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  if (!customerId) return null;
  const user = await ctx.runQuery(internal.users._getByStripeCustomerId, {
    stripeCustomerId: customerId,
  });
  return user?._id ?? null;
}

async function resolveTierFromSubscription(
  ctx: WebhookCtx,
  sub: Stripe.Subscription
): Promise<PaidTier | null> {
  // First pass: base item price lookup
  for (const it of sub.items.data) {
    const priceRow = await ctx.runQuery(internal.stripe.prices._getByPriceId, {
      priceId: it.price.id,
    });
    if (priceRow?.kind === "base") return priceRow.tier;
  }
  // Fallback: metadata
  const metaTier = sub.metadata?.tier;
  if (metaTier === "pro" || metaTier === "business") return metaTier;
  return null;
}

async function handleSubscriptionUpserted(
  ctx: WebhookCtx,
  sub: Stripe.Subscription
): Promise<void> {
  const userId = await resolveUserFromSubscription(ctx, sub);
  if (!userId) {
    console.error("Stripe webhook: could not resolve user for subscription", sub.id);
    return;
  }

  const status = normalizeStripeStatus(sub.status);
  const tier = (await resolveTierFromSubscription(ctx, sub)) as
    | PaidTier
    | null;

  // If Stripe reports "active" but cancel_at_period_end is true, keep our
  // synthetic cancel_pending state.
  const effectiveStatus: StripeStatusLiteral =
    sub.cancel_at_period_end && (status === "active" || status === "trialing")
      ? "cancel_pending"
      : status;

  const isActiveLike =
    effectiveStatus === "active" ||
    effectiveStatus === "trialing" ||
    effectiveStatus === "cancel_pending";

  // Detect trial consumption via trial_end (stays set after trial → active
  // conversion, so even late webhooks record the flag).
  const usedTrial = sub.trial_end != null;

  // State writes: subscription + tier (only if active-like and we resolved one)
  await ctx.runMutation(internal.users._setStripeSubscription, {
    userId,
    stripeSubscriptionId: sub.id,
    stripeSubscriptionStatus: effectiveStatus,
    subscriptionTier: isActiveLike && tier ? tier : null,
    ...(usedTrial ? { hasUsedTrial: true } : {}),
  });

  // cancel_pending: record the effective date so the UI can show a countdown
  if (effectiveStatus === "cancel_pending") {
    const periodEnd = sub.items?.data?.[0]?.current_period_end ?? null;
    await ctx.runMutation(internal.users._setStripeCancelEffectiveDate, {
      userId,
      date: toIsoOrNull(periodEnd) ?? "",
    });
  } else if (effectiveStatus === "active" || effectiveStatus === "trialing") {
    // No longer cancelling — clear the effective date
    await ctx.runMutation(internal.users._setStripeCancelEffectiveDate, {
      userId,
      date: "",
    });
  }

  // Payment-status-driven key state changes
  const selfKey = await ctx.runQuery(
    internal.licenseKeys._getSelfCreatedKeyByAdmin,
    { userId }
  );
  if (selfKey) {
    if (effectiveStatus === "past_due" || effectiveStatus === "unpaid") {
      await ctx.runMutation(internal.licenseKeys._suspendKeyForPaymentFailure, {
        keyId: selfKey._id,
      });
    } else if (
      (effectiveStatus === "active" || effectiveStatus === "trialing") &&
      selfKey.status === "suspended" &&
      selfKey.suspendedReason === "payment_failed"
    ) {
      await ctx.runMutation(internal.licenseKeys._reactivateKey, {
        keyId: selfKey._id,
      });
    }
  }
}

async function handleSubscriptionDeleted(
  ctx: WebhookCtx,
  sub: Stripe.Subscription
): Promise<void> {
  const userId = await resolveUserFromSubscription(ctx, sub);
  if (!userId) return;

  const selfKey = await ctx.runQuery(
    internal.licenseKeys._getSelfCreatedKeyByAdmin,
    { userId }
  );

  if (selfKey?.pendingPaymentTransfer) {
    // New admin hasn't set up payment yet — enter grace period instead of
    // dissolving the team.
    await ctx.runMutation(internal.licenseKeys._suspendKeyForPaymentFailure, {
      keyId: selfKey._id,
    });
    await ctx.runMutation(internal.users._setStripeSubscription, {
      userId,
      stripeSubscriptionId: sub.id,
      stripeSubscriptionStatus: "canceled",
      subscriptionTier: null,
    });
    return;
  }

  // Normal path: full cancellation — downgrade to free, expire the key
  if (selfKey) {
    await ctx.runMutation(internal.licenseKeys._expireKey, {
      keyId: selfKey._id,
    });
  }
  await ctx.runMutation(internal.users._setStripeSubscription, {
    userId,
    stripeSubscriptionId: sub.id,
    stripeSubscriptionStatus: "canceled",
    subscriptionTier: "free",
  });
  await ctx.runMutation(internal.users._setStripeCancelEffectiveDate, {
    userId,
    date: "",
  });
}

/** Extract the subscription ID string from an invoice, handling both string and expanded object forms. */
function extractSubscriptionId(invoice: Stripe.Invoice): string | null {
  const raw = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;
  if (!raw) return null;
  return typeof raw === "string" ? raw : raw.id;
}

async function handleInvoicePaymentFailed(
  ctx: WebhookCtx,
  invoice: Stripe.Invoice,
  stripe: Stripe
): Promise<void> {
  // Only escalate to grace-period suspension if the subscription has actually
  // moved to past_due or unpaid. Stripe retries failed charges automatically
  // during the smart retry window; suspending on the very first failure would
  // be premature.
  const subId = extractSubscriptionId(invoice);
  if (!subId) return;
  const sub = await stripe.subscriptions.retrieve(subId);
  if (sub.status !== "past_due" && sub.status !== "unpaid") return;
  await handleSubscriptionUpserted(ctx, sub);
}

async function handleInvoicePaymentSucceeded(
  ctx: WebhookCtx,
  invoice: Stripe.Invoice,
  stripe: Stripe
): Promise<void> {
  const subId = extractSubscriptionId(invoice);
  if (!subId) return;
  const sub = await stripe.subscriptions.retrieve(subId);
  await handleSubscriptionUpserted(ctx, sub);
}
