import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Simple sliding-window rate limiter backed by the Convex database.
 *
 * Each unique key (e.g. API key hash or IP) gets a document that tracks
 * request timestamps within the current window. Stale entries are pruned
 * on every check.
 */

// ── Internal query: check current request count ──────────────────────────────

export const check = internalQuery({
  args: {
    key: v.string(),
    windowMs: v.number(),
    maxRequests: v.number(),
  },
  handler: async (ctx, { key, windowMs, maxRequests }) => {
    const bucket = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    if (!bucket) return { allowed: true, remaining: maxRequests - 1 };

    const now = Date.now();
    const windowStart = now - windowMs;
    const recentHits = bucket.timestamps.filter((t) => t > windowStart);

    return {
      allowed: recentHits.length < maxRequests,
      remaining: Math.max(0, maxRequests - recentHits.length),
    };
  },
});

// ── Internal mutation: record a request hit ──────────────────────────────────

export const hit = internalMutation({
  args: {
    key: v.string(),
    windowMs: v.number(),
  },
  handler: async (ctx, { key, windowMs }) => {
    const now = Date.now();
    const windowStart = now - windowMs;

    const bucket = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    if (!bucket) {
      await ctx.db.insert("rateLimits", {
        key,
        timestamps: [now],
      });
    } else {
      // Prune old timestamps and add current
      const recent = bucket.timestamps.filter((t) => t > windowStart);
      recent.push(now);
      await ctx.db.patch(bucket._id, { timestamps: recent });
    }
  },
});

// ── Internal mutation: clean up expired rate limit entries ────────────────────

export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const all = await ctx.db.query("rateLimits").collect();
    for (const bucket of all) {
      const recent = bucket.timestamps.filter((t) => t > fiveMinutesAgo);
      if (recent.length === 0) {
        await ctx.db.delete(bucket._id);
      } else if (recent.length !== bucket.timestamps.length) {
        await ctx.db.patch(bucket._id, { timestamps: recent });
      }
    }
  },
});
