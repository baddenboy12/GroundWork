"use node";
// Node.js runtime — all PayPal API interactions

import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel.d.ts";

// ── PayPal API helpers ────────────────────────────────────────────────────────

function getBaseUrl(): string {
  return process.env.PAYPAL_ENVIRONMENT === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message:
        "PayPal credentials not configured. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in the Secrets tab.",
    });
  }
  const credentials = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${getBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new ConvexError({
      code: "EXTERNAL_SERVICE_ERROR",
      message: `PayPal auth failed: ${txt}`,
    });
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

const PLAN_CONFIG = {
  pro: { name: "Pro", price: "8.99" },
  business: { name: "Business", price: "19.99" },
} as const;

type PaidTier = keyof typeof PLAN_CONFIG;
type SubscriptionTier = "free" | PaidTier;

const EXTRA_SEAT_PRICE = 1.99;

/** Calculates the total monthly price string given a tier and seat count */
function calcTotalPrice(tier: "pro" | "business", maxMembers: number): string {
  const base = tier === "pro" ? 8.99 : 19.99;
  const total = base + Math.max(0, maxMembers - 1) * EXTRA_SEAT_PRICE;
  return total.toFixed(2);
}

// ── Public actions ────────────────────────────────────────────────────────────

/**
 * One-time setup: creates the PayPal product and three subscription plans.
 * Safe to call multiple times — returns existing plan IDs if already set up.
 */
export const initializePayPalPlans = action({
  args: {},
  handler: async (
    ctx
  ): Promise<{ productId: string; planIds: Record<string, string> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    }

    // Return existing plan IDs if already initialized
    const existing = await ctx.runQuery(internal.paypal.plans._getAllPlans);
    if (existing.length === 2) {
      const planIds: Record<string, string> = {};
      let productId = "";
      for (const p of existing) {
        planIds[p.tier] = p.planId;
        productId = p.productId;
      }
      return { productId, planIds };
    }

    const token = await getToken();
    const base = getBaseUrl();

    // Create product
    const productRes = await fetch(`${base}/v1/catalogs/products`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `groundwork-product-${Date.now()}`,
      },
      body: JSON.stringify({
        name: "GroundWork",
        description: "GroundWork site logging management service",
        type: "SERVICE",
        category: "SOFTWARE",
      }),
    });
    const product = (await productRes.json()) as { id: string };
    const productId = product.id;

    const planIds: Record<string, string> = {};
    for (const tier of ["pro", "business"] as PaidTier[]) {
      const { name, price } = PLAN_CONFIG[tier];
      const planRes = await fetch(`${base}/v1/billing/plans`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": `groundwork-plan-${tier}-${Date.now()}`,
        },
        body: JSON.stringify({
          product_id: productId,
          name: `GroundWork ${name}`,
          description: `GroundWork ${name} – monthly subscription`,
          status: "ACTIVE",
          billing_cycles: [
            {
              frequency: { interval_unit: "MONTH", interval_count: 1 },
              tenure_type: "REGULAR",
              sequence: 1,
              total_cycles: 0,
              pricing_scheme: {
                fixed_price: { value: price, currency_code: "USD" },
              },
            },
          ],
          payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee_failure_action: "CONTINUE",
            payment_failure_threshold: 3,
          },
        }),
      });
      const planData = (await planRes.json()) as { id: string };
      planIds[tier] = planData.id;

      await ctx.runMutation(internal.paypal.plans._upsertPlan, {
        tier,
        planId: planData.id,
        productId,
      });
    }

    return { productId, planIds };
  },
});

/**
 * Creates a PayPal subscription for the given tier.
 * Returns the PayPal approval URL to redirect the user to.
 */
