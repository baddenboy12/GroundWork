import { ConvexError, v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel.d.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generates a random license key like "GW-A3K9-BX2M-7YNP" */
function generateKeyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rng = new Uint32Array(12);
  crypto.getRandomValues(rng);
  const seg = (offset: number) =>
    Array.from({ length: 4 }, (_, j) =>
      chars[rng[offset + j] % chars.length]
    ).join("");
  return `GW-${seg(0)}-${seg(4)}-${seg(8)}`;
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

// ── Admin / Team member: Toggle key status (active ↔ suspended) ──────────────

export const updateStatus = mutation({
  args: {
    keyId: v.id("licenseKeys"),
    status: v.union(v.literal("active"), v.literal("suspended")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const key = await ctx.db.get(args.keyId);
    if (!key) throw new ConvexError({ code: "NOT_FOUND", message: "Key not found" });

    // Allow super-admin or team admin only
    const adminEmail = process.env.ADMIN_EMAIL;
    const isSuperAdmin = adminEmail && (identity.email ?? "").toLowerCase() === adminEmail.toLowerCase();
    const isTeamAdmin = key.adminUserId === user._id || key.createdBy === user._id;

    if (!isSuperAdmin && !isTeamAdmin) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the team admin can change key status" });
    }

    // Reject manual reactivation when suspended for payment failure —
    // only PayPal reactivation (RE_ACTIVATED webhook) should clear that state
    if (key.suspendedReason === "payment_failed" && args.status === "active" && !isSuperAdmin) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "This key is suspended due to a failed payment. Resolve your PayPal subscription to reactivate it.",
      });
    }

    // Simple toggle — members stay attached, no kicking
    await ctx.db.patch(args.keyId, { status: args.status });
  },
});

// ── User: Apply a key to join a team ─────────────────────────────────────────

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

    // Enforce member cap if set
    if (key.maxMembers !== undefined && key.maxMembers !== null) {
      const currentMemberships = await ctx.db
        .query("keyMemberships")
        .withIndex("by_key", (q) => q.eq("keyId", key._id))
        .collect();
      if (currentMemberships.length >= key.maxMembers) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: `This team has reached its seat limit (${key.maxMembers}). Ask the admin to increase the seat count.`,
        });
      }
    }

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

// ── User: Remove their key (leave team) ──────────────────────────────────────

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

    const keyId = user.appliedLicenseKeyId;
    const key = await ctx.db.get(keyId);

    // Count remaining members (including the one about to leave)
    const allMemberships = await ctx.db
      .query("keyMemberships")
      .withIndex("by_key", (q) => q.eq("keyId", keyId))
      .collect();

    const isLastMember = allMemberships.length <= 1;

    // ── Auto-transfer admin if not last member ─────────────────────────
    if (!isLastMember && key) {
      const currentAdmin = key.adminUserId ?? key.createdBy;
      if (currentAdmin === user._id) {
        const others = allMemberships.filter((m) => m.userId !== user._id);
        if (others.length > 0) {
          const newAdmin = others[Math.floor(Math.random() * others.length)];
          await ctx.db.patch(keyId, { adminUserId: newAdmin.userId });
        }
      }
    }

    // Remove this user's membership record
    const membership = await ctx.db
      .query("keyMemberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (membership) await ctx.db.delete(membership._id);

    // Revert tier — keep PayPal tier if still active
    const hasPayPal =
      user.paypalSubscriptionStatus === "ACTIVE" ||
      user.paypalSubscriptionStatus === "APPROVED";
    await ctx.db.patch(user._id, {
      appliedLicenseKeyId: undefined,
      subscriptionTier: hasPayPal ? user.subscriptionTier : "free",
    });

    // ── Last member leaving: dissolve the team ────────────────────────
    if (isLastMember && key) {
      // Delete all team sites, their logs, and clean up R2 photos
      const teamSites = await ctx.db
        .query("sites")
        .withIndex("by_team_key", (q) => q.eq("teamKeyId", keyId))
        .collect();
      const allR2Keys: string[] = [];
      for (const site of teamSites) {
        const logs = await ctx.db
          .query("logs")
          .withIndex("by_site", (q) => q.eq("siteId", site._id))
          .collect();
        for (const log of logs) {
          if (log.photos?.length) {
            for (const photo of log.photos) {
              allR2Keys.push(photo.key);
            }
          }
          if (log.photoStorageIds?.length) {
            for (const storageId of log.photoStorageIds) {
              await ctx.storage.delete(storageId);
            }
          }
          await ctx.db.delete(log._id);
        }
        await ctx.db.delete(site._id);
      }
      if (allR2Keys.length > 0) {
        await ctx.scheduler.runAfter(0, internal.r2.storageActions.deletePhotosFromR2, { keys: allR2Keys });
      }

      // Cancel any pending deletion votes for this team
      const pendingVotes = await ctx.db
        .query("siteDeleteVotes")
        .withIndex("by_team_key_and_status", (q) =>
          q.eq("teamKeyId", keyId).eq("status", "pending")
        )
        .collect();
      for (const vote of pendingVotes) {
        await ctx.db.patch(vote._id, { status: "cancelled" });
      }

      // Delete the license key itself
      await ctx.db.delete(keyId);
    }
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
          isAdmin: (key.adminUserId ?? key.createdBy) === m.userId,
        };
      })
    );

    // Calculate grace period deadline if payment-suspended
    const GRACE_DAYS = 14;
    const graceDeadline = key.suspendedAt
      ? new Date(new Date(key.suspendedAt).getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : null;

    return {
      keyId: key._id,
      code: key.code,
      tier: key.tier,
      status: key.status,
      memberCount: memberships.length,
      maxMembers: key.maxMembers ?? null,
      members,
      adminUserId: key.adminUserId ?? key.createdBy,
      isAdmin: (key.adminUserId ?? key.createdBy) === user._id,
      selfCreated: key.selfCreated ?? false,
      suspendedAt: key.suspendedAt ?? null,
      suspendedReason: key.suspendedReason ?? null,
      graceDeadline,
    };
  },
});

