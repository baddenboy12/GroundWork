import { ConvexError, v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generates a random license key like "GW-A3K9-BX2M-7YNP" */
function generateKeyCode(): string {
  // Avoids visually ambiguous characters (0/O, 1/I/l)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = () =>
    Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  return `GW-${seg()}-${seg()}-${seg()}`;
}

async function requireAdmin(ctx: { auth: { getUserIdentity: () => Promise<{ tokenIdentifier: string; email?: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || (identity.email ?? "").toLowerCase() !== adminEmail.toLowerCase()) {
    throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return identity;
}

// ── Admin: Generate a new key ─────────────────────────────────────────────────

export const generate = mutation({
  args: {
    tier: v.union(v.literal("pro"), v.literal("business")),
    maxMembers: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "Admin user not found" });

    // Ensure uniqueness (retry once on collision)
    let code = generateKeyCode();
    const existing = await ctx.db
      .query("licenseKeys")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (existing) code = generateKeyCode();

    const keyId = await ctx.db.insert("licenseKeys", {
      code,
      createdBy: user._id,
      tier: args.tier,
      status: "active",
      maxMembers: args.maxMembers,
      note: args.note,
    });
    return { keyId, code };
  },
});

// ── Admin: List all keys ──────────────────────────────────────────────────────

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail || (identity.email ?? "").toLowerCase() !== adminEmail.toLowerCase()) return [];

    const keys = await ctx.db.query("licenseKeys").order("desc").collect();

    // Attach member count to each key
    const result = await Promise.all(
      keys.map(async (k) => {
        const memberships = await ctx.db
          .query("keyMemberships")
          .withIndex("by_key", (q) => q.eq("keyId", k._id))
          .collect();
        return { ...k, memberCount: memberships.length };
      })
    );
    return result;
  },
});

// ── Admin: Update key status ──────────────────────────────────────────────────

export const updateStatus = mutation({
  args: {
    keyId: v.id("licenseKeys"),
    status: v.union(v.literal("active"), v.literal("expired"), v.literal("suspended")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const key = await ctx.db.get(args.keyId);
    if (!key) throw new ConvexError({ code: "NOT_FOUND", message: "Key not found" });
    await ctx.db.patch(args.keyId, { status: args.status });

    // If suspending/expiring, downgrade all members back to free
    if (args.status !== "active") {
      const memberships = await ctx.db
        .query("keyMemberships")
        .withIndex("by_key", (q) => q.eq("keyId", args.keyId))
        .collect();
      for (const m of memberships) {
        const member = await ctx.db.get(m.userId);
        if (member && member.appliedLicenseKeyId === args.keyId) {
          await ctx.db.patch(m.userId, {
            subscriptionTier: "free",
            appliedLicenseKeyId: undefined,
          });
          // Clear teamKeyId from all sites this member owns
          const memberSites = await ctx.db
            .query("sites")
            .withIndex("by_owner", (q) => q.eq("ownerId", m.userId))
            .collect();
          for (const site of memberSites) {
            if (site.teamKeyId === args.keyId) {
              await ctx.db.patch(site._id, { teamKeyId: undefined });
            }
          }
        }
        await ctx.db.delete(m._id);
      }
    }
  },
});

// ── User: Apply a key to their account ───────────────────────────────────────

export const applyKey = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    // If already has a key, reject
    if (user.appliedLicenseKeyId) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "You already have a license key applied. Remove it first.",
      });
    }

    const normalised = args.code.trim().toUpperCase();
    const key = await ctx.db
      .query("licenseKeys")
      .withIndex("by_code", (q) => q.eq("code", normalised))
      .unique();

    if (!key) throw new ConvexError({ code: "NOT_FOUND", message: "License key not found" });
    if (key.status !== "active") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `This key is ${key.status} and cannot be applied.`,
      });
    }

    // Check member capacity
    const memberships = await ctx.db
      .query("keyMemberships")
      .withIndex("by_key", (q) => q.eq("keyId", key._id))
      .collect();
    if (memberships.length >= key.maxMembers) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "This key has reached its maximum number of members.",
      });
    }

    // Apply
    await ctx.db.insert("keyMemberships", {
      keyId: key._id,
      userId: user._id,
      joinedAt: new Date().toISOString(),
    });
    await ctx.db.patch(user._id, {
      appliedLicenseKeyId: key._id,
      subscriptionTier: key.tier,
    });

    return { tier: key.tier };
  },
});

// ── User: Remove their key ────────────────────────────────────────────────────

export const removeKey = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (!user.appliedLicenseKeyId) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "No license key applied" });
    }

    // Remove membership record
    const membership = await ctx.db
      .query("keyMemberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (membership) await ctx.db.delete(membership._id);

    // Clear teamKeyId from all sites owned by this user for this key
    const userSites = await ctx.db
      .query("sites")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    for (const site of userSites) {
      if (site.teamKeyId === user.appliedLicenseKeyId) {
        await ctx.db.patch(site._id, { teamKeyId: undefined });
      }
    }

    // Revert tier — keep PayPal tier if still active
    const hasPayPal =
      user.paypalSubscriptionStatus === "ACTIVE" ||
      user.paypalSubscriptionStatus === "APPROVED";
    await ctx.db.patch(user._id, {
      appliedLicenseKeyId: undefined,
      subscriptionTier: hasPayPal ? user.subscriptionTier : "free",
    });
  },
});

// ── User: Get their current key + team info ───────────────────────────────────

export const getMyKeyInfo = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || !user.appliedLicenseKeyId) return null;

    const key = await ctx.db.get(user.appliedLicenseKeyId);
    if (!key) return null;

    // Fetch all team members
    const memberships = await ctx.db
      .query("keyMemberships")
      .withIndex("by_key", (q) => q.eq("keyId", key._id))
      .collect();

    const members = await Promise.all(
      memberships.map(async (m) => {
        const member = await ctx.db.get(m.userId);
        return {
          userId: m.userId,
          name: member?.name ?? "Unknown",
          email: member?.email ?? null,
          joinedAt: m.joinedAt,
          isMe: m.userId === user._id,
        };
      })
    );

    return {
      keyId: key._id,
      code: key.code,
      tier: key.tier,
      status: key.status,
      maxMembers: key.maxMembers,
      memberCount: memberships.length,
      members,
    };
  },
});

// ── Internal: downgrade all members when a key expires (for PayPal webhook) ──

export const _expireKey = internalMutation({
  args: { keyId: v.id("licenseKeys") },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.keyId);
    if (!key) return;
    await ctx.db.patch(args.keyId, { status: "expired" });

    const memberships = await ctx.db
      .query("keyMemberships")
      .withIndex("by_key", (q) => q.eq("keyId", args.keyId))
      .collect();

    for (const m of memberships) {
      const member = await ctx.db.get(m.userId as Id<"users">);
      if (member && member.appliedLicenseKeyId === args.keyId) {
        await ctx.db.patch(m.userId as Id<"users">, {
          subscriptionTier: "free",
          appliedLicenseKeyId: undefined,
        });
      }
      await ctx.db.delete(m._id);
    }
  },
});
