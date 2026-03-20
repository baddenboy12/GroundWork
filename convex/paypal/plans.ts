// V8 runtime — queries and mutations for PayPal plan storage
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "../_generated/server";

const PAID_TIERS = v.union(
  v.literal("pro"),
  v.literal("business")
);

/** Public query: tells the frontend whether PayPal plans have been initialized */
export const getPayPalStatus = query({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db.query("paypalPlans").collect();
    return { isInitialized: plans.length >= 2 };
  },
});

export const _getPlanByTier = internalQuery({
  args: { tier: PAID_TIERS },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("paypalPlans")
      .withIndex("by_tier", (q) => q.eq("tier", args.tier))
      .unique();
  },
});

export const _getPlanByPlanId = internalQuery({
  args: { planId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("paypalPlans")
      .withIndex("by_plan_id", (q) => q.eq("planId", args.planId))
      .unique();
  },
});

export const _getAllPlans = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("paypalPlans").collect();
  },
});

/** Internal: delete all plan records so they can be re-created via initializePayPalPlans. */
export const _deleteAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("paypalPlans").collect();
    for (const plan of all) {
      await ctx.db.delete(plan._id);
    }
    return { deleted: all.length };
  },
});

export const _upsertPlan = internalMutation({
  args: {
    tier: PAID_TIERS,
    planId: v.string(),
    productId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("paypalPlans")
      .withIndex("by_tier", (q) => q.eq("tier", args.tier))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        planId: args.planId,
        productId: args.productId,
      });
    } else {
      await ctx.db.insert("paypalPlans", args);
    }
  },
});
