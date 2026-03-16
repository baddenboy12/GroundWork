import { v, ConvexError } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";
import type { Id } from "./_generated/dataModel.d.ts";

const categoryValidator = v.union(
  v.literal("inspection"),
  v.literal("maintenance"),
  v.literal("incident"),
  v.literal("audit"),
  v.literal("general")
);

// Validator for a single R2 photo object
const photoValidator = v.object({
  url: v.string(),
  key: v.string(),
  bytes: v.number(),
});

/** Resolve photo URLs from a log — uses R2 `photos` if present, falls back to legacy Convex storage */
async function resolvePhotoUrls(
  log: {
    photos?: Array<{ url: string; key: string; bytes: number }>;
    photoStorageIds?: Id<"_storage">[];
  },
  storageGetUrl: (id: Id<"_storage">) => Promise<string | null>
): Promise<string[]> {
  // R2 photos take priority
  if (log.photos?.length) {
    return log.photos.map((p) => p.url);
  }
  // Legacy Convex storage fallback
  if (log.photoStorageIds?.length) {
    const urls = await Promise.all(
      log.photoStorageIds.map((id) => storageGetUrl(id))
    );
    return urls.filter((u): u is string => u !== null);
  }
  return [];
}

// ── Queries ──────────────────────────────────────────────────────────────────

export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];

    const logs = await ctx.db
      .query("logs")
      .withIndex("by_author", (q) => q.eq("authorId", user._id))
      .order("desc")
      .take(args.limit ?? 12);

    return await Promise.all(
      logs.map(async (log) => {
        const site = await ctx.db.get(log.siteId);
        const photoUrls = await resolvePhotoUrls(log, (id) => ctx.storage.getUrl(id));
        return { ...log, siteName: site?.name ?? "Unknown site", photoUrls };
      })
    );
  },
});

/** Filter recent logs by category/date without a text query */
export const listRecentFiltered = query({
  args: {
    category: v.optional(categoryValidator),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];

    let logs = await ctx.db
      .query("logs")
      .withIndex("by_author", (q) => q.eq("authorId", user._id))
      .order("desc")
      .collect();

    if (args.category) {
      logs = logs.filter((l) => l.category === args.category);
    }
    if (args.dateFrom) {
      const from = new Date(args.dateFrom).toISOString();
      logs = logs.filter((l) => l.loggedAt >= from);
    }
    if (args.dateTo) {
      const to = new Date(args.dateTo + "T23:59:59.999Z").toISOString();
      logs = logs.filter((l) => l.loggedAt <= to);
    }

    logs = logs.slice(0, args.limit ?? 50);

    return await Promise.all(
      logs.map(async (log) => {
        const site = await ctx.db.get(log.siteId);
        const photoUrls = await resolvePhotoUrls(log, (id) => ctx.storage.getUrl(id));
        return { ...log, siteName: site?.name ?? "Unknown site", photoUrls };
      })
    );
  },
});

/** Full-text search across all user logs with optional category/date filters */
export const searchAllLogs = query({
  args: {
    query: v.string(),
    category: v.optional(categoryValidator),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];

    let results = await ctx.db
      .query("logs")
      .withSearchIndex("search_title_global", (q) => {
        const base = q.search("title", args.query).eq("authorId", user._id);
        return args.category ? base.eq("category", args.category) : base;
      })
      .take(100);

    if (args.dateFrom) {
      const from = new Date(args.dateFrom).toISOString();
      results = results.filter((l) => l.loggedAt >= from);
    }
    if (args.dateTo) {
      const to = new Date(args.dateTo + "T23:59:59.999Z").toISOString();
      results = results.filter((l) => l.loggedAt <= to);
    }

    return await Promise.all(
      results.map(async (log) => {
        const site = await ctx.db.get(log.siteId);
        const photoUrls = await resolvePhotoUrls(log, (id) => ctx.storage.getUrl(id));
        return { ...log, siteName: site?.name ?? "Unknown site", photoUrls };
      })
    );
  },
});

export const listBySite = query({
  args: {
    siteId: v.id("sites"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

    const site = await ctx.db.get(args.siteId);
    if (!site) return { page: [], isDone: true, continueCursor: args.paginationOpts.cursor ?? "" };

    const results = await ctx.db
      .query("logs")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...results,
      page: await Promise.all(
        results.page.map(async (log) => {
          const author = await ctx.db.get(log.authorId);
          const photoUrls = await resolvePhotoUrls(log, (id) => ctx.storage.getUrl(id));
          return { ...log, authorName: author?.name ?? "Unknown", photoUrls };
        })
      ),
    };
  },
});

