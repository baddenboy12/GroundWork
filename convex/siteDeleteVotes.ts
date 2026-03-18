import { v, ConvexError } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel.d.ts";

// 24 hours in milliseconds
const VOTE_TTL_MS = 24 * 60 * 60 * 1000;

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Get the current pending deletion vote for a site, enriched with
 * team-member names and per-member vote status.
 */
export const getForSite = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return null;

    const vote = await ctx.db
      .query("siteDeleteVotes")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (!vote) return null;
    // Scheduler may not have fired yet – treat it as expired client-side
    if (vote.expiresAt <= new Date().toISOString()) return null;

    // Resolve proposer name
    const proposer = await ctx.db.get(vote.proposedBy);

    // Resolve all current team members with vote status
    const memberships = await ctx.db
      .query("keyMemberships")
      .withIndex("by_key", (q) => q.eq("keyId", vote.teamKeyId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (m) => {
        const member = await ctx.db.get(m.userId);
        return {
          userId: m.userId,
          name: member?.name ?? "Teammate",
          hasVoted: vote.approvedBy.includes(m.userId),
          isMe: m.userId === user._id,
        };
      })
    );

    return {
      voteId: vote._id,
      siteId: vote.siteId,
      proposedBy: vote.proposedBy,
      proposerName: proposer?.name ?? "Teammate",
      proposedAt: vote.proposedAt,
      expiresAt: vote.expiresAt,
      approvedCount: vote.approvedBy.length,
      memberCount: memberships.length,
      hasVoted: vote.approvedBy.includes(user._id),
      isProposer: vote.proposedBy === user._id,
      members,
    };
  },
});

/**
 * Return a lightweight list of active deletion votes for the current user's
 * team — used to show vote-in-progress badges on the site list.
 */
export const listActiveForTeam = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user?.appliedLicenseKeyId) return [];

    const now = new Date().toISOString();
    const votes = await ctx.db
      .query("siteDeleteVotes")
      .withIndex("by_team_key_and_status", (q) =>
        q.eq("teamKeyId", user.appliedLicenseKeyId!).eq("status", "pending")
      )
      .collect();

    return votes
      .filter((vote) => vote.expiresAt > now)
      .map((vote) => ({
        voteId: vote._id,
        siteId: vote.siteId,
        approvedCount: vote.approvedBy.length,
      }));
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Propose deletion of a team site. Any team member may call this.
 * The proposer's vote is automatically cast.
 * If the team has only one member, the site is deleted immediately.
 */
export const propose = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args): Promise<{ immediate: boolean; voteId?: Id<"siteDeleteVotes"> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const site = await ctx.db.get(args.siteId);
    if (!site) throw new ConvexError({ message: "Site not found", code: "NOT_FOUND" });
    if (!site.teamKeyId) throw new ConvexError({ message: "Not a team site", code: "BAD_REQUEST" });

    // Caller must be a current team member or the site owner
    const isTeamMember =
      user.appliedLicenseKeyId === site.teamKeyId || site.ownerId === user._id;
    if (!isTeamMember) {
      throw new ConvexError({ message: "You are not a member of this site's team", code: "FORBIDDEN" });
    }

    // Reject if a non-expired pending vote already exists
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("siteDeleteVotes")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
    if (existing && existing.expiresAt > now) {
      throw new ConvexError({
        message: "A deletion vote is already in progress for this site",
        code: "CONFLICT",
      });
    }

    // Count current team members to determine whether a vote is needed
    const memberships = await ctx.db
      .query("keyMemberships")
      .withIndex("by_key", (q) => q.eq("keyId", site.teamKeyId!))
      .collect();
    const memberCount = memberships.length;

    // Single-member team: delete immediately without a vote
    if (memberCount <= 1) {
      await ctx.scheduler.runAfter(0, internal.sites._deleteByIdInternal, {
        siteId: args.siteId,
      });
      return { immediate: true };
    }

    const proposedAt = now;
    const expiresAt = new Date(Date.now() + VOTE_TTL_MS).toISOString();

    const voteId = await ctx.db.insert("siteDeleteVotes", {
      siteId: args.siteId,
      teamKeyId: site.teamKeyId,
      proposedBy: user._id,
      proposedAt,
      expiresAt,
      approvedBy: [user._id], // Proposer auto-approves
      status: "pending",
    });

    // Schedule automatic expiry
    await ctx.scheduler.runAt(
      new Date(expiresAt).getTime(),
      internal.siteDeleteVotes._expireVote,
      { voteId }
    );

    return { immediate: false, voteId };
  },
});

