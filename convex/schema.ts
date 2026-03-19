import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    // ISO 8601 UTC timestamp of when the user first signed up
    createdAt: v.optional(v.string()),
    // Role: "super_admin" for the app owner, "user" for everyone else
    role: v.optional(v.string()),
    // Subscription tier – defaults to "free" if absent
    subscriptionTier: v.optional(
      v.union(
        v.literal("free"),
        v.literal("starter"),
        v.literal("pro"),
        v.literal("business")
      )
    ),
    // PayPal subscription tracking
    paypalSubscriptionId: v.optional(v.string()),
    paypalSubscriptionStatus: v.optional(v.string()),
    // R2 photo storage usage tracking (bytes)
    storageUsedBytes: v.optional(v.number()),
    // Applied license key (if the user joined a team via a key)
    appliedLicenseKeyId: v.optional(v.id("licenseKeys")),
    // Pending team seat count stored server-side before PayPal redirect (prevents sessionStorage tampering)
    pendingTeamSeats: v.optional(v.number()),
  }).index("by_token", ["tokenIdentifier"]),

  // License keys — represent a team workspace group
  licenseKeys: defineTable({
    // Display code e.g. "GW-A3K9-BX2M-7YNP"
    code: v.string(),
    // Admin user who created this key
    createdBy: v.id("users"),
    // Current team admin (may differ from createdBy after a transfer)
    adminUserId: v.optional(v.id("users")),
    // Tier unlocked by this key
    tier: v.union(
      v.literal("pro"),
      v.literal("business")
    ),
    // Active = usable, suspended = paused by admin or member
    status: v.union(
      v.literal("active"),
      v.literal("suspended")
    ),
    // Legacy: kept optional for backward compat with older documents
    maxMembers: v.optional(v.number()),
    // Optional admin label
    note: v.optional(v.string()),
    // true when created via self-service by a subscriber (not super-admin)
    selfCreated: v.optional(v.boolean()),
    // Pending seat count stored server-side by reviseSubscriptionSeats before PayPal approval
    pendingMaxMembers: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_creator", ["createdBy"]),

  // Tracks which users have applied which license key
  keyMemberships: defineTable({
    keyId: v.id("licenseKeys"),
    userId: v.id("users"),
    joinedAt: v.string(),
  })
    .index("by_key", ["keyId"])
    .index("by_user", ["userId"]),

  // Stores PayPal product + plan IDs created via initializePayPalPlans
  paypalPlans: defineTable({
    tier: v.union(
      v.literal("starter"),
      v.literal("pro"),
      v.literal("business")
    ),
    planId: v.string(),
    productId: v.string(),
  })
    .index("by_tier", ["tier"])
    .index("by_plan_id", ["planId"]),

  sites: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    ownerId: v.id("users"),
    // Set when the site is created by a team member — all team members can access it
    teamKeyId: v.optional(v.id("licenseKeys")),
  })
    .index("by_owner", ["ownerId"])
    .index("by_name", ["name"])
    .index("by_team_key", ["teamKeyId"]),

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

  // Tracks pending team-vote requests to delete a shared site
  siteDeleteVotes: defineTable({
    siteId: v.id("sites"),
    teamKeyId: v.id("licenseKeys"),
    proposedBy: v.id("users"),
    proposedAt: v.string(),
    // ISO-8601 UTC – vote expires 24 h after proposal
    expiresAt: v.string(),
    // IDs of members who have cast an "approve" vote
    approvedBy: v.array(v.id("users")),
    status: v.union(
      v.literal("pending"),   // awaiting further votes
      v.literal("approved"),  // unanimous – site deleted
      v.literal("expired"),   // 24 h elapsed without unanimity
      v.literal("cancelled")  // proposer cancelled
    ),
  })
    .index("by_site", ["siteId"])
    .index("by_team_key_and_status", ["teamKeyId", "status"]),

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
    // Legacy: Convex built-in file storage IDs (kept for backward compatibility)
    photoStorageIds: v.optional(v.array(v.id("_storage"))),
    // R2 cloud storage photos (url, key, bytes per photo)
    photos: v.optional(
      v.array(
        v.object({
          url: v.string(),
          key: v.string(),
          bytes: v.number(),
        })
      )
    ),
  })
    .index("by_site", ["siteId"])
    .index("by_site_and_category", ["siteId", "category"])
    .index("by_author", ["authorId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["siteId", "category"],
    })
    .searchIndex("search_title_global", {
      searchField: "title",
      filterFields: ["authorId", "category"],
    }),
});
