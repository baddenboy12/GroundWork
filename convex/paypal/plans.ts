// V8 runtime — queries and mutations for PayPal plan storage
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "../_generated/server";

const PAID_TIERS = v.union(
  v.literal("starter"),
  v.literal("pro"),
  v.literal("business")
);

/** Public query: tells the frontend whether PayPal plans have been initialized */
export const getPayPalStatus = query({
  args: {},
  handler: async (ctx) => {
    const starter = await ctx.db
      .query("paypalPlans")
      .withIndex("by_tier", (q) => q.eq("tier", "starter"))
      .unique();
    return { isInitialized: !!starter };
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
