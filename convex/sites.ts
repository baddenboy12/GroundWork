import { v, ConvexError } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel.d.ts";

// ── Queries ───────────────────────────────────────────────────────────────────

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

    if (user.appliedLicenseKeyId) {
      // ── Team mode: show ONLY sites tagged with this team key ──────────────
      const teamSiteDocs = await ctx.db
        .query("sites")
        .withIndex("by_team_key", (q) => q.eq("teamKeyId", user.appliedLicenseKeyId!))
        .collect();

      const enriched = await Promise.all(
        teamSiteDocs.map(async (s) => {
          const owner = await ctx.db.get(s.ownerId);
          return {
            ...s,
            isOwner: s.ownerId === user._id,
            ownerName: s.ownerId === user._id ? (user.name ?? "You") : (owner?.name ?? "Teammate"),
          };
        })
      );
      return enriched.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    } else {
      // ── Personal mode: show ONLY own sites that have no team tag ──────────
      const ownSites = await ctx.db
        .query("sites")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .order("asc")
        .collect();

      return ownSites
        .filter((s) => s.teamKeyId === undefined)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        .map((s) => ({
          ...s,
          isOwner: true,
          ownerName: user.name ?? "You",
        }));
    }
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

    // Block creation if team key is suspended due to payment failure
    if (user.appliedLicenseKeyId) {
      const key = await ctx.db.get(user.appliedLicenseKeyId);
      if (key && key.status === "suspended" && key.suspendedReason === "payment_failed") {
        throw new ConvexError({
          code: "PAYMENT_SUSPENDED",
          message: "Your team subscription payment has failed. New content creation is disabled until payment is resolved.",
        });
      }
    }

    // Enforce per-tier site limit (mode-aware: team or personal)
    const tier = user.subscriptionTier ?? "free";
    const siteLimits: Record<string, number | null> = { free: 1, pro: 15, business: null };
    const siteLimit = tier in siteLimits ? siteLimits[tier] : 1;
    if (siteLimit !== null) {
      let existingCount = 0;
      if (user.appliedLicenseKeyId) {
        const teamSites = await ctx.db
          .query("sites")
          .withIndex("by_team_key", (q) => q.eq("teamKeyId", user.appliedLicenseKeyId!))
          .collect();
        existingCount = teamSites.length;
      } else {
        const ownSites = await ctx.db
          .query("sites")
          .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
          .collect();
        existingCount = ownSites.filter((s) => s.teamKeyId === undefined).length;
      }
      if (existingCount >= siteLimit) {
        throw new ConvexError({
          message: `Site limit reached for your plan. Upgrade to add more sites.`,
          code: "FORBIDDEN",
        });
      }
    }

    return await ctx.db.insert("sites", {
      name: args.name,
      description: args.description,
      location: args.location,
      latitude: args.latitude,
      longitude: args.longitude,
      ownerId: user._id,
      // Tag with team key so teammates can see it
      teamKeyId: user.appliedLicenseKeyId,
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
    // Only the site owner can rename/edit it
    if (site.ownerId !== user._id) throw new ConvexError({ message: "Only the site owner can edit it", code: "FORBIDDEN" });
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

    let existing: Doc<"sites"> | undefined;

    if (user.appliedLicenseKeyId) {
      // Team mode: search only team sites
      const teamSites = await ctx.db
        .query("sites")
        .withIndex("by_team_key", (q) => q.eq("teamKeyId", user.appliedLicenseKeyId!))
        .collect();
      existing = teamSites.find((s) => s.name.toLowerCase() === trimmedName.toLowerCase());
    } else {
      // Personal mode: search only personal sites (no teamKeyId)
      const allOwnSites = await ctx.db
        .query("sites")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect();
      existing = allOwnSites.filter((s) => s.teamKeyId === undefined).find(
        (s) => s.name.toLowerCase() === trimmedName.toLowerCase()
      );
    }

    if (existing) {
      // Backfill location/coords if the site doesn't have them yet
      const patch: Record<string, string | number> = {};
      if (args.location && !existing.location) patch.location = args.location;
      if (args.latitude != null && existing.latitude == null) patch.latitude = args.latitude;
      if (args.longitude != null && existing.longitude == null) patch.longitude = args.longitude;
      if (Object.keys(patch).length > 0) await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    // Block creation if team key is suspended due to payment failure
    if (user.appliedLicenseKeyId) {
      const key = await ctx.db.get(user.appliedLicenseKeyId);
      if (key && key.status === "suspended" && key.suspendedReason === "payment_failed") {
        throw new ConvexError({
          code: "PAYMENT_SUSPENDED",
          message: "Your team subscription payment has failed. New content creation is disabled until payment is resolved.",
        });
      }
    }

    // Check tier limit before creating a new site
    const tier = user.subscriptionTier ?? "free";
    const limits: Record<string, number | null> = {
      free: 1,
      pro: 15,
      business: null,
    };
    const limit = tier in limits ? limits[tier] : 1;
    if (limit !== null) {
      // Count sites in the current mode (team or personal)
      let currentCount = 0;
      if (user.appliedLicenseKeyId) {
        const teamSites = await ctx.db
          .query("sites")
          .withIndex("by_team_key", (q) => q.eq("teamKeyId", user.appliedLicenseKeyId!))
          .collect();
        currentCount = teamSites.length;
      } else {
        const ownSites = await ctx.db
          .query("sites")
          .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
          .collect();
        currentCount = ownSites.filter((s) => s.teamKeyId === undefined).length;
      }
      if (currentCount >= limit) {
        throw new ConvexError({
          message: `Site limit reached for your plan. Upgrade to add more sites.`,
          code: "FORBIDDEN",
        });
      }
    }

    return await ctx.db.insert("sites", {
      name: trimmedName,
      location: args.location,
      latitude: args.latitude,
      longitude: args.longitude,
      ownerId: user._id,
      teamKeyId: user.appliedLicenseKeyId,
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
    // Team sites require unanimous team vote — use the siteDeleteVotes flow
    if (site.teamKeyId) {
      throw new ConvexError({
        message: "Team sites must be deleted through the team voting process.",
        code: "FORBIDDEN",
      });
    }
    if (site.ownerId !== user._id) throw new ConvexError({ message: "Only the site owner can delete it", code: "FORBIDDEN" });
    // Delete all logs for this site, cleaning up R2 photos and storage counters
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
      await ctx.scheduler.runAfter(0, internal.r2.storageActions.deletePhotosFromR2, {
        keys: allR2Keys,
      });
    }

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

// ── Internal: delete a site by ID (used by team vote execution) ──────────────
export const _deleteByIdInternal = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site) return; // Already deleted

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
      await ctx.scheduler.runAfter(0, internal.r2.storageActions.deletePhotosFromR2, {
        keys: allR2Keys,
      });
    }

    if (totalFreedBytes > 0) {
      const owner = await ctx.db.get(site.ownerId);
      if (owner) {
        await ctx.db.patch(site.ownerId, {
          storageUsedBytes: Math.max(0, (owner.storageUsedBytes ?? 0) - totalFreedBytes),
        });
      }
    }

    await ctx.db.delete(args.siteId);
  },
});
