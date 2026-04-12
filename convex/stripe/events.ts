// V8 runtime — idempotency layer for Stripe webhook events.
// Stripe retries failed webhooks aggressively; without this table we would
// re-apply the same event multiple times. Fast path: _markProcessed inserts
// by event.id; _isProcessed returns whether we've already seen it.
// A daily cron (clear-old-stripe-events in convex/crons.ts) deletes rows
// older than 7 days to keep the table bounded.
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const _isProcessed = internalQuery({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("processedStripeEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .unique();
    return existing !== null;
  },
});

export const _markProcessed = internalMutation({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("processedStripeEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .unique();
    if (existing) return;
    await ctx.db.insert("processedStripeEvents", {
      eventId: args.eventId,
      processedAt: Date.now(),
    });
  },
});

/** Cron handler: delete processed-event rows older than 7 days. */
export const _clearOldEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const old = await ctx.db
      .query("processedStripeEvents")
      .collect();
    let deleted = 0;
    for (const row of old) {
      if (row.processedAt < cutoff) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }
    return { deleted };
  },
});