export const searchBySite = query({
  args: {
    siteId: v.id("sites"),
    query: v.string(),
    category: v.optional(categoryValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

    const results = await ctx.db
      .query("logs")
      .withSearchIndex("search_title", (q) => {
        const base = q.search("title", args.query).eq("siteId", args.siteId);
        return args.category ? base.eq("category", args.category) : base;
      })
      .take(100);

    return await Promise.all(
      results.map(async (log) => {
        const author = await ctx.db.get(log.authorId);
        const photoUrls = await resolvePhotoUrls(log, (id) => ctx.storage.getUrl(id));
        return { ...log, authorName: author?.name ?? "Unknown", photoUrls };
      })
    );
  },
});

export const get = query({
  args: { logId: v.id("logs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const log = await ctx.db.get(args.logId);
    if (!log) return null;
    const author = await ctx.db.get(log.authorId);
    const photoUrls = await resolvePhotoUrls(log, (id) => ctx.storage.getUrl(id));
    return { ...log, authorName: author?.name ?? "Unknown", photoUrls };
  },
});

// ── Mutations ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    title: v.string(),
    content: v.string(),
    category: categoryValidator,
    loggedAt: v.string(),
    // R2 photos
    photos: v.optional(v.array(photoValidator)),
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

    // Enforce per-tier photo limit per entry
    const photoLimits: Record<string, number> = {
      free: 5,
      starter: 5,
      pro: 5,
      business: 20,
    };
    const maxPhotos = photoLimits[user.subscriptionTier ?? "free"] ?? 5;
    if ((args.photos?.length ?? 0) > maxPhotos) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Maximum ${maxPhotos} photos per entry on your plan.`,
      });
    }

    // Enforce per-tier log limit per site
    const logLimits: Record<string, number | null> = {
      free: 1,
      starter: null,
      pro: null,
      business: null,
    };
    const maxLogs = logLimits[user.subscriptionTier ?? "free"] ?? null;
    if (maxLogs !== null) {
      const existingCount = await ctx.db
        .query("logs")
        .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
        .collect()
        .then((l) => l.length);
      if (existingCount >= maxLogs) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: `Entry limit reached for your plan. Upgrade to add more entries.`,
        });
      }
    }

    const logId = await ctx.db.insert("logs", {
      siteId: args.siteId,
      title: args.title,
      content: args.content,
      category: args.category,
      authorId: user._id,
      loggedAt: args.loggedAt,
      location: args.location,
      latitude: args.latitude,
      longitude: args.longitude,
      photos: args.photos,
    });

    // Fire webhook delivery for Business-plan users
    if ((user.subscriptionTier ?? "free") === "business") {
      await ctx.scheduler.runAfter(0, internal.integrations.webhookActions.deliver, {
        userId: user._id,
        event: "log.created",
        logId,
        siteName: site.name,
      });
    }
    return logId;
  },
});

export const update = mutation({
  args: {
    logId: v.id("logs"),
    siteId: v.optional(v.id("sites")),
    title: v.string(),
    content: v.string(),
    category: categoryValidator,
    loggedAt: v.string(),
    // R2 photos (preserved from existing log — edit dialog doesn't allow photo changes)
    photos: v.optional(v.array(photoValidator)),
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
    const log = await ctx.db.get(args.logId);
    if (!log) throw new ConvexError({ message: "Log not found", code: "NOT_FOUND" });
    if (log.authorId !== user._id) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });

    // If changing site, verify the new site belongs to the user
    if (args.siteId && args.siteId !== log.siteId) {
      const newSite = await ctx.db.get(args.siteId);
      if (!newSite || newSite.ownerId !== user._id) {
        throw new ConvexError({ message: "Site not found", code: "NOT_FOUND" });
      }
    }

    await ctx.db.patch(args.logId, {
      ...(args.siteId ? { siteId: args.siteId } : {}),
      title: args.title,
      content: args.content,
      category: args.category,
      loggedAt: args.loggedAt,
      location: args.location,
      latitude: args.latitude,
      longitude: args.longitude,
      photos: args.photos,
    });
  },
});

export const remove = mutation({
  args: { logId: v.id("logs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    const log = await ctx.db.get(args.logId);
    if (!log) throw new ConvexError({ message: "Log not found", code: "NOT_FOUND" });
    if (log.authorId !== user._id) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });

    // Decrement storage counter for R2 photos
    const photoBytes = log.photos?.reduce((s, p) => s + p.bytes, 0) ?? 0;
    if (photoBytes > 0) {
      await ctx.db.patch(user._id, {
        storageUsedBytes: Math.max(0, (user.storageUsedBytes ?? 0) - photoBytes),
      });
    }

    // Schedule R2 deletion (best-effort, non-blocking)
    if (log.photos?.length) {
      await ctx.scheduler.runAfter(0, internal.r2.storageActions.deletePhotosFromR2, {
        keys: log.photos.map((p) => p.key),
      });
    }

    // Legacy Convex storage cleanup
    if (log.photoStorageIds?.length) {
      for (const storageId of log.photoStorageIds) {
        await ctx.storage.delete(storageId);
      }
    }

    await ctx.db.delete(args.logId);
  },
});

// ── Public: fetch logs for export ────────────────────────────────────────────

export const listBySiteForExport = query({
  args: {
    siteId: v.id("sites"),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
    category: v.optional(categoryValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

    const site = await ctx.db.get(args.siteId);
    if (!site) return [];

    const all = await ctx.db
      .query("logs")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .order("desc")
      .take(500);

    const filtered = all.filter((log) => {
      if (args.category && log.category !== args.category) return false;
      if (args.dateFrom) {
        if (new Date(log.loggedAt) < new Date(args.dateFrom + "T00:00:00.000Z")) return false;
      }
      if (args.dateTo) {
        if (new Date(log.loggedAt) > new Date(args.dateTo + "T23:59:59.999Z")) return false;
      }
      return true;
    });

    return await Promise.all(
      filtered.map(async (log) => {
        const author = await ctx.db.get(log.authorId);
        const photoUrls = await resolvePhotoUrls(log, (id) => ctx.storage.getUrl(id));
        return { ...log, authorName: author?.name ?? "Unknown", photoUrls };
      })
    );
  },
});

/** Fetch logs across multiple sites for the global dashboard export */
export const listForGlobalExport = query({
  args: {
    siteIds: v.optional(v.array(v.id("sites"))), // empty = all user sites
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
    category: v.optional(categoryValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const allSites = await ctx.db
      .query("sites")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();

    const targetSites =
      args.siteIds && args.siteIds.length > 0
        ? allSites.filter((s) => (args.siteIds as Id<"sites">[]).includes(s._id))
        : allSites;

    const collectedLogs: Array<{
      _id: Id<"logs">;
      siteId: Id<"sites">;
      siteName: string;
      title: string;
      content: string;
      category: string;
      authorId: Id<"users">;
      loggedAt: string;
      location?: string;
      latitude?: number;
      longitude?: number;
      authorName: string;
      photoUrls: string[];
      _creationTime: number;
    }> = [];

    for (const site of targetSites) {
      const siteLogs = await ctx.db
        .query("logs")
        .withIndex("by_site", (q) => q.eq("siteId", site._id))
        .order("desc")
        .collect();

      for (const log of siteLogs) {
        if (args.category && log.category !== args.category) continue;
        if (args.dateFrom && new Date(log.loggedAt) < new Date(args.dateFrom + "T00:00:00.000Z")) continue;
        if (args.dateTo && new Date(log.loggedAt) > new Date(args.dateTo + "T23:59:59.999Z")) continue;

        const author = await ctx.db.get(log.authorId);
        const photoUrls = await resolvePhotoUrls(log, (id) => ctx.storage.getUrl(id));
        collectedLogs.push({
          ...log,
          siteName: site.name,
          authorName: author?.name ?? "Unknown",
          photoUrls,
        });
      }
    }

    // Sort by loggedAt descending and cap at 1000
    collectedLogs.sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
    return collectedLogs.slice(0, 1000);
  },
});

// ── Internal helpers ──────────────────────────────────────────────────────────

export const _getForWebhook = internalQuery({
  args: { logId: v.id("logs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.logId);
  },
});

export const _listBySiteForApi = internalQuery({
  args: {
    siteId: v.id("sites"),
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site || site.ownerId !== args.userId) return null;

    const logs = await ctx.db
      .query("logs")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .order("desc")
      .take(args.limit ?? 50);

    return logs.map((log) => ({
      id: log._id,
      siteId: log.siteId,
      title: log.title,
      content: log.content,
      category: log.category,
      loggedAt: log.loggedAt,
      location: log.location ?? null,
      latitude: log.latitude ?? null,
      longitude: log.longitude ?? null,
      createdAt: new Date(log._creationTime).toISOString(),
    }));
  },
});

export const _createFromApi = internalMutation({
  args: {
    siteId: v.id("sites"),
    authorId: v.id("users"),
    title: v.string(),
    content: v.string(),
    category: v.union(
      v.literal("inspection"),
      v.literal("maintenance"),
      v.literal("incident"),
      v.literal("audit"),
      v.literal("general")
    ),
    loggedAt: v.string(),
    location: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site || site.ownerId !== args.authorId) {
      throw new ConvexError({ message: "Site not found", code: "NOT_FOUND" });
    }
    const logId = await ctx.db.insert("logs", {
      siteId: args.siteId,
      title: args.title,
      content: args.content,
      category: args.category,
      authorId: args.authorId,
      loggedAt: args.loggedAt,
      location: args.location,
      latitude: args.latitude,
      longitude: args.longitude,
    });
    await ctx.scheduler.runAfter(0, internal.integrations.webhookActions.deliver, {
      userId: args.authorId,
      event: "log.created",
      logId,
      siteName: site.name,
    });
    return logId;
  },
});

// ── Internal: get a single log by ID, checking site ownership ────────────────
export const _getByIdForApi = internalQuery({
  args: { logId: v.id("logs"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.logId);
    if (!log) return null;
    const site = await ctx.db.get(log.siteId);
    if (!site || site.ownerId !== args.userId) return null;
    return {
      id: log._id,
      siteId: log.siteId,
      title: log.title,
      content: log.content,
      category: log.category,
      loggedAt: log.loggedAt,
      location: log.location ?? null,
      latitude: log.latitude ?? null,
      longitude: log.longitude ?? null,
      photoCount: (log.photos?.length ?? 0) + (log.photoStorageIds?.length ?? 0),
      createdAt: new Date(log._creationTime).toISOString(),
    };
  },
});

// ── Internal: update a log (used by REST API) ─────────────────────────────────
export const _updateFromApi = internalMutation({
  args: {
    logId: v.id("logs"),
    userId: v.id("users"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    category: v.optional(categoryValidator),
    loggedAt: v.optional(v.string()),
    location: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.logId);
    if (!log) throw new ConvexError({ message: "Log not found", code: "NOT_FOUND" });
    const site = await ctx.db.get(log.siteId);
    if (!site || site.ownerId !== args.userId) {
      throw new ConvexError({ message: "Log not found or access denied", code: "NOT_FOUND" });
    }
    await ctx.db.patch(args.logId, {
      ...(args.title !== undefined && { title: args.title.trim() }),
      ...(args.content !== undefined && { content: args.content }),
      ...(args.category !== undefined && { category: args.category }),
      ...(args.loggedAt !== undefined && { loggedAt: args.loggedAt }),
      ...(args.location !== undefined && { location: args.location }),
      ...(args.latitude !== undefined && { latitude: args.latitude }),
      ...(args.longitude !== undefined && { longitude: args.longitude }),
    });
  },
});

// ── Internal: delete a log (used by REST API) ─────────────────────────────────
export const _deleteFromApi = internalMutation({
  args: { logId: v.id("logs"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.logId);
    if (!log) throw new ConvexError({ message: "Log not found", code: "NOT_FOUND" });
    const site = await ctx.db.get(log.siteId);
    if (!site || site.ownerId !== args.userId) {
      throw new ConvexError({ message: "Log not found or access denied", code: "NOT_FOUND" });
    }
    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const photoBytes = log.photos?.reduce((s, p) => s + p.bytes, 0) ?? 0;
    if (photoBytes > 0) {
      await ctx.db.patch(user._id, {
        storageUsedBytes: Math.max(0, (user.storageUsedBytes ?? 0) - photoBytes),
      });
    }
    if (log.photos?.length) {
      await ctx.scheduler.runAfter(0, internal.r2.storageActions.deletePhotosFromR2, {
        keys: log.photos.map((p) => p.key),
      });
    }
    if (log.photoStorageIds?.length) {
      for (const storageId of log.photoStorageIds) {
        await ctx.storage.delete(storageId);
      }
    }
    await ctx.db.delete(args.logId);
  },
});

// ── Internal: full-text search within a site for API ─────────────────────────
export const _searchForApi = internalQuery({
  args: {
    siteId: v.id("sites"),
    userId: v.id("users"),
    q: v.string(),
    category: v.optional(categoryValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site || site.ownerId !== args.userId) return null;
    const results = await ctx.db
      .query("logs")
      .withSearchIndex("search_title", (q) => {
        const base = q.search("title", args.q).eq("siteId", args.siteId);
        return args.category ? base.eq("category", args.category) : base;
      })
      .take(Math.min(args.limit ?? 50, 100));
    return results.map((log) => ({
      id: log._id,
      siteId: log.siteId,
      title: log.title,
      content: log.content,
      category: log.category,
      loggedAt: log.loggedAt,
      location: log.location ?? null,
      latitude: log.latitude ?? null,
      longitude: log.longitude ?? null,
      photoCount: (log.photos?.length ?? 0) + (log.photoStorageIds?.length ?? 0),
      createdAt: new Date(log._creationTime).toISOString(),
    }));
  },
});
