import { v } from "convex/values";
import { mutation } from "./_generated/server";

/** Register a push notification token for the current user. */
export const register = mutation({
  args: {
    token: v.string(),
    platform: v.union(v.literal("android"), v.literal("web")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return;

    // Check if this token is already registered
    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (existing) {
      // Update ownership if the token moved to a different user
      if (existing.userId !== user._id) {
        await ctx.db.patch(existing._id, { userId: user._id });
      }
      return;
    }

    await ctx.db.insert("pushTokens", {
      userId: user._id,
      token: args.token,
      platform: args.platform,
      createdAt: new Date().toISOString(),
    });
  },
});

/** Unregister a push notification token (e.g. on logout). */
export const unregister = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
