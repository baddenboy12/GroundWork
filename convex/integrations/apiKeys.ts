import { v, ConvexError } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "../_generated/server";

// ── Public: list all API keys for the current user ──────────────────────────
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
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

// ── Public: disable (revoke) an API key ─────────────────────────────────────
export const revoke = mutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    const key = await ctx.db.get(args.keyId);
    if (!key) throw new ConvexError({ message: "API key not found", code: "NOT_FOUND" });
    if (key.userId !== user._id) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
    await ctx.db.patch(args.keyId, { isActive: false });
  },
});

// ── Public: permanently delete an API key ───────────────────────────────────
export const remove = mutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    const key = await ctx.db.get(args.keyId);
    if (!key) throw new ConvexError({ message: "API key not found", code: "NOT_FOUND" });
    if (key.userId !== user._id) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
    await ctx.db.delete(args.keyId);
  },
});

// ── Internal: insert a new key record (called from apiKeysActions.create) ───
export const _insert = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    keyHash: v.string(),
    keyPrefix: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("apiKeys", {
      userId: args.userId,
      name: args.name,
      keyHash: args.keyHash,
      keyPrefix: args.keyPrefix,
      isActive: true,
    });
  },
});

// ── Internal: look up a key by its SHA-256 hash (used during HTTP auth) ─────
export const _getByHash = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", args.keyHash))
      .unique();
  },
});

// ── Internal: update lastUsedAt after a successful API call ─────────────────
export const _updateLastUsed = internalMutation({
  args: { keyId: v.id("apiKeys"), lastUsedAt: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.keyId, { lastUsedAt: args.lastUsedAt });
  },
});
