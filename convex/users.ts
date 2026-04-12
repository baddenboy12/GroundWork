import { ConvexError, v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel.d.ts";

// ── Pending team seat store (called BEFORE Stripe Checkout redirect to prevent tampering) ─

/**
 * Stores the intended team seat count in the DB before the user is redirected
 * to Stripe Checkout. On return, createSelfKey reads this value from the DB
 * instead of from sessionStorage (which is client-controlled and can be
 * manipulated).
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
    await ctx.db.patch(user._id, {
      pendingTeamSeats: args.seats,
      pendingTeamSeatsAt: Date.now(),
    });
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

    const adminEmail = process.env.ADMIN_EMAIL;
    const isSuperAdmin =
      !!adminEmail &&
      (identity.email ?? "").toLowerCase() === adminEmail.toLowerCase();

    // Check if we've already stored this identity before.
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user !== null) {
      // Always keep name, email, and role fresh on every login
      // Trim and skip empty strings (some providers like Microsoft return "")
      const updates: Record<string, string | undefined> = {};
      const freshName = identity.name?.trim() || undefined;
      if (freshName && freshName !== user.name) updates.name = freshName;
      if (identity.email && identity.email !== user.email) updates.email = identity.email;
      const expectedRole = isSuperAdmin ? "super_admin" : "user";
      if (user.role !== expectedRole) updates.role = expectedRole;
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(user._id, updates);
      }
      return user._id;
    }

    // New user – create with free tier, createdAt timestamp, and role
    const insertName = identity.name?.trim() || undefined;
    const newUserId = await ctx.db.insert("users", {
      name: insertName,
      email: identity.email,
      tokenIdentifier: identity.tokenIdentifier,
      subscriptionTier: "free",
      createdAt: new Date().toISOString(),
      role: isSuperAdmin ? "super_admin" : "user",
    });

    // Send welcome email (fire-and-forget)
    if (identity.email) {
      const appUrl = process.env.GROUNDWORK_APP_URL ?? "https://groundwork.teezfpo.com/dashboard";
      await ctx.scheduler.runAfter(0, internal.emails.teamNotifications.sendWelcome, {
        to: identity.email,
        userName: insertName ?? "",
        appUrl,
      });
    }

    return newUserId;
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

// Admin-only: directly set the subscription tier without going through Stripe.
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
    // Admin or sandbox users may bypass Stripe
    const adminEmail = process.env.ADMIN_EMAIL;
    const isAdmin = !!adminEmail && (identity.email ?? "").toLowerCase() === adminEmail.toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }
    if (!isAdmin && !user.sandboxMode) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin or sandbox access required" });
    }
    await ctx.db.patch(user._id, {
      subscriptionTier: args.tier,
      adminGrantedTier: true,
      stripeSubscriptionId: undefined,
      stripeSubscriptionStatus: undefined,
    });
  },
});

/** Allows the signed-in user to set or update their own display name. */
export const updateName = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const trimmed = args.name.trim();
    if (!trimmed) throw new ConvexError({ code: "BAD_REQUEST", message: "Name cannot be empty." });
    if (trimmed.length > 100) throw new ConvexError({ code: "BAD_REQUEST", message: "Name is too long." });
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    await ctx.db.patch(user._id, { name: trimmed });
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

/**
 * One-time backfill: stamps createdAt and role on all existing users that
 * are missing those fields. Only the super-admin can call this.
 */
export const backfillUserMetadata = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail || (identity.email ?? "").toLowerCase() !== adminEmail.toLowerCase()) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const allUsers = await ctx.db.query("users").collect();
    let updated = 0;
    for (const user of allUsers) {
      const patches: Record<string, string> = {};
      if (!user.createdAt) {
        // Fall back to _creationTime (ms epoch → ISO string)
        patches.createdAt = new Date(user._creationTime).toISOString();
      }
      if (!user.role) {
        const isSuperAdmin =
          !!adminEmail && (user.email ?? "").toLowerCase() === adminEmail.toLowerCase();
        patches.role = isSuperAdmin ? "super_admin" : "user";
      }
      if (Object.keys(patches).length > 0) {
        await ctx.db.patch(user._id, patches);
        updated++;
      }
    }
    return { updated };
  },
});

/** Admin-only: toggle sandboxMode on a user so they can switch tiers freely. */
export const toggleSandboxMode = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail || (identity.email ?? "").toLowerCase() !== adminEmail.toLowerCase()) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    await ctx.db.patch(args.userId, { sandboxMode: !target.sandboxMode });
    return { sandboxMode: !target.sandboxMode };
  },
});

/** Admin-only: list all users for the sandbox testers admin panel. */
export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail || (identity.email ?? "").toLowerCase() !== adminEmail.toLowerCase()) {
      return null;
    }
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      subscriptionTier: u.subscriptionTier ?? "free",
      sandboxMode: u.sandboxMode ?? false,
      adminGrantedTier: u.adminGrantedTier ?? false,
    }));
  },
});