export const createSubscription = action({
  args: {
    tier: v.union(
      v.literal("pro"),
      v.literal("business")
    ),
    returnUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ approvalUrl: string; subscriptionId: string }> => {
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

    const plan = await ctx.runQuery(internal.paypal.plans._getPlanByTier, {
      tier: args.tier,
    });
    if (!plan) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message:
          "PayPal plans are not initialized. Click 'Set up PayPal' first.",
      });
    }

    const token = await getToken();
    const base = getBaseUrl();

    // If the user has pending team seats > 1, create a custom plan with
    // seat-adjusted pricing instead of using the stock plan
    const pendingSeats = user.pendingTeamSeats ?? 0;
    let planIdToUse = plan.planId;

    if (pendingSeats > 1) {
      const totalPrice = calcTotalPrice(args.tier, pendingSeats);
      const tierLabel = args.tier === "pro" ? "Pro" : "Business";
      const seatLabel = `${pendingSeats} seat${pendingSeats !== 1 ? "s" : ""}`;

      const existingPlans = await ctx.runQuery(internal.paypal.plans._getAllPlans);
      const productId = existingPlans[0]?.productId;
      if (!productId) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "PayPal plans not initialized.",
        });
      }

      const planRes = await fetch(`${base}/v1/billing/plans`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": `gw-plan-${args.tier}-${pendingSeats}seats-new-${Date.now()}`,
        },
        body: JSON.stringify({
          product_id: productId,
          name: `GroundWork ${tierLabel} — ${seatLabel}`,
          description: `GroundWork ${tierLabel} team subscription with ${seatLabel}`,
          status: "ACTIVE",
          billing_cycles: [
            {
              frequency: { interval_unit: "MONTH", interval_count: 1 },
              tenure_type: "REGULAR",
              sequence: 1,
              total_cycles: 0,
              pricing_scheme: {
                fixed_price: { value: totalPrice, currency_code: "USD" },
              },
            },
          ],
          payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee_failure_action: "CONTINUE",
            payment_failure_threshold: 3,
          },
        }),
      });

      if (!planRes.ok) {
        const txt = await planRes.text();
        throw new ConvexError({
          code: "EXTERNAL_SERVICE_ERROR",
          message: `Failed to create seat-adjusted PayPal plan: ${txt}`,
        });
      }
      const newPlan = (await planRes.json()) as { id: string };
      planIdToUse = newPlan.id;
    }

    const subRes = await fetch(`${base}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `groundwork-sub-${user._id}-${Date.now()}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        plan_id: planIdToUse,
        // Store user's Convex ID and intended tier so syncSubscription can
        // determine the tier even when a custom seat-adjusted plan is used
        custom_id: `${user._id}:${args.tier}`,
        subscriber: {
          name: {
            given_name: user.name?.split(" ")[0] ?? "GroundWork",
            surname: user.name?.split(" ").slice(1).join(" ") || "User",
          },
          ...(user.email ? { email_address: user.email } : {}),
        },
        application_context: {
          brand_name: "GroundWork",
          locale: "en-US",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          payment_method: {
            payer_selected: "PAYPAL",
            payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
          },
          return_url: args.returnUrl,
          cancel_url: args.cancelUrl,
        },
      }),
    });

    const sub = (await subRes.json()) as {
      id: string;
      links: Array<{ href: string; rel: string }>;
    };

    const approvalLink = sub.links?.find((l) => l.rel === "approve");
    if (!approvalLink) {
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: "Could not get PayPal approval URL. Check your PayPal credentials.",
      });
    }

    // Track pending subscription on the user
    await ctx.runMutation(internal.users._setPaypalSubscription, {
      userId: user._id,
      paypalSubscriptionId: sub.id,
      paypalSubscriptionStatus: "APPROVAL_PENDING",
      subscriptionTier: null,
    });

    return { approvalUrl: approvalLink.href, subscriptionId: sub.id };
  },
});

/**
 * Called after the user returns from PayPal approval.
 * Verifies the subscription status and updates the user's tier.
 */
