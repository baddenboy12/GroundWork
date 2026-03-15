"use node";
import { v, ConvexError } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import * as crypto from "node:crypto";

/**
 * Generate a new API key for the authenticated Business-plan user.
 * Returns the full key exactly once — it is never stored in the database.
 */
export const create = action({
  args: { name: v.string() },
  handler: async (ctx, args): Promise<{ fullKey: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

    const user = await ctx.runQuery(internal.users._getByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    if ((user.subscriptionTier ?? "free") !== "business") {
      throw new ConvexError({ message: "Business plan required for API keys", code: "FORBIDDEN" });
    }
    if (!args.name.trim()) {
      throw new ConvexError({ message: "Key name cannot be empty", code: "BAD_REQUEST" });
    }

    // Generate key: "lv_" + 64 hex chars (32 random bytes)
    const randomHex = crypto.randomBytes(32).toString("hex");
    const fullKey = `lv_${randomHex}`;
    const keyHash = crypto.createHash("sha256").update(fullKey).digest("hex");
    // Display prefix — first 8 hex chars so users can identify the key
    const keyPrefix = `lv_${randomHex.substring(0, 8)}…`;

    await ctx.runMutation(internal.integrations.apiKeys._insert, {
      userId: user._id,
      name: args.name.trim(),
      keyHash,
      keyPrefix,
    });

    return { fullKey };
  },
});