// ── User: Self-service create a team key (requires active subscription) ───────

export const updateMaxMembers = mutation({
  args: {
    keyId: v.id("licenseKeys"),
    maxMembers: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.maxMembers < 1) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Minimum 1 seat required." });
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const key = await ctx.db.get(args.keyId);
    if (!key) throw new ConvexError({ code: "NOT_FOUND", message: "Key not found" });

    const currentAdmin = key.adminUserId ?? key.createdBy;
    if (currentAdmin !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the team admin can update seat count" });
    }

    // ── Billing enforcement for self-created (subscriber-owned) keys ──────────
    // If the admin has an active PayPal subscription and is trying to INCREASE
    // the seat count, we must ensure a PayPal billing revision was completed first.
    // reviseSubscriptionSeats stores the approved count in key.pendingMaxMembers;
    // direct increases without that approval are blocked to prevent billing bypass.
    if (key.selfCreated) {
      const currentMax = key.maxMembers ?? 1;
      const isIncreasing = args.maxMembers > currentMax;
      if (isIncreasing) {
        const isPaypalActive =
          user.paypalSubscriptionStatus === "ACTIVE" ||
          user.paypalSubscriptionStatus === "APPROVED";
        if (isPaypalActive) {
          if (key.pendingMaxMembers !== args.maxMembers) {
            throw new ConvexError({
              code: "BAD_REQUEST",
              message:
                "Seat increases on an active PayPal subscription require billing approval. " +
                "Use the 'Edit seats' button to go through the PayPal revision flow.",
            });
          }
          // Pending revision matches — allow it and clear the pending marker
          await ctx.db.patch(args.keyId, { pendingMaxMembers: undefined });
        }
      }
    }

    // Cannot reduce below current member count
    const memberships = await ctx.db
      .query("keyMemberships")
      .withIndex("by_key", (q) => q.eq("keyId", args.keyId))
      .collect();
    if (args.maxMembers < memberships.length) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Cannot reduce seats below current member count (${memberships.length}).`,
      });
    }

    await ctx.db.patch(args.keyId, { maxMembers: args.maxMembers });
  },
});

export const createSelfKey = mutation({
  args: {
    tier: v.union(v.literal("pro"), v.literal("business")),
    maxMembers: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    if (user.appliedLicenseKeyId) {
      throw new ConvexError({ code: "CONFLICT", message: "You already have a team key. Remove it first." });
    }

    // ── Billing enforcement for multi-seat team creation ──────────────────────
    // If the user has an active PayPal subscription and wants > 1 seat, the seat
    // count MUST have been pre-committed via storePendingTeamSeats before the
    // PayPal payment. This prevents sessionStorage manipulation where a user could
    // pay for 2 seats but inject maxMembers=50 into the frontend after approval.
    const requestedSeats = args.maxMembers ?? 1;
    if (requestedSeats > 1) {
      const isPaypalActive =
        user.paypalSubscriptionStatus === "ACTIVE" ||
        user.paypalSubscriptionStatus === "APPROVED";
      if (isPaypalActive) {
        if (!user.pendingTeamSeats || user.pendingTeamSeats !== requestedSeats) {
          throw new ConvexError({
            code: "BAD_REQUEST",
            message:
              "Seat count mismatch. To create a team with multiple seats, the seat " +
              "count must be committed to the server before PayPal payment. " +
              "This prevents billing bypass via sessionStorage manipulation.",
          });
        }
        // Clear the pending seat intent — it has now been consumed
        await ctx.db.patch(user._id, { pendingTeamSeats: undefined });
      }
    }

    // Generate a unique code (retry up to 5 times on collision)
    let code = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateKeyCode();
      const existing = await ctx.db
        .query("licenseKeys")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();
      if (!existing) break;
      if (attempt === 4) throw new ConvexError({ code: "INTERNAL", message: "Failed to generate unique key code" });
    }

    const keyId = await ctx.db.insert("licenseKeys", {
      code,
      createdBy: user._id,
      adminUserId: user._id,
      tier: args.tier,
      status: "active",
      note: `Team — ${user.name ?? user.email ?? "subscriber"}`,
      selfCreated: true,
      maxMembers: args.maxMembers,
    });

    // Creator joins their own key automatically
    await ctx.db.insert("keyMemberships", {
      keyId,
      userId: user._id,
      joinedAt: new Date().toISOString(),
    });
    await ctx.db.patch(user._id, { appliedLicenseKeyId: keyId });

    // Personal sites are NOT tagged — team starts with a clean site pool

    return { keyId, code };
  },
});

// ── Team admin: Change team tier (propagates to all members) ─────────────────

export const changeTierForTeam = mutation({
  args: {
    keyId: v.id("licenseKeys"),
    tier: v.union(v.literal("pro"), v.literal("business")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const key = await ctx.db.get(args.keyId);
    if (!key) throw new ConvexError({ code: "NOT_FOUND", message: "Key not found" });

    const currentAdmin = key.adminUserId ?? key.createdBy;
    if (currentAdmin !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the team admin can change the team tier" });
    }

    // ── Billing enforcement: block direct tier upgrades on active PayPal subs ───
    // Tier upgrades must go through reviseSubscriptionTier (PayPal approval flow).
    // This mutation is only used for admin-granted keys or downgrades.
    // The billing page handles upgrades via the PayPal revision action instead.
    if (key.selfCreated) {
      const tierRank: Record<string, number> = { pro: 1, business: 2 };
      const currentRank = tierRank[key.tier] ?? 0;
      const newRank = tierRank[args.tier] ?? 0;
      if (newRank > currentRank) {
        const isPaypalActive =
          user.paypalSubscriptionStatus === "ACTIVE" ||
          user.paypalSubscriptionStatus === "APPROVED";
        if (isPaypalActive) {
          throw new ConvexError({
            code: "REQUIRES_PAYPAL_REVISION",
            message:
              "Tier upgrades on an active PayPal subscription require PayPal approval. " +
              "Use the tier revision flow instead.",
          });
        }
      }
    }

    // Update the key tier
    await ctx.db.patch(args.keyId, { tier: args.tier });

    // Propagate tier to all current members
    const memberships = await ctx.db
      .query("keyMemberships")
      .withIndex("by_key", (q) => q.eq("keyId", args.keyId))
      .collect();

    for (const m of memberships) {
      const member = await ctx.db.get(m.userId);
      if (member && member.appliedLicenseKeyId === args.keyId) {
        await ctx.db.patch(m.userId, { subscriptionTier: args.tier });
      }
    }
  },
});

// ── Team admin: Transfer admin role to another member ─────────────────────────

export const transferAdmin = mutation({
  args: {
    keyId: v.id("licenseKeys"),
    newAdminUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const key = await ctx.db.get(args.keyId);
    if (!key) throw new ConvexError({ code: "NOT_FOUND", message: "Key not found" });

    const currentAdmin = key.adminUserId ?? key.createdBy;
    if (currentAdmin !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the team admin can transfer admin rights" });
    }

    // New admin must be an active member of this team
    const memberships = await ctx.db
      .query("keyMemberships")
      .withIndex("by_key", (q) => q.eq("keyId", args.keyId))
      .collect();
    const isMember = memberships.some((m) => m.userId === args.newAdminUserId);
    if (!isMember) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User is not a member of this team" });
    }

    await ctx.db.patch(args.keyId, { adminUserId: args.newAdminUserId });
  },
});

// ── Team admin: Remove (kick) a member from the team ──────────────────────────

export const kickMember = mutation({
  args: {
    keyId: v.id("licenseKeys"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });

    const caller = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!caller) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const key = await ctx.db.get(args.keyId);
    if (!key) throw new ConvexError({ code: "NOT_FOUND", message: "Key not found" });

    // Only the current admin can kick members
    const currentAdmin = key.adminUserId ?? key.createdBy;
    if (currentAdmin !== caller._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the team admin can remove members" });
    }

    // Cannot kick yourself — use removeKey for that
    if (args.targetUserId === caller._id) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Use 'Leave team' to remove yourself" });
    }

    // Verify the target is actually a member
    const membership = await ctx.db
      .query("keyMemberships")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .filter((q) => q.eq(q.field("keyId"), args.keyId))
      .unique();
    if (!membership) throw new ConvexError({ code: "NOT_FOUND", message: "User is not a member of this team" });

    // Remove their membership
    await ctx.db.delete(membership._id);

    // Revert the user's tier / key link
    const target = await ctx.db.get(args.targetUserId);
    if (target && target.appliedLicenseKeyId === args.keyId) {
      await ctx.db.patch(args.targetUserId, {
        appliedLicenseKeyId: undefined,
        subscriptionTier: "free",
      });
    }
  },
});

// ── Admin: Delete an orphaned (0-member) license key ─────────────────────────

export const deleteKey = mutation({
  args: { keyId: v.id("licenseKeys") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const key = await ctx.db.get(args.keyId);
    if (!key) throw new ConvexError({ code: "NOT_FOUND", message: "Key not found" });

    const memberships = await ctx.db
      .query("keyMemberships")
      .withIndex("by_key", (q) => q.eq("keyId", args.keyId))
      .collect();

    if (memberships.length > 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Cannot delete a key that still has members. Remove all members first.",
      });
    }

    await ctx.db.delete(args.keyId);
  },
});

// ── Internal: get a key by ID (used by PayPal actions) ───────────────────────

// Note: This is a read-only query exposed as internalQuery so Actions can use ctx.runQuery
export const _getKeyById = internalQuery({
  args: { keyId: v.id("licenseKeys") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.keyId);
  },
});

// ── Internal: find self-created key by admin user ID ──────────────────────────

export const _getSelfCreatedKeyByAdmin = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Find a self-created key where this user is the admin
    const keys = await ctx.db
      .query("licenseKeys")
      .withIndex("by_creator", (q) => q.eq("createdBy", args.userId))
      .collect();
    // Also check keys where adminUserId was transferred
    const allKeys = await ctx.db.query("licenseKeys").collect();
    const transferred = allKeys.filter(
      (k) => k.adminUserId === args.userId && k.createdBy !== args.userId
    );
    const candidates = [...keys, ...transferred];
    return candidates.find((k) => k.selfCreated && k.status === "active") ?? null;
  },
});

// ── Internal: store a pending seat count before PayPal approval redirect ──────
// reviseSubscriptionSeats writes here so the seat count lives in the DB,
// not in client-controlled sessionStorage.
export const _setPendingMaxMembers = internalMutation({
  args: { keyId: v.id("licenseKeys"), pendingMaxMembers: v.number() },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.keyId);
    if (!key) return;
    await ctx.db.patch(args.keyId, { pendingMaxMembers: args.pendingMaxMembers });
  },
});

// ── Internal: set/apply pending tier (used by PayPal tier revision flow) ──────

export const clearPendingTier = mutation({
  args: { keyId: v.id("licenseKeys") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return;
    const key = await ctx.db.get(args.keyId);
    if (!key) return;
    const currentAdmin = key.adminUserId ?? key.createdBy;
    if (currentAdmin !== user._id) return;
    if (key.pendingTier) {
      await ctx.db.patch(args.keyId, { pendingTier: undefined });
    }
  },
});

export const _setPendingTier = internalMutation({
  args: { keyId: v.id("licenseKeys"), pendingTier: v.union(v.literal("pro"), v.literal("business")) },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.keyId);
    if (!key) return;
    await ctx.db.patch(args.keyId, { pendingTier: args.pendingTier });
  },
});

export const _applyPendingTier = internalMutation({
  args: { keyId: v.id("licenseKeys"), tier: v.union(v.literal("pro"), v.literal("business")) },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.keyId);
    if (!key) return;

    // Update the key tier and clear the pending marker
    await ctx.db.patch(args.keyId, { tier: args.tier, pendingTier: undefined });

    // Propagate tier to all current members
    const memberships = await ctx.db
      .query("keyMemberships")
      .withIndex("by_key", (q) => q.eq("keyId", args.keyId))
      .collect();

    for (const m of memberships) {
      const member = await ctx.db.get(m.userId);
      if (member && member.appliedLicenseKeyId === args.keyId) {
        await ctx.db.patch(m.userId, { subscriptionTier: args.tier });
      }
    }
  },
});

// ── Internal: update maxMembers directly (used by PayPal revise flow) ─────────

export const _applyPendingSeats = internalMutation({
  args: { keyId: v.id("licenseKeys"), maxMembers: v.number() },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.keyId);
    if (!key) return;
    // Apply seat count and clear the pending marker in one atomic write
    await ctx.db.patch(args.keyId, { maxMembers: args.maxMembers, pendingMaxMembers: undefined });
  },
});

// ── Internal: suspend key for payment failure (14-day grace period) ────────────
// Members stay attached and keep their tier (read-only mode).
// A scheduled job auto-expires the key after 14 days if payment isn't resolved.

const GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export const _suspendKeyForPaymentFailure = internalMutation({
  args: { keyId: v.id("licenseKeys") },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.keyId);
    if (!key || key.status === "suspended") return;

    // Schedule auto-expiry after grace period
    const scheduledId = await ctx.scheduler.runAfter(
      GRACE_PERIOD_MS,
      internal.licenseKeys._expireKey,
      { keyId: args.keyId }
    );

    await ctx.db.patch(args.keyId, {
      status: "suspended",
      suspendedAt: new Date().toISOString(),
      suspendedReason: "payment_failed",
      gracePeriodScheduledId: scheduledId,
    });
  },
});

// ── Internal: reactivate a suspended key (payment resolved) ───────────────────
// Clears suspension state and cancels the scheduled auto-expiry.

export const _reactivateKey = internalMutation({
  args: { keyId: v.id("licenseKeys") },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.keyId);
    if (!key || key.status === "active") return;

    // Cancel the scheduled auto-expiry if it exists
    if (key.gracePeriodScheduledId) {
      try {
        await ctx.scheduler.cancel(key.gracePeriodScheduledId);
      } catch {
        // Already fired or cancelled — safe to ignore
      }
    }

    await ctx.db.patch(args.keyId, {
      status: "active",
      suspendedAt: undefined,
      suspendedReason: undefined,
      gracePeriodScheduledId: undefined,
    });
  },
});

// ── Internal: fully expire key — remove all members and delete (admin cancel / grace period end) ─

export const _expireKey = internalMutation({
  args: { keyId: v.id("licenseKeys") },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.keyId);
    if (!key) return;

    // Safety net: if the key was reactivated before the scheduled expiry fired, skip
    if (key.status === "active") return;

    await ctx.db.patch(args.keyId, { status: "suspended" });

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

    // Auto-delete expired keys with no remaining members
    await ctx.db.delete(args.keyId);
  },
});
