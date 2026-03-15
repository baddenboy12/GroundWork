import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
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
    if (!site) throw new ConvexError({ message: "Site not found", code: "NOT_FOUND" });

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
    return await ctx.db.insert("logs", {
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
