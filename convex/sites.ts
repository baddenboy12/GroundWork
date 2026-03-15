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
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
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
      latitude: args.latitude,
      longitude: args.longitude,
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
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
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
      latitude: args.latitude,
      longitude: args.longitude,
    });
  },
});

export const findOrCreate = mutation({
  args: {
    name: v.string(),
    location: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const trimmedName = args.name.trim();
    if (!trimmedName) throw new ConvexError({ message: "Site name cannot be empty", code: "BAD_REQUEST" });

    // Case-insensitive match against existing sites
    const allSites = await ctx.db
      .query("sites")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    const existing = allSites.find(
      (s) => s.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existing) {
      // Backfill location/coords if the site doesn't have them yet
      const patch: Record<string, string | number> = {};
      if (args.location && !existing.location) patch.location = args.location;
      if (args.latitude != null && existing.latitude == null) patch.latitude = args.latitude;
      if (args.longitude != null && existing.longitude == null) patch.longitude = args.longitude;
      if (Object.keys(patch).length > 0) await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    // Check tier limit before creating a new site
    const tier = user.subscriptionTier ?? "free";
    const limits: Record<string, number | null> = {
      free: 2,
      starter: 15,
      pro: null,
      business: null,
    };
    const limit = limits[tier] ?? 2;
    if (limit !== null && allSites.length >= limit) {
      throw new ConvexError({
        message: `Site limit reached for your plan. Upgrade to add more sites.`,
        code: "FORBIDDEN",
      });
    }

    return await ctx.db.insert("sites", {
      name: trimmedName,
      location: args.location,
      latitude: args.latitude,
      longitude: args.longitude,
      ownerId: user._id,
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
