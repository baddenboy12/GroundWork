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

    // Allow super-admin or any team member to toggle status
    const adminEmail = process.env.ADMIN_EMAIL;
    const isSuperAdmin = adminEmail && (identity.email ?? "").toLowerCase() === adminEmail.toLowerCase();
    const isTeamMember = user.appliedLicenseKeyId === args.keyId;

    if (!isSuperAdmin && !isTeamMember) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only a team member or admin can change status" });
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

    // No member cap — just join
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
      // Detach all team sites (they become personal to their respective owners)
      const teamSites = await ctx.db
        .query("sites")
        .withIndex("by_team_key", (q) => q.eq("teamKeyId", keyId))
        .collect();
      for (const site of teamSites) {
        await ctx.db.patch(site._id, { teamKeyId: undefined });
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

    return {
      keyId: key._id,
      code: key.code,
      tier: key.tier,
      status: key.status,
      memberCount: memberships.length,
      members,
      adminUserId: key.adminUserId ?? key.createdBy,
      isAdmin: (key.adminUserId ?? key.createdBy) === user._id,
      selfCreated: key.selfCreated ?? false,
    };
  },
});

// ── User: Self-service create a team key (requires active subscription) ───────

export const createSelfKey = mutation({
  args: {
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

    if (user.appliedLicenseKeyId) {
      throw new ConvexError({ code: "CONFLICT", message: "You already have a team key. Remove it first." });
    }

    // Generate a unique code
    let code = generateKeyCode();
    const existing = await ctx.db
      .query("licenseKeys")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (existing) code = generateKeyCode();

    const keyId = await ctx.db.insert("licenseKeys", {
      code,
      createdBy: user._id,
      adminUserId: user._id,
      tier: args.tier,
      status: "active",
      note: `Team — ${user.name ?? user.email ?? "subscriber"}`,
      selfCreated: true,
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

// ── Internal: suspend key and remove all members (for PayPal payment failure) ─

export const _expireKey = internalMutation({
  args: { keyId: v.id("licenseKeys") },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.keyId);
    if (!key) return;
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
  },
});