/** Internal: set admin-granted tier on a user (used by CLI tooling). */
export const _setAdminGrantedTier = internalMutation({
  args: {
    userId: v.id("users"),
    tier: v.union(
      v.literal("free"),
      v.literal("starter"),
      v.literal("pro"),
      v.literal("business")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      subscriptionTier: args.tier,
      adminGrantedTier: true,
      stripeSubscriptionId: undefined,
      stripeSubscriptionStatus: undefined,
    });
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

// ── Stripe subscription internal mutations ──────────────────────────────────

import { STRIPE_SUBSCRIPTION_STATUS } from "./_lib/validators";

/**
 * Updates Stripe subscription data on a user.
 * Pass subscriptionTier=null to leave the tier unchanged (e.g. when writing
 * only a status transition).
 */
export const _setStripeSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    stripeSubscriptionId: v.string(),
    stripeSubscriptionStatus: STRIPE_SUBSCRIPTION_STATUS,
    subscriptionTier: v.union(
      v.null(),
      v.literal("free"),
      v.literal("starter"),
      v.literal("pro"),
      v.literal("business")
    ),
  },
  handler: async (ctx, args) => {
    if (args.subscriptionTier !== null) {
      await ctx.db.patch(args.userId, {
        stripeSubscriptionId: args.stripeSubscriptionId,
        stripeSubscriptionStatus: args.stripeSubscriptionStatus,
        subscriptionTier: args.subscriptionTier,
        adminGrantedTier: undefined,
      });
    } else {
      await ctx.db.patch(args.userId, {
        stripeSubscriptionId: args.stripeSubscriptionId,
        stripeSubscriptionStatus: args.stripeSubscriptionStatus,
        adminGrantedTier: undefined,
      });
    }
  },
});

export const _setStripeCancelEffectiveDate = internalMutation({
  args: { userId: v.id("users"), date: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      stripeCancelEffectiveDate: args.date || undefined,
    });
  },
});

export const _setStripeCustomerId = internalMutation({
  args: { userId: v.id("users"), stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      stripeCustomerId: args.stripeCustomerId,
    });
  },
});

export const _setStripeCheckoutSession = internalMutation({
  args: { userId: v.id("users"), sessionId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      stripeCheckoutSessionId: args.sessionId,
    });
  },
});

export const _getByStripeCustomerId = internalQuery({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_stripe_customer", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .unique();
  },
});

/**
 * Safety-net: downgrades any cancel_pending users whose billing cycle has
 * ended (stripeCancelEffectiveDate is in the past). Called by a daily cron.
 * This is a fallback for a missed customer.subscription.deleted webhook.
 */
export const _processExpiredCancelPending = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date().toISOString();
    const allUsers = await ctx.db.query("users").collect();
    let processed = 0;

    for (const user of allUsers) {
      if (
        user.stripeSubscriptionStatus === "cancel_pending" &&
        user.stripeCancelEffectiveDate &&
        user.stripeCancelEffectiveDate <= now
      ) {
        // Downgrade to free and clear cancel state
        await ctx.db.patch(user._id, {
          subscriptionTier: "free",
          stripeSubscriptionStatus: "canceled",
          stripeCancelEffectiveDate: undefined,
        });

        // Expire any self-created team key
        const keys = await ctx.db.query("licenseKeys").collect();
        const selfKey = keys.find(
          (k) =>
            k.selfCreated &&
            k.createdBy === user._id &&
            k.status === "active"
        );
        if (selfKey) {
          // Remove all members and delete the key
          const memberships = await ctx.db
            .query("keyMemberships")
            .withIndex("by_key", (q) => q.eq("keyId", selfKey._id))
            .collect();
          for (const m of memberships) {
            const member = await ctx.db.get(m.userId);
            if (member) {
              await ctx.db.patch(m.userId, {
                subscriptionTier: "free",
                appliedLicenseKeyId: undefined,
              });
            }
            await ctx.db.delete(m._id);
          }
          await ctx.db.delete(selfKey._id);
        }

        processed++;
      }
    }

    if (processed > 0) {
      console.log(`[cron] Processed ${processed} expired cancel_pending user(s)`);
    }
  },
});

// ── Pending team seats expiry ──────────────────────────────────────────────────

/** 30-minute window for the Stripe Checkout redirect flow to complete */
const PENDING_SEATS_TTL_MS = 30 * 60 * 1000;

/**
 * Clears stale pendingTeamSeats on any user where the timestamp is older
 * than 30 minutes. Safe to run from a cron job.
 */
export const _clearStalePendingSeats = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - PENDING_SEATS_TTL_MS;
    const allUsers = await ctx.db.query("users").collect();
    let cleared = 0;

    for (const user of allUsers) {
      if (
        user.pendingTeamSeats !== undefined &&
        // Clear if timestamp is missing (legacy) or older than TTL
        (!user.pendingTeamSeatsAt || user.pendingTeamSeatsAt < cutoff)
      ) {
        await ctx.db.patch(user._id, {
          pendingTeamSeats: undefined,
          pendingTeamSeatsAt: undefined,
        });
        cleared++;
      }
    }

    if (cleared > 0) {
      console.log(`[cron] Cleared ${cleared} stale pendingTeamSeats`);
    }
  },
});