export const syncSubscription = action({
  args: { subscriptionId: v.string() },
  handler: async (
    ctx,
    args
  ): Promise<{ tier: SubscriptionTier; status: string }> => {
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

    const token = await getToken();
    const base = getBaseUrl();

    const res = await fetch(
      `${base}/v1/billing/subscriptions/${args.subscriptionId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: "Failed to verify subscription with PayPal.",
      });
    }

    const sub = (await res.json()) as {
      id: string;
      status: string;
      plan_id: string;
      custom_id: string;
    };

    // Security: verify this subscription belongs to this user.
    // custom_id may be "userId" (legacy) or "userId:tier" (new format with embedded tier)
    const customParts = (sub.custom_id ?? "").split(":");
    const customUserId = customParts[0];
    const embeddedTier = customParts[1] as SubscriptionTier | undefined;

    if (customUserId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Subscription does not belong to this user.",
      });
    }

    const plan = await ctx.runQuery(internal.paypal.plans._getPlanByPlanId, {
      planId: sub.plan_id,
    });

    const isActive = sub.status === "ACTIVE" || sub.status === "APPROVED";

    // Determine the correct tier. Priority:
    // 1. Known plan in the plans table (stock plans)
    // 2. If user owns a team key, use the key's tier (source of truth after revisions,
    //    since custom_id still has the original tier and can't be updated)
    // 3. Embedded tier in custom_id (for initial subscription before key creation)
    // 4. User's existing tier
    let resolvedTier: SubscriptionTier = "free";
    if (isActive) {
      if (plan?.tier) {
        resolvedTier = plan.tier as SubscriptionTier;
      } else if (user.appliedLicenseKeyId) {
        const appliedKey = await ctx.runQuery(internal.licenseKeys._getKeyById, {
          keyId: user.appliedLicenseKeyId,
        });
        resolvedTier = (appliedKey?.tier ?? embeddedTier ?? user.subscriptionTier ?? "free") as SubscriptionTier;
      } else {
        resolvedTier = (embeddedTier ?? user.subscriptionTier ?? "free") as SubscriptionTier;
      }
    }
    const tier = resolvedTier;

    await ctx.runMutation(internal.users._setPaypalSubscription, {
      userId: user._id,
      paypalSubscriptionId: sub.id,
      paypalSubscriptionStatus: sub.status,
      subscriptionTier: isActive ? tier : "free",
    });

    return { tier, status: sub.status };
  },
});

/**
 * Cancels the current user's active PayPal subscription and downgrades to Free.
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
    if (!user.paypalSubscriptionId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "No active PayPal subscription found.",
      });
    }

    const token = await getToken();
    const base = getBaseUrl();

    // Query PayPal for the subscription's next billing time before cancelling
    // so we know when the current paid period ends.
    let cancelEffectiveDate: string | null = null;
    const detailsRes = await fetch(
      `${base}/v1/billing/subscriptions/${user.paypalSubscriptionId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (detailsRes.ok) {
      const details = (await detailsRes.json()) as {
        billing_info?: { next_billing_time?: string };
      };
      cancelEffectiveDate =
        details.billing_info?.next_billing_time ?? null;
    }

    // Cancel via PayPal API (ignore errors — already cancelled / expired is fine)
    await fetch(
      `${base}/v1/billing/subscriptions/${user.paypalSubscriptionId}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "Cancelled by user" }),
      }
    );

    // Don't downgrade immediately — keep the tier active until the billing
    // cycle ends.  Mark as CANCEL_PENDING so the UI can show a countdown.
    // The actual downgrade happens when PayPal sends BILLING.SUBSCRIPTION.CANCELLED
    // at the end of the paid period.
    await ctx.runMutation(internal.users._setPaypalSubscription, {
      userId: user._id,
      paypalSubscriptionId: user.paypalSubscriptionId,
      paypalSubscriptionStatus: "CANCEL_PENDING",
      subscriptionTier: null, // keep current tier unchanged
    });

    // Store the effective cancellation date
    if (cancelEffectiveDate) {
      await ctx.runMutation(internal.users._setCancelEffectiveDate, {
        userId: user._id,
        date: cancelEffectiveDate,
      });
    }
  },
});

/**
 * Creates a new PayPal subscription for a new team admin who received
 * admin transfer. Uses the key's current tier and seat count. On PayPal
 * approval, the key's paypalSubscriberId is updated to the new admin
 * and pendingPaymentTransfer is cleared.
 */
export const takeOverSubscription = action({
  args: {
    keyId: v.id("licenseKeys"),
    returnUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ approvalUrl: string }> => {
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
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the team admin can take over billing" });
    }

    const tier = key.tier as "pro" | "business";
    const seats = key.maxMembers ?? 1;
    const price = calcTotalPrice(tier, seats);
    const tierLabel = tier === "pro" ? "Pro" : "Business";

    const token = await getToken();
    const base = getBaseUrl();

    // Get the product ID from existing plans
    const existingPlans = await ctx.runQuery(internal.paypal.plans._getAllPlans);
    const productId = existingPlans[0]?.productId;
    if (!productId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "PayPal plans not initialized.",
      });
    }

    // Create a plan at the correct price for this tier + seat count
    const planRes = await fetch(`${base}/v1/billing/plans`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `gw-takeover-${tier}-${seats}seats-${Date.now()}`,
      },
      body: JSON.stringify({
        product_id: productId,
        name: `GroundWork ${tierLabel} — ${seats} seat${seats !== 1 ? "s" : ""}`,
        description: `GroundWork ${tierLabel} team subscription (admin takeover)`,
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: { interval_unit: "MONTH", interval_count: 1 },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: { value: price, currency_code: "USD" },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
      }),
    });
    if (!planRes.ok) {
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: `Failed to create PayPal plan: ${await planRes.text()}`,
      });
    }
    const newPlan = (await planRes.json()) as { id: string };

    // Create the subscription
    const subRes = await fetch(`${base}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        plan_id: newPlan.id,
        custom_id: `${user._id}:${tier}`,
        application_context: {
          brand_name: "GroundWork",
          locale: "en-US",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          return_url: args.returnUrl,
          cancel_url: args.cancelUrl,
        },
      }),
    });
    if (!subRes.ok) {
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: `Failed to create subscription: ${await subRes.text()}`,
      });
    }
    const sub = (await subRes.json()) as {
      id: string;
      links: { rel: string; href: string }[];
    };

    // Store the subscription ID and key ID for the return callback
    await ctx.runMutation(internal.users._setPaypalSubscription, {
      userId: user._id,
      paypalSubscriptionId: sub.id,
      paypalSubscriptionStatus: "APPROVAL_PENDING",
      subscriptionTier: null, // don't change tier yet
    });

    const approvalLink = sub.links.find((l) => l.rel === "approve");
    if (!approvalLink) {
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: "No approval URL in PayPal response.",
      });
    }

    return { approvalUrl: approvalLink.href };
  },
});

