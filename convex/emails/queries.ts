import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

/**
 * Resolve email addresses for all members of a team key,
 * optionally excluding one user (e.g. the action's initiator).
 */
export const getTeamEmails = internalQuery({
  args: {
    teamKeyId: v.id("licenseKeys"),
    excludeUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, { teamKeyId, excludeUserId }) => {
    const memberships = await ctx.db
      .query("keyMemberships")
      .withIndex("by_key", (q) => q.eq("keyId", teamKeyId))
      .collect();

    const results = await Promise.all(
      memberships
        .filter((m) => m.userId !== excludeUserId)
        .map(async (m) => {
          const user = await ctx.db.get(m.userId);
          return user?.email ? { userId: m.userId, email: user.email, name: user.name ?? "Teammate" } : null;
        })
    );

    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

/**
 * Resolve name + email for a single user.
 */
export const getUserInfo = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    return user ? { name: user.name ?? "Teammate", email: user.email ?? null } : null;
  },
});
