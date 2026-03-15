import { v, ConvexError } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "../_generated/server";

// ── Public: list webhooks for the current user ───────────────────────────────
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
      .query("webhooks")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

// ── Public: permanently delete a webhook ────────────────────────────────────
export const remove = mutation({
  args: { webhookId: v.id("webhooks") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) throw new ConvexError({ message: "Webhook not found", code: "NOT_FOUND" });
    if (webhook.userId !== user._id) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
    await ctx.db.delete(args.webhookId);
  },
});

// ── Public: toggle a webhook active/inactive ─────────────────────────────────
export const toggle = mutation({
  args: { webhookId: v.id("webhooks") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) throw new ConvexError({ message: "Webhook not found", code: "NOT_FOUND" });
    if (webhook.userId !== user._id) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
    await ctx.db.patch(args.webhookId, { isActive: !webhook.isActive });
  },
});

// ── Internal: insert a webhook record (called from webhookActions.create) ───
export const _insert = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    url: v.string(),
    events: v.array(v.string()),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("webhooks", {
      userId: args.userId,
      name: args.name,
      url: args.url,
      events: args.events,
      secret: args.secret,
      isActive: true,
    });
  },
});

// ── Internal: get a single webhook by ID ────────────────────────────────────
export const _getById = internalQuery({
  args: { webhookId: v.id("webhooks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.webhookId);
  },
});

// ── Internal: list active webhooks for a user that subscribe to an event ─────
export const _listActive = internalQuery({
  args: { userId: v.id("users"), event: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("webhooks")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return all.filter((w) => w.isActive && w.events.includes(args.event));
  },
});