/**
 * Revises a team's PayPal subscription to reflect a new seat count.
 * Creates a new PayPal plan priced at (base + extra_seats × $1.99) and submits
 * a subscription revision request. Returns an approval URL if subscriber
 * re-approval is required (price increase), or null if applied immediately
 * (price decrease or unchanged).
 */
export const reviseSubscriptionSeats = action({
  args: {
    keyId: v.id("licenseKeys"),
    maxMembers: v.number(),
    returnUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ approvalUrl: string | null; applied: boolean }> => {
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

    // Fetch the license key and verify this user is the team admin
    const key = await ctx.runQuery(internal.licenseKeys._getKeyById, {
      keyId: args.keyId,
    });
    if (!key) {
      throw new ConvexError({ code: "NOT_FOUND", message: "License key not found" });
    }
    const currentAdmin = key.adminUserId ?? key.createdBy;
    if (currentAdmin !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the team admin can revise billing" });
    }

    // The PayPal subscription belongs to the subscriber (may differ from
    // the current admin after a transfer).
    const subscriberId = key.paypalSubscriberId ?? key.createdBy;
    const subscriber = subscriberId === user._id
      ? user
      : await ctx.runQuery(internal.users._getById, { userId: subscriberId });

    const subscriptionId = subscriber?.paypalSubscriptionId;
    if (!subscriptionId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "No active PayPal subscription to revise.",
      });
    }

    const tier = key.tier as "pro" | "business";
    const newPrice = calcTotalPrice(tier, args.maxMembers);
    const tierLabel = tier === "pro" ? "Pro" : "Business";
    const seatLabel = `${args.maxMembers} seat${args.maxMembers !== 1 ? "s" : ""}`;

    const token = await getToken();
    const base = getBaseUrl();

    // Get the product ID from any existing plan so we can create a new plan
    const existingPlans = await ctx.runQuery(internal.paypal.plans._getAllPlans);
    const productId = existingPlans[0]?.productId;
    if (!productId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "PayPal plans not initialized. Please initialize PayPal first.",
      });
    }

    // Create a new plan with the seat-adjusted price
    const planRes = await fetch(`${base}/v1/billing/plans`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `gw-plan-${tier}-${args.maxMembers}seats-${Date.now()}`,
      },
      body: JSON.stringify({
        product_id: productId,
        name: `GroundWork ${tierLabel} — ${seatLabel}`,
        description: `GroundWork ${tierLabel} team subscription with ${seatLabel}`,
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: { interval_unit: "MONTH", interval_count: 1 },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: { value: newPrice, currency_code: "USD" },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
      }),
    });

    if (!planRes.ok) {
      const txt = await planRes.text();
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: `Failed to create revised PayPal plan: ${txt}`,
      });
    }
    const newPlan = (await planRes.json()) as { id: string };

    // Submit subscription revision request
    const reviseRes = await fetch(
      `${base}/v1/billing/subscriptions/${subscriptionId}/revise`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan_id: newPlan.id,
          application_context: {
            brand_name: "GroundWork",
            locale: "en-US",
            shipping_preference: "NO_SHIPPING",
            user_action: "SUBSCRIBE_NOW",
            return_url: args.returnUrl,
            cancel_url: args.cancelUrl,
          },
        }),
      }
    );

    if (!reviseRes.ok) {
      const txt = await reviseRes.text();
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: `Failed to revise subscription: ${txt}`,
      });
    }

    const revision = (await reviseRes.json()) as {
      plan_overridden?: boolean;
      links?: Array<{ href: string; rel: string }>;
    };

    const approvalLink = revision.links?.find((l) => l.rel === "approve");

    if (!approvalLink) {
      // Applied immediately (e.g. price decrease) — update seat count right away
      await ctx.runMutation(internal.licenseKeys._applyPendingSeats, {
        keyId: args.keyId,
        maxMembers: args.maxMembers,
      });
      return { approvalUrl: null, applied: true };
    }

    // Subscriber needs to approve the price change via PayPal.
    // Store the pending seat count in the DB — NOT in sessionStorage — so the
    // frontend cannot manipulate it to get more seats than the user paid for.
    await ctx.runMutation(internal.licenseKeys._setPendingMaxMembers, {
      keyId: args.keyId,
      pendingMaxMembers: args.maxMembers,
    });

    return { approvalUrl: approvalLink.href, applied: false };
  },
});

