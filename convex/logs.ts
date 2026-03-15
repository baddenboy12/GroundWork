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

export const listBySite = query({
  args: {
    siteId: v.id("sites"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

    const site = await ctx.db.get(args.siteId);
    // Site may have just been deleted — return empty rather than crashing
    if (!site) return { page: [], isDone: true, continueCursor: args.paginationOpts.cursor ?? "" };

    const results = await ctx.db
      .query("logs")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .order("desc")
      .paginate(args.paginationOpts);

    // Enrich with author names and resolved photo URLs
    return {
      ...results,
      page: await Promise.all(
        results.page.map(async (log) => {
          const author = await ctx.db.get(log.authorId);
          const photoUrls = log.photoStorageIds
            ? await Promise.all(
                log.photoStorageIds.map((id: Id<"_storage">) => ctx.storage.getUrl(id))
              )
            : [];
          return {
            ...log,
            authorName: author?.name ?? "Unknown",
            photoUrls: photoUrls.filter((url): url is string => url !== null),
          };
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
        const photoUrls = log.photoStorageIds
          ? await Promise.all(
              log.photoStorageIds.map((id: Id<"_storage">) => ctx.storage.getUrl(id))
            )
          : [];
        return {
          ...log,
          authorName: author?.name ?? "Unknown",
          photoUrls: photoUrls.filter((url): url is string => url !== null),
        };
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
    const photoUrls = log.photoStorageIds
      ? await Promise.all(
          log.photoStorageIds.map((id: Id<"_storage">) => ctx.storage.getUrl(id))
        )
      : [];
    return {
      ...log,
      authorName: author?.name ?? "Unknown",
      photoUrls: photoUrls.filter((url): url is string => url !== null),
    };
  },
});

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    title: v.string(),
    content: v.string(),
    category: categoryValidator,
    loggedAt: v.string(),
    photoStorageIds: v.optional(v.array(v.id("_storage"))),
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
      photoStorageIds: args.photoStorageIds,
    });
    // Fire webhook delivery for Business-plan users
    if ((user.subscriptionTier ?? "free") === "business") {
      const site = await ctx.db.get(args.siteId);
      await ctx.scheduler.runAfter(0, internal.integrations.webhookActions.deliver, {
        userId: user._id,
        event: "log.created",
        logId,
        siteName: site?.name ?? "",
      });
    }
    return logId;
  },
});

export const update = mutation({
  args: {
    logId: v.id("logs"),
    title: v.string(),
    content: v.string(),
    category: categoryValidator,
    loggedAt: v.string(),
    photoStorageIds: v.optional(v.array(v.id("_storage"))),
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
    await ctx.db.patch(args.logId, {
      title: args.title,
      content: args.content,
      category: args.category,
      loggedAt: args.loggedAt,
      location: args.location,
      latitude: args.latitude,
      longitude: args.longitude,
      photoStorageIds: args.photoStorageIds,
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
    // Delete associated storage files
    if (log.photoStorageIds) {
      for (const storageId of log.photoStorageIds) {
        await ctx.storage.delete(storageId);
      }
    }
    await ctx.db.delete(args.logId);
  },
});

// ── Internal: get a log by ID for webhook delivery (no auth needed) ──────────
export const _getForWebhook = internalQuery({
  args: { logId: v.id("logs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.logId);
  },
});

// ── Internal: list logs for a site (used by REST API) ────────────────────────
export const _listBySiteForApi = internalQuery({
  args: {
    siteId: v.id("sites"),
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify site ownership
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

// ── Internal: create a log via the REST API (no OIDC, uses authorId directly) ─
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
    // Schedule webhook delivery
    await ctx.scheduler.runAfter(0, internal.integrations.webhookActions.deliver, {
      userId: args.authorId,
      event: "log.created",
      logId,
      siteName: site.name,
    });
    return logId;
  },
});
