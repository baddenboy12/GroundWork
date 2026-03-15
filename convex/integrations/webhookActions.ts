"use node";
import { v, ConvexError } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import * as crypto from "node:crypto";

/** Create a new webhook. Returns the signing secret (shown once to the user). */
export const create = action({
  args: {
    name: v.string(),
    url: v.string(),
    events: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<{ secret: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

    const user = await ctx.runQuery(internal.users._getByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    if ((user.subscriptionTier ?? "free") !== "business") {
      throw new ConvexError({ message: "Business plan required for webhooks", code: "FORBIDDEN" });
    }
    if (!args.name.trim()) {
      throw new ConvexError({ message: "Webhook name cannot be empty", code: "BAD_REQUEST" });
    }
    try {
      new URL(args.url);
    } catch {
      throw new ConvexError({ message: "Invalid webhook URL", code: "BAD_REQUEST" });
    }
    if (args.events.length === 0) {
      throw new ConvexError({ message: "Select at least one event", code: "BAD_REQUEST" });
    }

    const secret = crypto.randomBytes(32).toString("hex");

    await ctx.runMutation(internal.integrations.webhooks._insert, {
      userId: user._id,
      name: args.name.trim(),
      url: args.url,
      events: args.events,
      secret,
    });

    return { secret };
  },
});

/** Send a test "ping" payload to a webhook and return the delivery result. */
export const test = action({
  args: { webhookId: v.id("webhooks") },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; status?: number; error?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

    const user = await ctx.runQuery(internal.users._getByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const webhook = await ctx.runQuery(internal.integrations.webhooks._getById, {
      webhookId: args.webhookId,
    });
    if (!webhook || webhook.userId !== user._id) {
      throw new ConvexError({ message: "Webhook not found", code: "NOT_FOUND" });
    }

    const payload = {
      event: "ping",
      timestamp: new Date().toISOString(),
      data: { message: "Test delivery from SiteScribe", webhookId: webhook._id },
    };

    try {
      const payloadStr = JSON.stringify(payload);
      const hmac = crypto.createHmac("sha256", webhook.secret);
      hmac.update(payloadStr);
      const signature = `sha256=${hmac.digest("hex")}`;

      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SiteScribe-Signature": signature,
          "X-SiteScribe-Event": "ping",
          "User-Agent": "SiteScribe-Webhook/1.0",
        },
        body: payloadStr,
        signal: AbortSignal.timeout(10_000),
      });

      return { success: response.ok, status: response.status };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Request failed",
      };
    }
  },
});

/**
 * Internal: deliver a webhook event to all matching active endpoints.
 * Called from ctx.scheduler.runAfter inside log mutations.
 */
export const deliver = internalAction({
  args: {
    userId: v.id("users"),
    event: v.string(),
    logId: v.id("logs"),
    siteName: v.string(),
  },
  handler: async (ctx, args) => {
    const webhooks = await ctx.runQuery(internal.integrations.webhooks._listActive, {
      userId: args.userId,
      event: args.event,
    });
    if (webhooks.length === 0) return;

    const log = await ctx.runQuery(internal.logs._getForWebhook, { logId: args.logId });
    if (!log) return;

    const payload = {
      event: args.event,
      timestamp: new Date().toISOString(),
      data: {
        logId: log._id,
        siteId: log.siteId,
        siteName: args.siteName,
        title: log.title,
        content: log.content,
        category: log.category,
        loggedAt: log.loggedAt,
        location: log.location ?? null,
        latitude: log.latitude ?? null,
        longitude: log.longitude ?? null,
      },
    };

    for (const webhook of webhooks) {
      try {
        const payloadStr = JSON.stringify(payload);
        const hmac = crypto.createHmac("sha256", webhook.secret);
        hmac.update(payloadStr);
        const signature = `sha256=${hmac.digest("hex")}`;

        await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-SiteScribe-Signature": signature,
            "X-SiteScribe-Event": args.event,
            "User-Agent": "SiteScribe-Webhook/1.0",
          },
          body: payloadStr,
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        // Best-effort delivery — swallow errors so one failing endpoint
        // doesn't prevent delivery to the others.
      }
    }
  },
});