/**
 * Cast an approval vote on an active deletion proposal.
 * When all current team members have approved the site is immediately deleted.
 */
export const castVote = mutation({
  args: { voteId: v.id("siteDeleteVotes") },
  handler: async (ctx, args): Promise<{ deleted: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const vote = await ctx.db.get(args.voteId);
    if (!vote) throw new ConvexError({ message: "Vote not found", code: "NOT_FOUND" });
    if (vote.status !== "pending") {
      throw new ConvexError({ message: "This vote is no longer active", code: "BAD_REQUEST" });
    }
    if (vote.expiresAt <= new Date().toISOString()) {
      throw new ConvexError({ message: "This vote has expired", code: "BAD_REQUEST" });
    }

    // Verify the caller is a team member or site owner
    const site = await ctx.db.get(vote.siteId);
    const isTeamMember =
      user.appliedLicenseKeyId === vote.teamKeyId || site?.ownerId === user._id;
    if (!isTeamMember) {
      throw new ConvexError({ message: "You are not a member of this team", code: "FORBIDDEN" });
    }

    if (vote.approvedBy.includes(user._id)) {
      throw new ConvexError({ message: "You have already voted", code: "CONFLICT" });
    }

    const newApprovedBy: Id<"users">[] = [...vote.approvedBy, user._id];

    // Count current team members to test for unanimity
    const memberships = await ctx.db
      .query("keyMemberships")
      .withIndex("by_key", (q) => q.eq("keyId", vote.teamKeyId))
      .collect();
    const memberCount = memberships.length;

    if (newApprovedBy.length >= memberCount) {
      // Unanimous – mark approved and schedule deletion
      await ctx.db.patch(args.voteId, { approvedBy: newApprovedBy, status: "approved" });
      await ctx.scheduler.runAfter(0, internal.sites._deleteByIdInternal, {
        siteId: vote.siteId,
      });
      return { deleted: true };
    }

    await ctx.db.patch(args.voteId, { approvedBy: newApprovedBy });
    return { deleted: false };
  },
});

/** Cancel a pending vote. Only the member who proposed it may cancel. */
export const cancel = mutation({
  args: { voteId: v.id("siteDeleteVotes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const vote = await ctx.db.get(args.voteId);
    if (!vote) throw new ConvexError({ message: "Vote not found", code: "NOT_FOUND" });
    if (vote.proposedBy !== user._id) {
      throw new ConvexError({
        message: "Only the member who proposed the vote can cancel it",
        code: "FORBIDDEN",
      });
    }
    if (vote.status !== "pending") {
      throw new ConvexError({ message: "This vote is no longer active", code: "BAD_REQUEST" });
    }

    await ctx.db.patch(args.voteId, { status: "cancelled" });
  },
});

// ── Internal ──────────────────────────────────────────────────────────────────

/** Scheduled: expire a vote once 24 h has passed. */
export const _expireVote = internalMutation({
  args: { voteId: v.id("siteDeleteVotes") },
  handler: async (ctx, args) => {
    const vote = await ctx.db.get(args.voteId);
    if (!vote || vote.status !== "pending") return;
    await ctx.db.patch(args.voteId, { status: "expired" });
  },
});
