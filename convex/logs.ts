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
  // R2 photos take priority.
  // Always rebuild the URL from the key + the current R2_PUBLIC_URL env var so that
  // stale URLs (e.g. after a bucket migration) are automatically corrected.
  if (log.photos?.length) {
    const base = process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/$/, "");
    return log.photos
      .filter((p) => p.key)
      .map((p) => (base ? `${base}/${p.key}` : p.url));
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

    const limit = args.limit ?? 12;
    const teamKeyId = user.appliedLicenseKeyId;

    let logs;

    if (teamKeyId) {
      // Team mode: collect recent logs from all team sites (all authors)
      const teamSites = await ctx.db
        .query("sites")
        .withIndex("by_team_key", (q) => q.eq("teamKeyId", teamKeyId))
        .collect();

      const perSiteLogs = await Promise.all(
        teamSites.map((site) =>
          ctx.db
            .query("logs")
            .withIndex("by_site", (q) => q.eq("siteId", site._id))
            .order("desc")
            .take(limit)
        )
      );

      logs = perSiteLogs
        .flat()
        .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
        .slice(0, limit);
    } else {
      // Personal mode: user's own logs from personal (non-team) sites only
      const ownedSites = await ctx.db
        .query("sites")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect();
      const personalSiteIds = new Set(
        ownedSites.filter((s) => !s.teamKeyId).map((s) => s._id)
      );

      const rawLogs = await ctx.db
        .query("logs")
        .withIndex("by_author", (q) => q.eq("authorId", user._id))
        .order("desc")
        .take(limit * 5); // overfetch to compensate for site filtering

      logs = rawLogs.filter((l) => personalSiteIds.has(l.siteId)).slice(0, limit);
    }

    return await Promise.all(
      logs.map(async (log) => {
        const site = await ctx.db.get(log.siteId);
        const author = await ctx.db.get(log.authorId);
        const photoUrls = await resolvePhotoUrls(log, (id) => ctx.storage.getUrl(id));
        return { ...log, siteName: site?.name ?? "Unknown site", authorName: author?.name ?? "Unknown", photoUrls };
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

    const limit = args.limit ?? 50;
    const teamKeyId = user.appliedLicenseKeyId;

    let logs;

    if (teamKeyId) {
      // Team mode: collect all logs from team sites (all authors)
      const teamSites = await ctx.db
        .query("sites")
        .withIndex("by_team_key", (q) => q.eq("teamKeyId", teamKeyId))
        .collect();

      const perSiteLogs = await Promise.all(
        teamSites.map((site) =>
          ctx.db
            .query("logs")
            .withIndex("by_site", (q) => q.eq("siteId", site._id))
            .order("desc")
            .collect()
        )
      );

      logs = perSiteLogs
        .flat()
        .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
    } else {
      // Personal mode: user's own logs from personal (non-team) sites only
      const ownedSites = await ctx.db
        .query("sites")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect();
      const personalSiteIds = new Set(
        ownedSites.filter((s) => !s.teamKeyId).map((s) => s._id)
      );

      const rawLogs = await ctx.db
        .query("logs")
        .withIndex("by_author", (q) => q.eq("authorId", user._id))
        .order("desc")
        .collect();

      logs = rawLogs.filter((l) => personalSiteIds.has(l.siteId));
    }

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

    logs = logs.slice(0, limit);

    return await Promise.all(
      logs.map(async (log) => {
        const site = await ctx.db.get(log.siteId);
        const author = await ctx.db.get(log.authorId);
        const photoUrls = await resolvePhotoUrls(log, (id) => ctx.storage.getUrl(id));
        return { ...log, siteName: site?.name ?? "Unknown site", authorName: author?.name ?? "Unknown", photoUrls };
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

    const teamKeyId = user.appliedLicenseKeyId;

    let results;

    if (teamKeyId) {
      // Team mode: search without author restriction, filter by team site IDs
      const teamSites = await ctx.db
        .query("sites")
        .withIndex("by_team_key", (q) => q.eq("teamKeyId", teamKeyId))
        .collect();
      const teamSiteIds = new Set(teamSites.map((s) => s._id));

      const [titleResults, contentResults] = await Promise.all([
        ctx.db
          .query("logs")
          .withSearchIndex("search_title_global", (q) => {
            const base = q.search("title", args.query);
            return args.category ? base.eq("category", args.category) : base;
          })
          .take(200),
        ctx.db
          .query("logs")
          .withSearchIndex("search_content_global", (q) => {
            const base = q.search("content", args.query);
            return args.category ? base.eq("category", args.category) : base;
          })
          .take(200),
      ]);

      const seen = new Set(titleResults.map((r) => r._id));
      const merged = [...titleResults];
      for (const r of contentResults) {
        if (!seen.has(r._id)) {
          seen.add(r._id);
          merged.push(r);
        }
      }

      results = merged.filter((l) => teamSiteIds.has(l.siteId));
    } else {
      // Personal mode: search within current user's logs, filter to personal sites
      const ownedSites = await ctx.db
        .query("sites")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect();
      const personalSiteIds = new Set(
        ownedSites.filter((s) => !s.teamKeyId).map((s) => s._id)
      );

      const [titleResults, contentResults] = await Promise.all([
        ctx.db
          .query("logs")
          .withSearchIndex("search_title_global", (q) => {
            const base = q.search("title", args.query).eq("authorId", user._id);
            return args.category ? base.eq("category", args.category) : base;
          })
          .take(100),
        ctx.db
          .query("logs")
          .withSearchIndex("search_content_global", (q) => {
            const base = q.search("content", args.query).eq("authorId", user._id);
            return args.category ? base.eq("category", args.category) : base;
          })
          .take(100),
      ]);

      const seen = new Set(titleResults.map((r) => r._id));
      const merged = [...titleResults];
      for (const r of contentResults) {
        if (!seen.has(r._id)) {
          seen.add(r._id);
          merged.push(r);
        }
      }

      results = merged.filter((l) => personalSiteIds.has(l.siteId));
    }

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
        const author = await ctx.db.get(log.authorId);
        const photoUrls = await resolvePhotoUrls(log, (id) => ctx.storage.getUrl(id));
        return { ...log, siteName: site?.name ?? "Unknown site", authorName: author?.name ?? "Unknown", photoUrls };
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
    // Return empty pagination rather than throwing — LogList may render before
    // Convex auth resolves (offline-first mode) and we don't want a crash.
    if (!identity) return { page: [], isDone: true, continueCursor: "" };

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

/**
 * Non-paginated query that returns the most recent 50 logs for a site.
 * Used exclusively for offline caching via useCachedQuery — the full paginated
 * version (listBySite) is used for live online display.
 */
export const listBySiteSimple = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const logs = await ctx.db
      .query("logs")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .order("desc")
      .take(50);

    return await Promise.all(
      logs.map(async (log) => {
        const author = await ctx.db.get(log.authorId);
        const photoUrls = await resolvePhotoUrls(log, (id) => ctx.storage.getUrl(id));
        return { ...log, authorName: author?.name ?? "Unknown", photoUrls };
      })
    );
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
    // Return empty rather than throwing — offline-first mode may call this before auth resolves.
    if (!identity) return [];

    // Search both title and content, then deduplicate
    const [titleResults, contentResults] = await Promise.all([
      ctx.db
        .query("logs")
        .withSearchIndex("search_title", (q) => {
          const base = q.search("title", args.query).eq("siteId", args.siteId);
          return args.category ? base.eq("category", args.category) : base;
        })
        .take(100),
      ctx.db
        .query("logs")
        .withSearchIndex("search_content", (q) => {
          const base = q.search("content", args.query).eq("siteId", args.siteId);
          return args.category ? base.eq("category", args.category) : base;
        })
        .take(100),
    ]);

    // Deduplicate: title matches first, then content-only matches
    const seen = new Set(titleResults.map((r) => r._id));
    const merged = [...titleResults];
    for (const r of contentResults) {
      if (!seen.has(r._id)) {
        seen.add(r._id);
        merged.push(r);
      }
    }

    return await Promise.all(
      merged.map(async (log) => {
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

    // Verify user can log on this site (owns it or is a team member with same key)
    const canLog =
      site.ownerId === user._id ||
      (user.appliedLicenseKeyId !== undefined &&
        site.teamKeyId === user.appliedLicenseKeyId);
    if (!canLog) {
      throw new ConvexError({ message: "You don't have access to this site", code: "FORBIDDEN" });
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

    // Enforce per-tier photo limit per entry
    const photoLimits: Record<string, number> = {
      free: 5,
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

    // If changing site, verify the user can access the new site
    if (args.siteId && args.siteId !== log.siteId) {
      const newSite = await ctx.db.get(args.siteId);
      const canAccess = newSite && (
        newSite.ownerId === user._id ||
        (user.appliedLicenseKeyId !== undefined && newSite.teamKeyId === user.appliedLicenseKeyId)
      );
      if (!canAccess) {
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

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const site = await ctx.db.get(args.siteId);
    if (!site) return [];

    // Verify user has access to this site (owner or team member)
    const canAccess =
      site.ownerId === user._id ||
      (user.appliedLicenseKeyId !== undefined &&
        site.teamKeyId === user.appliedLicenseKeyId);
    if (!canAccess) return [];

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

    const ownSites = await ctx.db
      .query("sites")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();

    // Include team sites if user is on a team
    const allSites = [...ownSites];
    if (user.appliedLicenseKeyId) {
      const teamSiteDocs = await ctx.db
        .query("sites")
        .withIndex("by_team_key", (q) => q.eq("teamKeyId", user.appliedLicenseKeyId!))
        .collect();
      const ownIds = new Set(ownSites.map((s) => s._id));
      for (const s of teamSiteDocs) {
        if (!ownIds.has(s._id)) allSites.push(s);
      }
    }

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

// ── Stats ─────────────────────────────────────────────────────────────────────

type SiteStat = { siteName: string; count: number };

export const getStats = query({
  args: {},
  handler: async (ctx): Promise<{
    totalEntries: number;
    thisWeek: number;
    thisMonth: number;
    categoryBreakdown: Record<string, number>;
    topSites: SiteStat[];
    dailyActivity: Array<{ date: string; count: number }>;
    totalPhotos: number;
    totalSites: number;
    topAuthor: { authorName: string; count: number } | null;
  } | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return null;

    const teamKeyId = user.appliedLicenseKeyId;

    // Gather all relevant logs: team sites (all authors) or personal sites only
    let allLogs;
    let totalSites: number;

    if (teamKeyId) {
      // Team mode: all logs from all team sites
      const teamSites = await ctx.db
        .query("sites")
        .withIndex("by_team_key", (q) => q.eq("teamKeyId", teamKeyId))
        .collect();
      totalSites = teamSites.length;

      const perSiteLogs = await Promise.all(
        teamSites.map((site) =>
          ctx.db
            .query("logs")
            .withIndex("by_site", (q) => q.eq("siteId", site._id))
            .collect()
        )
      );
      allLogs = perSiteLogs.flat();
    } else {
      // Personal mode: only logs from the user's own non-team sites
      const ownedSites = await ctx.db
        .query("sites")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect();
      const personalSites = ownedSites.filter((s) => !s.teamKeyId);
      totalSites = personalSites.length;
      const personalSiteIds = new Set(personalSites.map((s) => s._id));

      const rawLogs = await ctx.db
        .query("logs")
        .withIndex("by_author", (q) => q.eq("authorId", user._id))
        .collect();
      allLogs = rawLogs.filter((l) => personalSiteIds.has(l.siteId));
    }

    const nowMs = Date.now();
    const weekAgoIso = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgoIso = new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString();

    const thisWeek = allLogs.filter((l) => l.loggedAt >= weekAgoIso).length;
    const thisMonth = allLogs.filter((l) => l.loggedAt >= monthAgoIso).length;

    // Category counts
    const categoryBreakdown: Record<string, number> = {
      inspection: 0,
      maintenance: 0,
      incident: 0,
      audit: 0,
      general: 0,
    };
    for (const log of allLogs) {
      if (log.category in categoryBreakdown) {
        categoryBreakdown[log.category] = (categoryBreakdown[log.category] ?? 0) + 1;
      }
    }

    // Per-site counts
    const siteCountMap: Record<string, number> = {};
    for (const log of allLogs) {
      const key = log.siteId as string;
      siteCountMap[key] = (siteCountMap[key] ?? 0) + 1;
    }
    const topSiteEntries = Object.entries(siteCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topSites: SiteStat[] = await Promise.all(
      topSiteEntries.map(async ([siteId, count]) => {
        const site = await ctx.db.get(siteId as Id<"sites">);
        return { siteName: site?.name ?? "Unknown", count };
      })
    );

    // Daily activity (last 30 days)
    const dailyMap: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(nowMs - i * 24 * 60 * 60 * 1000);
      dailyMap[d.toISOString().slice(0, 10)] = 0;
    }
    for (const log of allLogs) {
      const dateStr = log.loggedAt.slice(0, 10);
      if (dateStr in dailyMap) {
        dailyMap[dateStr] = (dailyMap[dateStr] ?? 0) + 1;
      }
    }
    const dailyActivity = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

    const totalPhotos = allLogs.reduce(
      (sum, log) =>
        sum + (log.photos?.length ?? 0) + (log.photoStorageIds?.length ?? 0),
      0
    );

    // Top author by log count
    const authorCountMap: Record<string, number> = {};
    for (const log of allLogs) {
      const key = log.authorId as string;
      authorCountMap[key] = (authorCountMap[key] ?? 0) + 1;
    }
    const topAuthorEntry = Object.entries(authorCountMap).sort((a, b) => b[1] - a[1])[0];
    let topAuthor: { authorName: string; count: number } | null = null;
    if (topAuthorEntry) {
      const authorUser = await ctx.db.get(topAuthorEntry[0] as Id<"users">);
      topAuthor = {
        authorName: authorUser?.name?.trim() || "Unknown",
        count: topAuthorEntry[1],
      };
    }

    return {
      totalEntries: allLogs.length,
      thisWeek,
      thisMonth,
      categoryBreakdown,
      topSites,
      dailyActivity,
      totalPhotos,
      totalSites,
      topAuthor,
    };
  },
});

/**
 * Returns all logs for every site owned by the current user, keyed by siteId.
 *
 * Used exclusively by the front-end background cache sync so that every site's
 * logs are available in localStorage before the user goes offline — even for
 * sites they haven't opened yet.
 *
 * Optimisations to stay within Convex limits:
 * - Authorise once and reuse the user's name for all logs (avoids N db.get
 *   calls for authorId — every log in this dataset belongs to the same user).
 * - Cap at 50 logs per site so the total document scan stays reasonable.
 */
export const listAllForOfflineCache = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return {};

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return {};

    const ownSitesForCache = await ctx.db
      .query("sites")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();

    // Include team sites if the user is on a team
    const allSitesForCache = [...ownSitesForCache];
    if (user.appliedLicenseKeyId) {
      const teamSiteDocs = await ctx.db
        .query("sites")
        .withIndex("by_team_key", (q) => q.eq("teamKeyId", user.appliedLicenseKeyId!))
        .collect();
      const ownIds = new Set(ownSitesForCache.map((s) => s._id));
      for (const s of teamSiteDocs) {
        if (!ownIds.has(s._id)) allSitesForCache.push(s);
      }
    }

    const result: Record<string, Array<ReturnType<typeof Object.assign>>> = {};

    for (const site of allSitesForCache) {
      const logs = await ctx.db
        .query("logs")
        .withIndex("by_site", (q) => q.eq("siteId", site._id))
        .order("desc")
        .take(50);

      result[site._id as string] = await Promise.all(
        logs.map(async (log) => {
          const photoUrls = await resolvePhotoUrls(log, (id) => ctx.storage.getUrl(id));
          // Resolve author name — may be a different team member
          let authorName = user.name ?? "Unknown";
          if (log.authorId !== user._id) {
            const author = await ctx.db.get(log.authorId);
            authorName = author?.name ?? "Teammate";
          }
          return { ...log, authorName, photoUrls };
        })
      );
    }

    return result;
  },
});

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Returns every R2 photo key currently referenced by a log in the DB. */
export const _getAllPhotoKeys = internalQuery({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const logs = await ctx.db.query("logs").collect();
    const keys: string[] = [];
    for (const log of logs) {
      if (log.photos?.length) {
        for (const photo of log.photos) {
          if (photo.key) keys.push(photo.key);
        }
      }
    }
    return keys;
  },
});

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
      photoCount: (log.photos?.length ?? 0) + (log.photoStorageIds?.length ?? 0),
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
    if (!site) {
      throw new ConvexError({ message: "Site not found", code: "NOT_FOUND" });
    }
    // Check ownership or team membership
    const user = await ctx.db.get(args.authorId);
    const canAccess = site.ownerId === args.authorId ||
      (user?.appliedLicenseKeyId !== undefined && site.teamKeyId === user.appliedLicenseKeyId);
    if (!canAccess) {
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
