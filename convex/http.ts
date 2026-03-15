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
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
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
    return err("A Business plan is required to use the SiteScribe REST API", 403);
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

// ════════════════════════════════════════════════════════════════════════════
// SITES
// ════════════════════════════════════════════════════════════════════════════

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
        description: s.description ?? null,
        location: s.location ?? null,
        latitude: s.latitude ?? null,
        longitude: s.longitude ?? null,
        createdAt: new Date(s._creationTime).toISOString(),
      })),
    });
  }),
});

// ── POST /api/v1/sites ────────────────────────────────────────────────────────
http.route({
  path: "/api/v1/sites",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyApiKey(ctx, request);
    if (auth instanceof Response) return auth;

    let body: unknown;
    try { body = await request.json(); } catch { return err("Request body must be valid JSON", 400); }
    if (!body || typeof body !== "object") return err("Request body must be an object", 400);
    const b = body as Record<string, unknown>;

    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name) return err("name is required", 400);

    try {
      const siteId = await ctx.runMutation(internal.sites._createFromApi, {
        userId: auth.userId,
        name,
        description: typeof b.description === "string" ? b.description : undefined,
        location: typeof b.location === "string" ? b.location : undefined,
        latitude: typeof b.latitude === "number" ? b.latitude : undefined,
        longitude: typeof b.longitude === "number" ? b.longitude : undefined,
      });
      return json({ id: siteId }, 201);
    } catch (e) {
      return err(e instanceof Error ? e.message : "Failed to create site", 400);
    }
  }),
});

// ── PATCH /api/v1/sites/:id ───────────────────────────────────────────────────
http.route({
  pathPrefix: "/api/v1/sites/",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyApiKey(ctx, request);
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const siteId = url.pathname.replace("/api/v1/sites/", "") as Id<"sites">;
    if (!siteId) return err("Site ID is required in the URL path", 400);

    let body: unknown;
    try { body = await request.json(); } catch { return err("Request body must be valid JSON", 400); }
    if (!body || typeof body !== "object") return err("Request body must be an object", 400);
    const b = body as Record<string, unknown>;

    try {
      await ctx.runMutation(internal.sites._updateFromApi, {
        siteId,
        userId: auth.userId,
        name: typeof b.name === "string" ? b.name : undefined,
        description: typeof b.description === "string" ? b.description : undefined,
        location: typeof b.location === "string" ? b.location : undefined,
        latitude: typeof b.latitude === "number" ? b.latitude : undefined,
        longitude: typeof b.longitude === "number" ? b.longitude : undefined,
      });
      const updated = await ctx.runQuery(internal.sites._getByIdForApi, { siteId, userId: auth.userId });
      return json(updated ? {
        id: updated._id,
        name: updated.name,
        description: updated.description ?? null,
        location: updated.location ?? null,
        latitude: updated.latitude ?? null,
        longitude: updated.longitude ?? null,
        createdAt: new Date(updated._creationTime).toISOString(),
      } : {});
    } catch (e) {
      return err(e instanceof Error ? e.message : "Failed to update site", 400);
    }
  }),
});

// ── DELETE /api/v1/sites/:id ──────────────────────────────────────────────────
http.route({
  pathPrefix: "/api/v1/sites/",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyApiKey(ctx, request);
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const siteId = url.pathname.replace("/api/v1/sites/", "") as Id<"sites">;
    if (!siteId) return err("Site ID is required in the URL path", 400);

    try {
      await ctx.runMutation(internal.sites._deleteFromApi, { siteId, userId: auth.userId });
      return json({ deleted: true });
    } catch (e) {
      return err(e instanceof Error ? e.message : "Failed to delete site", 400);
    }
  }),
});

// ════════════════════════════════════════════════════════════════════════════
// LOGS
// ════════════════════════════════════════════════════════════════════════════

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
    try { body = await request.json(); } catch { return err("Request body must be valid JSON", 400); }
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

// ── GET /api/v1/logs/search?siteId=&q=  OR  GET /api/v1/logs/:id ─────────────
http.route({
  pathPrefix: "/api/v1/logs/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyApiKey(ctx, request);
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const segment = url.pathname.replace("/api/v1/logs/", "");

    // ── Search branch ──────────────────────────────────────────────────────
    if (segment === "search") {
      const siteId = url.searchParams.get("siteId") as Id<"sites"> | null;
      const q = url.searchParams.get("q") ?? "";
      if (!siteId) return err("siteId query parameter is required", 400);
      if (!q.trim()) return err("q (search query) is required", 400);

      const rawCategory = url.searchParams.get("category");
      const validCategories = ["inspection", "maintenance", "incident", "audit", "general"] as const;
      type ValidCategory = (typeof validCategories)[number];
      const category = validCategories.includes(rawCategory as ValidCategory)
        ? (rawCategory as ValidCategory)
        : undefined;

      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50;

      const results = await ctx.runQuery(internal.logs._searchForApi, {
        siteId,
        userId: auth.userId,
        q,
        category,
        limit,
      });
      if (results === null) return err("Site not found or access denied", 404);
      return json({ logs: results, count: results.length });
    }

    // ── Get by ID branch ───────────────────────────────────────────────────
    const logId = segment as Id<"logs">;
    const log = await ctx.runQuery(internal.logs._getByIdForApi, { logId, userId: auth.userId });
    if (!log) return err("Log not found", 404);
    return json(log);
  }),
});