/**
 * Called after the user returns from PayPal seat revision approval.
 * Reads the pending seat count from the DB (set by reviseSubscriptionSeats)
 * and applies it. Using the DB value instead of sessionStorage prevents
 * client-side manipulation of the seat count.
 */
export const applyPendingSeatsFromRevision = action({
  args: { keyId: v.id("licenseKeys") },
  handler: async (ctx, args): Promise<{ maxMembers: number | null }> => {
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

    const key = await ctx.runQuery(internal.licenseKeys._getKeyById, { keyId: args.keyId });
    if (!key) {
      throw new ConvexError({ code: "NOT_FOUND", message: "License key not found" });
    }

    // Security: verify the caller is the team admin — prevents an attacker from
    // injecting another team's keyId to trigger an unintended seat change
    const currentAdmin = key.adminUserId ?? key.createdBy;
    if (currentAdmin !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only the team admin can apply billing revisions",
      });
    }

    if (!key.pendingMaxMembers) {
      // No pending revision in DB — nothing to apply (revision may have already been applied)
      return { maxMembers: null };
    }

    await ctx.runMutation(internal.licenseKeys._applyPendingSeats, {
      keyId: args.keyId,
      maxMembers: key.pendingMaxMembers,
    });

    return { maxMembers: key.pendingMaxMembers };
  },
});

/**
 * Revises an existing PayPal subscription to change the team tier (e.g. Pro → Business).
 * Similar to reviseSubscriptionSeats but changes the tier instead of seat count.
 * Price increases require PayPal approval; downgrades apply immediately.
 */
