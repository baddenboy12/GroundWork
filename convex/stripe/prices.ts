// V8 runtime — queries and mutations for Stripe product + price storage.
// Populated by initializeStripePrices in ./actions.ts.
// Four rows after init: (pro, base), (pro, seat), (business, base), (business, seat).
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "../_generated/server";

const PAID_TIERS = v.union(v.literal("pro"), v.literal("business"));
const PRICE_KIND = v.union(v.literal("base"), v.literal("seat"));

/** Public query: tells the frontend whether Stripe prices have been initialized */
export const getStripeStatus = query({
  args: {},
  handler: async (ctx) => {
    const prices = await ctx.db.query("stripePrices").collect();
    return { isInitialized: prices.length >= 4 };
  },
});

/** Internal: fetch the (tier, kind) price row used when building checkout line items. */
export const _getPriceByTierAndKind = internalQuery({
  args: { tier: PAID_TIERS, kind: PRICE_KIND },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("stripePrices")
      .withIndex("by_tier_and_kind", (q) =>
        q.eq("tier", args.tier).eq("kind", args.kind)
      )
      .unique();
  },
});

/** Internal: resolve a tier/kind from a Stripe price_id (used by webhook tier resolution). */
export const _getByPriceId = internalQuery({
  args: { priceId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("stripePrices")
      .withIndex("by_price_id", (q) => q.eq("priceId", args.priceId))
      .unique();
  },
});

export const _getAll = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("stripePrices").collect();
  },
});

/** Internal: delete all price records so they can be re-created via initializeStripePrices. */
export const _deleteAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("stripePrices").collect();
    for (const row of all) {
      await ctx.db.delete(row._id);
    }
    return { deleted: all.length };
  },
});

export const _upsertPrice = internalMutation({
  args: {
    tier: PAID_TIERS,
    kind: PRICE_KIND,
    priceId: v.string(),
    productId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stripePrices")
      .withIndex("by_tier_and_kind", (q) =>
        q.eq("tier", args.tier).eq("kind", args.kind)
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        priceId: args.priceId,
        productId: args.productId,
      });
    } else {
      await ctx.db.insert("stripePrices", args);
    }
  },
});
