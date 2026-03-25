import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Log a client-side error (authenticated user). */
export const logError = mutation({
  args: {
    message: v.string(),
    stack: v.optional(v.string()),
    componentStack: v.optional(v.string()),
    url: v.string(),
    userAgent: v.string(),
    platform: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const user = identity
      ? await ctx.db
          .query("users")
          .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
          .unique()
      : null;

    await ctx.db.insert("clientErrors", {
      userId: user?._id,
      message: args.message.slice(0, 2000),
      stack: args.stack?.slice(0, 4000),
      componentStack: args.componentStack?.slice(0, 4000),
      url: args.url.slice(0, 500),
      userAgent: args.userAgent.slice(0, 500),
      platform: args.platform,
      timestamp: new Date().toISOString(),
    });
  },
});

/** Log a client-side error (anonymous — for pre-auth crashes). */
export const logErrorAnonymous = mutation({
  args: {
    message: v.string(),
    stack: v.optional(v.string()),
    componentStack: v.optional(v.string()),
    url: v.string(),
    userAgent: v.string(),
    platform: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("clientErrors", {
      message: args.message.slice(0, 2000),
      stack: args.stack?.slice(0, 4000),
      componentStack: args.componentStack?.slice(0, 4000),
      url: args.url.slice(0, 500),
      userAgent: args.userAgent.slice(0, 500),
      platform: args.platform,
      timestamp: new Date().toISOString(),
    });
  },
});

/** Admin-only: list recent client errors. */
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "super_admin") return [];

    return ctx.db
      .query("clientErrors")
      .order("desc")
      .take(args.limit ?? 50);
  },
});
