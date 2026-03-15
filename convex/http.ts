import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel.d.ts";
import type { Id } from "./_generated/dataModel.d.ts";

const http = httpRouter();

// ── Helpers ──────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
} as const;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function err(message: string, status: number): Response {
  return json({ error: message }, status);
}

/** Hash an API key with SHA-256 using the Web Crypto API (available in V8). */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(key));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify the Bearer API key in the request.
 * Returns the userId if valid, or a Response to send immediately if invalid.
 */
async function verifyApiKey(
  ctx: GenericActionCtx<DataModel>,
  request: Request
): Promise<{ userId: Id<"users"> } | Response> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return err(
      'Missing Authorization header. Use: Authorization: Bearer lv_<key>',
      401
    );
  }

  const key = authHeader.slice(7).trim();
  if (!key.startsWith("lv_")) {
    return err("Invalid API key format. Keys must start with lv_", 401);
  }

  const keyHash = await hashApiKey(key);
  const apiKey = await ctx.runQuery(internal.integrations.apiKeys._getByHash, { keyHash });
  if (!apiKey?.isActive) {
    return err("Invalid or revoked API key", 401);
  }

  const user = await ctx.runQuery(internal.users._getById, { userId: apiKey.userId });
  if (!user) return err("User not found", 401);
  if ((user.subscriptionTier ?? "free") !== "business") {
    return err("A Business plan is required to use the LogVault REST API", 403);
  }

  // Track last usage (non-blocking)
  await ctx.runMutation(internal.integrations.apiKeys._updateLastUsed, {
    keyId: apiKey._id,
    lastUsedAt: new Date().toISOString(),
  });

  return { userId: apiKey.userId };
}

// ── CORS preflight ────────────────────────────────────────────────────────────
http.route({
  pathPrefix: "/api/",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

// ── GET /api/v1/sites ─────────────────────────────────────────────────────────
http.route({
  path: "/api/v1/sites",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyApiKey(ctx, request);
    if (auth instanceof Response) return auth;

    const sites = await ctx.runQuery(internal.sites._listByUserId, { userId: auth.userId });
    return json({
      sites: sites.map((s) => ({
        id: s._id,
        name: s.name,
        location: s.location ?? null,
        latitude: s.latitude ?? null,
        longitude: s.longitude ?? null,
        createdAt: new Date(s._creationTime).toISOString(),
      })),
    });
  }),
});

// ── GET /api/v1/logs?siteId=<id>&limit=<n> ───────────────────────────────────
http.route({
  path: "/api/v1/logs",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyApiKey(ctx, request);
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const siteId = url.searchParams.get("siteId") as Id<"sites"> | null;
    if (!siteId) return err("siteId query parameter is required", 400);

    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 50;

    const logs = await ctx.runQuery(internal.logs._listBySiteForApi, {
      siteId,
      userId: auth.userId,
      limit,
    });
    if (logs === null) return err("Site not found or access denied", 404);
    return json({ logs });
  }),
});

// ── POST /api/v1/logs ─────────────────────────────────────────────────────────
http.route({
  path: "/api/v1/logs",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyApiKey(ctx, request);
    if (auth instanceof Response) return auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return err("Request body must be valid JSON", 400);
    }

    if (!body || typeof body !== "object") return err("Request body must be an object", 400);
    const b = body as Record<string, unknown>;

    const siteId = b.siteId as Id<"sites"> | undefined;
    const title = typeof b.title === "string" ? b.title.trim() : "";
    const content = typeof b.content === "string" ? b.content : "";
    const rawCategory = b.category as string | undefined;
    const loggedAt = typeof b.loggedAt === "string" ? b.loggedAt : new Date().toISOString();

    if (!siteId) return err("siteId is required", 400);
    if (!title) return err("title is required", 400);

    const validCategories = ["inspection", "maintenance", "incident", "audit", "general"] as const;
    type ValidCategory = (typeof validCategories)[number];
    const category: ValidCategory = validCategories.includes(rawCategory as ValidCategory)
      ? (rawCategory as ValidCategory)
      : "general";

    try {
      const logId = await ctx.runMutation(internal.logs._createFromApi, {
        siteId,
        authorId: auth.userId,
        title,
        content,
        category,
        loggedAt,
        location: typeof b.location === "string" ? b.location : undefined,
        latitude: typeof b.latitude === "number" ? b.latitude : undefined,
        longitude: typeof b.longitude === "number" ? b.longitude : undefined,
      });
      return json({ id: logId }, 201);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create log";
      return err(msg, 400);
    }
  }),
});

export default http;
