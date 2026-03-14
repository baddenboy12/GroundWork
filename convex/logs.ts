import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

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

    // Verify site exists and user has access
    const site = await ctx.db.get(args.siteId);
    if (!site) throw new ConvexError({ message: "Site not found", code: "NOT_FOUND" });

    const results = await ctx.db
      .query("logs")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .order("desc")
      .paginate(args.paginationOpts);

    // Enrich with author names
    return {
      ...results,
      page: await Promise.all(
        results.page.map(async (log) => {
          const author = await ctx.db.get(log.authorId);
          return { ...log, authorName: author?.name ?? "Unknown" };
        })
      ),
    };
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
    return { ...log, authorName: author?.name ?? "Unknown" };
  },
});

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    title: v.string(),
    content: v.string(),
    category: categoryValidator,
    loggedAt: v.string(),
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
    await ctx.db.delete(args.logId);
  },
});
