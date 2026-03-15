import { v, ConvexError } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

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
    // Delete all logs for this site, cleaning up R2 photos and storage counters
    const logs = await ctx.db
      .query("logs")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .collect();

    let totalFreedBytes = 0;
    const allR2Keys: string[] = [];

    for (const log of logs) {
      // Collect R2 photo keys for bulk deletion
      if (log.photos?.length) {
        for (const photo of log.photos) {
          allR2Keys.push(photo.key);
          totalFreedBytes += photo.bytes;
        }
      }
      // Legacy Convex storage cleanup
      if (log.photoStorageIds?.length) {
        for (const storageId of log.photoStorageIds) {
          await ctx.storage.delete(storageId);
        }
      }
      await ctx.db.delete(log._id);
    }

    // Schedule bulk R2 deletion (best-effort, non-blocking)
    if (allR2Keys.length > 0) {
      await ctx.scheduler.runAfter(0, internal.r2.storageActions.deletePhotosFromR2, {
        keys: allR2Keys,
      });
    }

    // Decrement the user's storage counter
    if (totalFreedBytes > 0) {
      await ctx.db.patch(user._id, {
        storageUsedBytes: Math.max(0, (user.storageUsedBytes ?? 0) - totalFreedBytes),
      });
    }

    await ctx.db.delete(args.siteId);
  },
});

// ── Internal: get a single site by ID, checking ownership ────────────────────
export const _getByIdForApi = internalQuery({
  args: { siteId: v.id("sites"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site || site.ownerId !== args.userId) return null;
    return site;
  },
});

// ── Internal: create a site (used by REST API) ────────────────────────────────
export const _createFromApi = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const trimmedName = args.name.trim();
    if (!trimmedName) throw new ConvexError({ message: "Site name is required", code: "BAD_REQUEST" });
    return await ctx.db.insert("sites", {
      name: trimmedName,
      description: args.description,
      location: args.location,
      latitude: args.latitude,
      longitude: args.longitude,
      ownerId: args.userId,
    });
  },
});

// ── Internal: update a site (used by REST API) ────────────────────────────────
export const _updateFromApi = internalMutation({
  args: {
    siteId: v.id("sites"),
    userId: v.id("users"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site || site.ownerId !== args.userId) {
      throw new ConvexError({ message: "Site not found", code: "NOT_FOUND" });
    }
    await ctx.db.patch(args.siteId, {
      ...(args.name !== undefined && { name: args.name.trim() }),
      ...(args.description !== undefined && { description: args.description }),
      ...(args.location !== undefined && { location: args.location }),
      ...(args.latitude !== undefined && { latitude: args.latitude }),
      ...(args.longitude !== undefined && { longitude: args.longitude }),
    });
  },
});

// ── Internal: delete a site and all its logs (used by REST API) ───────────────
export const _deleteFromApi = internalMutation({
  args: { siteId: v.id("sites"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site || site.ownerId !== args.userId) {
      throw new ConvexError({ message: "Site not found", code: "NOT_FOUND" });
    }
    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    const logs = await ctx.db
      .query("logs")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .collect();

    let totalFreedBytes = 0;
    const allR2Keys: string[] = [];

    for (const log of logs) {
      if (log.photos?.length) {
        for (const photo of log.photos) {
          allR2Keys.push(photo.key);
          totalFreedBytes += photo.bytes;
        }
      }
      if (log.photoStorageIds?.length) {
        for (const storageId of log.photoStorageIds) {
          await ctx.storage.delete(storageId);
        }
      }
      await ctx.db.delete(log._id);
    }

    if (allR2Keys.length > 0) {
      await ctx.scheduler.runAfter(0, internal.r2.storageActions.deletePhotosFromR2, { keys: allR2Keys });
    }
    if (totalFreedBytes > 0) {
      await ctx.db.patch(user._id, {
        storageUsedBytes: Math.max(0, (user.storageUsedBytes ?? 0) - totalFreedBytes),
      });
    }
    await ctx.db.delete(args.siteId);
  },
});

// ── Internal: list all sites owned by a user (used by REST API) ─────────────
export const _listByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sites")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .order("asc")
      .collect();
  },
});
