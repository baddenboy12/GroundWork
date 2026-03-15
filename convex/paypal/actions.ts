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
  starter: { name: "Starter", price: "3.99" },
  pro: { name: "Pro", price: "7.99" },
  business: { name: "Business", price: "12.99" },
} as const;

type PaidTier = keyof typeof PLAN_CONFIG;
type SubscriptionTier = "free" | PaidTier;

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
    if (existing.length === 3) {
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
        "PayPal-Request-Id": `sitescribe-product-${Date.now()}`,
      },
      body: JSON.stringify({
        name: "SiteScribe",
        description: "SiteScribe site logging management service",
        type: "SERVICE",
        category: "SOFTWARE",
      }),
    });
    const product = (await productRes.json()) as { id: string };
    const productId = product.id;

    const planIds: Record<string, string> = {};
    for (const tier of ["starter", "pro", "business"] as PaidTier[]) {
      const { name, price } = PLAN_CONFIG[tier];
      const planRes = await fetch(`${base}/v1/billing/plans`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": `sitescribe-plan-${tier}-${Date.now()}`,
        },
        body: JSON.stringify({
          product_id: productId,
          name: `SiteScribe ${name}`,
          description: `SiteScribe ${name} – monthly subscription`,
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
      v.literal("starter"),
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

    const subRes = await fetch(`${base}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `sitescribe-sub-${user._id}-${Date.now()}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        plan_id: plan.planId,
        // Store user's Convex ID so webhook can find them
        custom_id: user._id,
        subscriber: {
          name: {
            given_name: user.name?.split(" ")[0] ?? "SiteScribe",
            surname: user.name?.split(" ").slice(1).join(" ") || "User",
          },
          ...(user.email ? { email_address: user.email } : {}),
        },
        application_context: {
          brand_name: "SiteScribe",
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

    // Security: verify this subscription belongs to this user
    if (sub.custom_id !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Subscription does not belong to this user.",
      });
    }

    const plan = await ctx.runQuery(internal.paypal.plans._getPlanByPlanId, {
      planId: sub.plan_id,
    });

    const isActive = sub.status === "ACTIVE" || sub.status === "APPROVED";
    const tier: SubscriptionTier = isActive
      ? ((plan?.tier ?? "free") as SubscriptionTier)
      : "free";

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

    await ctx.runMutation(internal.users._setPaypalSubscription, {
      userId: user._id,
      paypalSubscriptionId: user.paypalSubscriptionId,
      paypalSubscriptionStatus: "CANCELLED",
      subscriptionTier: "free",
    });
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

    const userId = resource.custom_id as Id<"users">;
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
    const deactivatingEvents = new Set([
      "BILLING.SUBSCRIPTION.CANCELLED",
      "BILLING.SUBSCRIPTION.EXPIRED",
      "BILLING.SUBSCRIPTION.SUSPENDED",
    ]);

    let newTier: SubscriptionTier | null = null;
    let newStatus = resource.status;

    if (activatingEvents.has(event_type)) {
      const plan = await ctx.runQuery(internal.paypal.plans._getPlanByPlanId, {
        planId: resource.plan_id,
      });
      newTier = (plan?.tier ?? "free") as SubscriptionTier;
      newStatus = "ACTIVE";
    } else if (deactivatingEvents.has(event_type)) {
      newTier = "free";
      newStatus = event_type.split(".").pop() ?? resource.status;
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
