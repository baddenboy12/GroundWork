import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),

  sites: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    ownerId: v.id("users"),
    // Shared with all team members of the owner
  })
    .index("by_owner", ["ownerId"])
    .index("by_name", ["name"]),

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
