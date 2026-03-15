import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    // Subscription tier – defaults to "free" if absent
    subscriptionTier: v.optional(
      v.union(
        v.literal("free"),
        v.literal("starter"),
        v.literal("pro"),
        v.literal("business")
      )
    ),
  }).index("by_token", ["tokenIdentifier"]),

  sites: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    ownerId: v.id("users"),
    // Shared with all team members of the owner
  })
    .index("by_owner", ["ownerId"])
    .index("by_name", ["name"]),

  apiKeys: defineTable({
    userId: v.id("users"),
    name: v.string(),
    // SHA-256 hash of the full key (never store the raw key)
    keyHash: v.string(),
    // First characters of the key for display: "lv_a1b2c3d4…"
    keyPrefix: v.string(),
    isActive: v.boolean(),
    lastUsedAt: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_hash", ["keyHash"]),

  webhooks: defineTable({
    userId: v.id("users"),
    name: v.string(),
    url: v.string(),
    events: v.array(v.string()),
    // HMAC-SHA256 signing secret (stored plain — only server-side accessible)
    secret: v.string(),
    isActive: v.boolean(),
  }).index("by_user", ["userId"]),

  logs: defineTable({
    siteId: v.id("sites"),
    title: v.string(),
    content: v.string(),
    category: v.union(
      v.literal("inspection"),
      v.literal("maintenance"),
      v.literal("incident"),
      v.literal("audit"),
      v.literal("general")
    ),
    authorId: v.id("users"),
    // ISO 8601 UTC timestamp of when the event occurred
    loggedAt: v.string(),
    // Optional GPS / manual location for this specific log entry
    location: v.optional(v.string()),
    // GPS coordinates (stored separately for map display)
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    // Convex storage IDs for attached photos
    photoStorageIds: v.optional(v.array(v.id("_storage"))),
  })
    .index("by_site", ["siteId"])
    .index("by_site_and_category", ["siteId", "category"])
    .index("by_author", ["authorId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["siteId", "category"],
    }),
});