export const reviseSubscriptionTier = action({
  args: {
    keyId: v.id("licenseKeys"),
    newTier: v.union(v.literal("pro"), v.literal("business")),
    returnUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ approvalUrl: string | null; applied: boolean }> => {
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
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the team admin can revise billing" });
    }

    // The PayPal subscription belongs to the subscriber (may differ from
    // the current admin after a transfer).
    const subscriberId = key.paypalSubscriberId ?? key.createdBy;
    const subscriber = subscriberId === user._id
      ? user
      : await ctx.runQuery(internal.users._getById, { userId: subscriberId });

    const subscriptionId = subscriber?.paypalSubscriptionId;
    if (!subscriptionId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "No active PayPal subscription to revise. The admin needs to set up payment first.",
      });
    }

    // Use current seat count to calculate new price at the new tier
    const currentSeats = key.maxMembers ?? 1;
    const newPrice = calcTotalPrice(args.newTier, currentSeats);
    const tierLabel = args.newTier === "pro" ? "Pro" : "Business";
    const seatLabel = `${currentSeats} seat${currentSeats !== 1 ? "s" : ""}`;

    const token = await getToken();
    const base = getBaseUrl();

    // Get existing product ID
    const existingPlans = await ctx.runQuery(internal.paypal.plans._getAllPlans);
    const productId = existingPlans[0]?.productId;
    if (!productId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "PayPal plans not initialized. Please initialize PayPal first.",
      });
    }

    // Create a new plan with the tier-adjusted price
    const planRes = await fetch(`${base}/v1/billing/plans`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `gw-plan-${args.newTier}-${currentSeats}seats-tierrev-${Date.now()}`,
      },
      body: JSON.stringify({
        product_id: productId,
        name: `GroundWork ${tierLabel} — ${seatLabel}`,
        description: `GroundWork ${tierLabel} team subscription with ${seatLabel}`,
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: { interval_unit: "MONTH", interval_count: 1 },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: { value: newPrice, currency_code: "USD" },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
      }),
    });

    if (!planRes.ok) {
      const txt = await planRes.text();
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: `Failed to create revised PayPal plan: ${txt}`,
      });
    }
    const newPlan = (await planRes.json()) as { id: string };

    // Submit subscription revision request
    const reviseRes = await fetch(
      `${base}/v1/billing/subscriptions/${subscriptionId}/revise`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan_id: newPlan.id,
          application_context: {
            brand_name: "GroundWork",
            locale: "en-US",
            shipping_preference: "NO_SHIPPING",
            user_action: "SUBSCRIBE_NOW",
            return_url: args.returnUrl,
            cancel_url: args.cancelUrl,
          },
        }),
      }
    );

    if (!reviseRes.ok) {
      const txt = await reviseRes.text();
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: `Failed to revise subscription: ${txt}`,
      });
    }

    const revision = (await reviseRes.json()) as {
      plan_overridden?: boolean;
      links?: Array<{ href: string; rel: string }>;
    };

    const approvalLink = revision.links?.find((l) => l.rel === "approve");

    if (!approvalLink) {
      // Applied immediately (e.g. downgrade) — update tier right away
      await ctx.runMutation(internal.licenseKeys._applyPendingTier, {
        keyId: args.keyId,
        tier: args.newTier,
      });
      return { approvalUrl: null, applied: true };
    }

    // Subscriber needs to approve the price increase via PayPal.
    // Store the pending tier in the DB (not sessionStorage) so the frontend
    // cannot manipulate it to get a higher tier without paying.
    await ctx.runMutation(internal.licenseKeys._setPendingTier, {
      keyId: args.keyId,
      pendingTier: args.newTier,
    });

    return { approvalUrl: approvalLink.href, applied: false };
  },
});

/**
 * Called after the subscriber approves a tier revision via PayPal.
 * Reads the pending tier from the DB and applies it — immune to
 * client-side manipulation.
 */
export const applyPendingTierFromRevision = action({
  args: { keyId: v.id("licenseKeys") },
  handler: async (ctx, args): Promise<{ tier: string | null }> => {
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

    const key = await ctx.runQuery(internal.licenseKeys._getKeyById, { keyId: args.keyId });
    if (!key) {
      throw new ConvexError({ code: "NOT_FOUND", message: "License key not found" });
    }

    const currentAdmin = key.adminUserId ?? key.createdBy;
    if (currentAdmin !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only the team admin can apply billing revisions",
      });
    }

    if (!key.pendingTier) {
      return { tier: null };
    }

    await ctx.runMutation(internal.licenseKeys._applyPendingTier, {
      keyId: args.keyId,
      tier: key.pendingTier,
    });

    return { tier: key.pendingTier };
  },
});

// ── Internal action — webhook processing ──────────────────────────────────────

