import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];
    return await ctx.db
      .query("sites")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("asc")
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    return await ctx.db.insert("sites", {
      name: args.name,
      description: args.description,
      location: args.location,
      ownerId: user._id,
    });
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    name: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    const site = await ctx.db.get(args.siteId);
    if (!site) throw new ConvexError({ message: "Site not found", code: "NOT_FOUND" });
    if (site.ownerId !== user._id) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
    await ctx.db.patch(args.siteId, {
      name: args.name,
      description: args.description,
      location: args.location,
    });
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    const site = await ctx.db.get(args.siteId);
    if (!site) throw new ConvexError({ message: "Site not found", code: "NOT_FOUND" });
    if (site.ownerId !== user._id) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
    // Delete all logs for this site first
    const logs = await ctx.db
      .query("logs")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .collect();
    for (const log of logs) {
      await ctx.db.delete(log._id);
    }
    await ctx.db.delete(args.siteId);
  },
});
