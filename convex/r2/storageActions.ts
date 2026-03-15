"use node";
// Node.js runtime — Cloudflare R2 photo storage via S3-compatible API

import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { ConvexError, v } from "convex/values";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ── Storage limits by tier (bytes) ───────────────────────────────────────────
export const TIER_STORAGE_LIMITS: Record<string, number> = {
  free: 0,
  starter: 2 * 1024 * 1024 * 1024,   // 2 GB
  pro: 5 * 1024 * 1024 * 1024,        // 5 GB
  business: 10 * 1024 * 1024 * 1024,  // 10 GB
};

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ── R2 helpers ────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `${name} is not configured. Add it in the Secrets tab.`,
    });
  }
  return val;
}

function getS3(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${requireEnv("CLOUDFLARE_R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("CLOUDFLARE_R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    },
  });
}

function buildPublicUrl(key: string): string {
  const base = requireEnv("CLOUDFLARE_R2_PUBLIC_URL");
  return `${base.replace(/\/$/, "")}/${key}`;
}

function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 100);
}

// ── Public action: generate presigned PUT URL ─────────────────────────────────

export const getUploadUrl = action({
  args: {
    fileName: v.string(),
    contentType: v.string(),
    bytes: v.number(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    }

    const user = await ctx.runQuery(internal.users._getByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    // Soft quota check — hard check enforced at log save time
    const used = user.storageUsedBytes ?? 0;
    const limit = TIER_STORAGE_LIMITS[user.subscriptionTier ?? "free"] ?? 0;
    if (limit > 0 && used + args.bytes > limit) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: `Storage limit reached. Used: ${formatBytes(used)} of ${formatBytes(limit)}.`,
      });
    }

    const bucket = requireEnv("CLOUDFLARE_R2_BUCKET_NAME");
    const key = `${user._id}/${Date.now()}-${sanitizeName(args.fileName)}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: args.contentType,
    });

    const uploadUrl = await getSignedUrl(getS3(), command, { expiresIn: 3600 });
    const publicUrl = buildPublicUrl(key);

    return { uploadUrl, key, publicUrl };
  },
});

// ── Internal action: delete photo keys from R2 (after log deletion) ───────────

export const deletePhotosFromR2 = internalAction({
  args: { keys: v.array(v.string()) },
  handler: async (_ctx, args): Promise<void> => {
    if (args.keys.length === 0) return;
    const s3 = getS3();
    const bucket = requireEnv("CLOUDFLARE_R2_BUCKET_NAME");
    for (const key of args.keys) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      } catch (e) {
        // Log but don't throw — storage cleanup is best-effort
        console.error(`R2 delete failed for key "${key}":`, e);
      }
    }
  },
});
