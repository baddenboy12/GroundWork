import { ConvexError, v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

// ── Pending team seat store (called BEFORE PayPal redirect to prevent tampering) ─

/**
 * Stores the intended team seat count in the DB before the user is redirected
 * to PayPal. On return, createSelfKey reads this value from the DB instead of
 * from sessionStorage (which is client-controlled and can be manipulated).
 */
export const storePendingTeamSeats = mutation({
  args: { seats: v.number() },
  handler: async (ctx, args) => {
    if (args.seats < 1 || args.seats > 50) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Seat count must be between 1 and 50." });
    }
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    await ctx.db.patch(user._id, { pendingTeamSeats: args.seats });
  },
});

export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Check if we've already stored this identity before.
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (user !== null) {
      return user._id;
    }
    // If it's a new identity, create a new User with free tier.
    return await ctx.db.insert("users", {
      name: identity.name,
      email: identity.email,
      tokenIdentifier: identity.tokenIdentifier,
      subscriptionTier: "free",
    });
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    // Return null instead of throwing so callers can handle unauthenticated state gracefully
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    return user;
  },
});

// Admin-only: directly set the subscription tier without going through PayPal.
export const setSubscriptionTier = mutation({
  args: {
    tier: v.union(
      v.literal("free"),
      v.literal("starter"),
      v.literal("pro"),
      v.literal("business")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }
    // Only the admin may bypass PayPal
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail || (identity.email ?? "").toLowerCase() !== adminEmail.toLowerCase()) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }
    await ctx.db.patch(user._id, { subscriptionTier: args.tier });
  },
});

/**
 * Recalculates storageUsedBytes by summing photo bytes across all of the
 * user's logs. Fixes drift caused by deletions that happened before the
 * R2 cleanup logic was in place.
 */
export const recalculateStorage = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    // Fetch all sites for the user
    const sites = await ctx.db
      .query("sites")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();

    let totalBytes = 0;
    for (const site of sites) {
      const logs = await ctx.db
        .query("logs")
        .withIndex("by_site", (q) => q.eq("siteId", site._id))
        .collect();
      for (const log of logs) {
        totalBytes += log.photos?.reduce((s, p) => s + p.bytes, 0) ?? 0;
      }
    }

    await ctx.db.patch(user._id, { storageUsedBytes: totalBytes });
    return totalBytes;
  },
});

/** Returns true only if the signed-in user's email matches the ADMIN_EMAIL secret. */
export const getIsAdmin = query({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return false;
    return (identity.email ?? "").toLowerCase() === adminEmail.toLowerCase();
  },
});

// ── Internal helpers used by integrations backend ────────────────────────────

export const _getByToken = internalQuery({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .unique();
  },
});

export const _getById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

// ── Internal: account stats for the REST API /stats endpoint ─────────────────
export const _getStatsForApi = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const sites = await ctx.db
      .query("sites")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .collect();

    let totalLogs = 0;
    for (const site of sites) {
      const logs = await ctx.db
        .query("logs")
        .withIndex("by_site", (q) => q.eq("siteId", site._id))
        .collect();
      totalLogs += logs.length;
    }

    const tier = user.subscriptionTier ?? "free";
    const storageLimits: Record<string, number> = {
      free: 0,
      starter: 100 * 1024 * 1024,
      pro: 1 * 1024 * 1024 * 1024,
      business: 5 * 1024 * 1024 * 1024,
    };

    return {
      totalSites: sites.length,
      totalLogs,
      storageUsedBytes: user.storageUsedBytes ?? 0,
      storageLimitBytes: storageLimits[tier] ?? 0,
      subscriptionTier: tier,
    };
  },
});

/**
 * Updates PayPal subscription data on a user.
 * Pass subscriptionTier=null to leave the tier unchanged (e.g. when recording a pending approval).
 */
export const _setPaypalSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    paypalSubscriptionId: v.string(),
    paypalSubscriptionStatus: v.string(),
    subscriptionTier: v.union(
      v.null(),
      v.literal("free"),
      v.literal("starter"),
      v.literal("pro"),
      v.literal("business")
    ),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    if (args.subscriptionTier !== null) {
      await ctx.db.patch(userId, {
        paypalSubscriptionId: args.paypalSubscriptionId,
        paypalSubscriptionStatus: args.paypalSubscriptionStatus,
        subscriptionTier: args.subscriptionTier,
      });
    } else {
      await ctx.db.patch(userId, {
        paypalSubscriptionId: args.paypalSubscriptionId,
        paypalSubscriptionStatus: args.paypalSubscriptionStatus,
      });
    }
  },
});