// ── PATCH /api/v1/logs/:id ────────────────────────────────────────────────────
http.route({
  pathPrefix: "/api/v1/logs/",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyApiKey(ctx, request);
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const logId = url.pathname.replace("/api/v1/logs/", "") as Id<"logs">;
    if (!logId) return err("Log ID is required in the URL path", 400);

    let body: unknown;
    try { body = await request.json(); } catch { return err("Request body must be valid JSON", 400); }
    if (!body || typeof body !== "object") return err("Request body must be an object", 400);
    const b = body as Record<string, unknown>;

    const validCategories = ["inspection", "maintenance", "incident", "audit", "general"] as const;
    type ValidCategory = (typeof validCategories)[number];
    const rawCategory = b.category as string | undefined;
    const category = rawCategory !== undefined
      ? (validCategories.includes(rawCategory as ValidCategory) ? (rawCategory as ValidCategory) : undefined)
      : undefined;

    try {
      await ctx.runMutation(internal.logs._updateFromApi, {
        logId,
        userId: auth.userId,
        title: typeof b.title === "string" ? b.title : undefined,
        content: typeof b.content === "string" ? b.content : undefined,
        category,
        loggedAt: typeof b.loggedAt === "string" ? b.loggedAt : undefined,
        location: typeof b.location === "string" ? b.location : undefined,
        latitude: typeof b.latitude === "number" ? b.latitude : undefined,
        longitude: typeof b.longitude === "number" ? b.longitude : undefined,
      });
      const updated = await ctx.runQuery(internal.logs._getByIdForApi, { logId, userId: auth.userId });
      if (!updated) return err("Log not found", 404);
      return json(updated);
    } catch (e) {
      return err(e instanceof Error ? e.message : "Failed to update log", 400);
    }
  }),
});

// ── DELETE /api/v1/logs/:id ───────────────────────────────────────────────────
http.route({
  pathPrefix: "/api/v1/logs/",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyApiKey(ctx, request);
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const logId = url.pathname.replace("/api/v1/logs/", "") as Id<"logs">;
    if (!logId) return err("Log ID is required in the URL path", 400);

    try {
      await ctx.runMutation(internal.logs._deleteFromApi, { logId, userId: auth.userId });
      return json({ deleted: true });
    } catch (e) {
      return err(e instanceof Error ? e.message : "Failed to delete log", 400);
    }
  }),
});

// ════════════════════════════════════════════════════════════════════════════
// STATS
// ════════════════════════════════════════════════════════════════════════════

// ── GET /api/v1/stats ─────────────────────────────────────────────────────────
http.route({
  path: "/api/v1/stats",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyApiKey(ctx, request);
    if (auth instanceof Response) return auth;

    const stats = await ctx.runQuery(internal.users._getStatsForApi, { userId: auth.userId });
    if (!stats) return err("User not found", 404);
    return json(stats);
  }),
});

// ── GET /photo-proxy?url=<encoded-url> ───────────────────────────────────────
// Fetches a photo server-side and re-serves it with CORS headers so the browser
// can read the bytes for PDF generation (avoids R2 CORS restrictions).
http.route({
  path: "/photo-proxy",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const photoUrl = new URL(request.url).searchParams.get("url");
    if (!photoUrl) {
      return new Response("Missing url parameter", { status: 400 });
    }
    try {
      const upstream = await fetch(photoUrl);
      if (!upstream.ok) {
        return new Response("Photo not found", { status: 404 });
      }
      const blob = await upstream.blob();
      return new Response(blob, {
        status: 200,
        headers: {
          "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch {
      return new Response("Failed to fetch photo", { status: 502 });
    }
  }),
});

http.route({
  path: "/photo-proxy",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});


http.route({
  path: "/paypal-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();

    const h = request.headers;
    const headers: Record<string, string> = {
      "paypal-auth-algo": h.get("paypal-auth-algo") ?? "",
      "paypal-cert-url": h.get("paypal-cert-url") ?? "",
      "paypal-transmission-id": h.get("paypal-transmission-id") ?? "",
      "paypal-transmission-sig": h.get("paypal-transmission-sig") ?? "",
      "paypal-transmission-time": h.get("paypal-transmission-time") ?? "",
    };

    await ctx.runAction(internal.paypal.actions.processWebhook, {
      body,
      headers,
    });

    return new Response(null, { status: 200 });
  }),
});

export default http;