export const processWebhook = internalAction({
  args: {
    body: v.string(),
    headers: v.record(v.string(), v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    // Optionally verify PayPal webhook signature
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (webhookId) {
      try {
        const token = await getToken();
        const base = getBaseUrl();
        const verifyRes = await fetch(
          `${base}/v1/notifications/verify-webhook-signature`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              auth_algo: args.headers["paypal-auth-algo"] ?? "",
              cert_url: args.headers["paypal-cert-url"] ?? "",
              transmission_id: args.headers["paypal-transmission-id"] ?? "",
              transmission_sig: args.headers["paypal-transmission-sig"] ?? "",
              transmission_time: args.headers["paypal-transmission-time"] ?? "",
              webhook_id: webhookId,
              webhook_event: JSON.parse(args.body),
            }),
          }
        );
        const verify = (await verifyRes.json()) as {
          verification_status: string;
        };
        if (verify.verification_status !== "SUCCESS") {
          console.error("PayPal webhook verification failed", verify);
          return;
        }
      } catch (e) {
        console.error("PayPal webhook signature check error", e);
        return;
      }
    }

    type WebhookEvent = {
      event_type: string;
      resource: {
        id: string;
        plan_id: string;
        status: string;
        custom_id: string;
      };
    };

    const event = JSON.parse(args.body) as WebhookEvent;
    const { event_type, resource } = event;

    // custom_id may be "userId" (legacy) or "userId:tier" (new format)
    const rawCustomId = resource.custom_id ?? "";
    const userId = rawCustomId.split(":")[0] as Id<"users">;
    if (!userId) {
      console.error("PayPal webhook: missing custom_id");
      return;
    }

    // Map event → tier change
    const activatingEvents = new Set([
      "BILLING.SUBSCRIPTION.ACTIVATED",
      "BILLING.SUBSCRIPTION.UPDATED",
      "BILLING.SUBSCRIPTION.RE_ACTIVATED",
    ]);
    // Hard deactivation: immediate downgrade (intentional cancel or expiry)
    const hardDeactivatingEvents = new Set([
      "BILLING.SUBSCRIPTION.CANCELLED",
      "BILLING.SUBSCRIPTION.EXPIRED",
    ]);

    let newTier: SubscriptionTier | null = null;
    let newStatus = resource.status;

    if (activatingEvents.has(event_type)) {
      const plan = await ctx.runQuery(internal.paypal.plans._getPlanByPlanId, {
        planId: resource.plan_id,
      });
      newTier = (plan?.tier ?? "free") as SubscriptionTier;
      newStatus = "ACTIVE";

      // If reactivating after a payment-failure suspension, restore the team key
      if (event_type === "BILLING.SUBSCRIPTION.RE_ACTIVATED") {
        const selfKey = await ctx.runQuery(
          internal.licenseKeys._getSelfCreatedKeyByAdmin,
          { userId }
        );
        if (selfKey) {
          await ctx.runMutation(internal.licenseKeys._reactivateKey, {
            keyId: selfKey._id,
          });
        }
      }
    } else if (event_type === "BILLING.SUBSCRIPTION.SUSPENDED") {
      // Payment failure — enter grace period (don't downgrade tier yet)
      newStatus = "SUSPENDED";
      // Keep tier as-is (null = don't change) so members retain read access
      newTier = null;

      // Suspend the team key with a 14-day grace period
      const selfKey = await ctx.runQuery(
        internal.licenseKeys._getSelfCreatedKeyByAdmin,
        { userId }
      );
      if (selfKey) {
        await ctx.runMutation(internal.licenseKeys._suspendKeyForPaymentFailure, {
          keyId: selfKey._id,
        });
      }
    } else if (hardDeactivatingEvents.has(event_type)) {
      newStatus = event_type.split(".").pop() ?? resource.status;

      const selfKey = await ctx.runQuery(
        internal.licenseKeys._getSelfCreatedKeyByAdmin,
        { userId }
      );

      if (selfKey?.pendingPaymentTransfer) {
        // Admin was transferred — don't dissolve the team. Suspend with grace
        // period so the new admin has time to set up their own payment.
        newTier = null; // keep current tier
        await ctx.runMutation(internal.licenseKeys._suspendKeyForPaymentFailure, {
          keyId: selfKey._id,
        });
      } else {
        // Intentional cancel or expiry — expire the key
        newTier = "free";
        if (selfKey) {
          await ctx.runMutation(internal.licenseKeys._expireKey, {
            keyId: selfKey._id,
          });
        }
      }
      // Clear the cancel effective date
      await ctx.runMutation(internal.users._setCancelEffectiveDate, {
        userId,
        date: "",
      });
    } else {
      // Unhandled event — log and skip
      console.log("PayPal webhook: unhandled event_type", event_type);
      return;
    }

    await ctx.runMutation(internal.users._setPaypalSubscription, {
      userId,
      paypalSubscriptionId: resource.id,
      paypalSubscriptionStatus: newStatus,
      subscriptionTier: newTier,
    });
  },
});
