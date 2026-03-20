import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";

const convexUrl = import.meta.env.VITE_CONVEX_URL ?? "";
const HTTP_BASE = convexUrl.replace("convex.cloud", "convex.site");

type CodeBlockProps = { code: string; language?: string };

function CodeBlock({ code, language = "bash" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group rounded-lg bg-muted/60 border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/40">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
          {language}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
        >
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        </Button>
      </div>
      <pre className="text-xs p-4 overflow-x-auto text-foreground/90 font-mono whitespace-pre leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

type SectionProps = { title: string; children: React.ReactNode };
function Section({ title, children }: SectionProps) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">{title}</h3>
      {children}
    </section>
  );
}

type MethodBadgeProps = { method: "GET" | "POST" | "PATCH" | "DELETE" };
function MethodBadge({ method }: MethodBadgeProps) {
  const colors: Record<MethodBadgeProps["method"], string> = {
    GET: "bg-blue-500/15 text-blue-400",
    POST: "bg-green-500/15 text-green-400",
    PATCH: "bg-amber-500/15 text-amber-400",
    DELETE: "bg-red-500/15 text-red-400",
  };
  return (
    <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded font-mono", colors[method])}>
      {method}
    </span>
  );
}

type EndpointProps = {
  method: MethodBadgeProps["method"];
  path: string;
  description: string;
  body?: string;
  response?: string;
  notes?: string;
};

function Endpoint({ method, path, description, body, response, notes }: EndpointProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <MethodBadge method={method} />
        <code className="text-sm font-mono text-foreground">{path}</code>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {notes && <p className="text-xs text-muted-foreground/70 italic">{notes}</p>}
      {body && <CodeBlock code={body} language="json — request body" />}
      {response && <CodeBlock code={response} language="json — response" />}
    </div>
  );
}

export default function ApiDocsTab() {
  const base = HTTP_BASE || "https://<deployment>.convex.site";

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="font-semibold text-foreground">REST API Documentation</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Use the GroundWork REST API to read and write data from any external system.
          Requires a <strong>Business plan</strong> and an active API key.
        </p>
      </div>

      {/* Base URL */}
      <Section title="Base URL">
        <CodeBlock code={base} language="url" />
        <p className="text-xs text-muted-foreground">
          Find the exact URL under{" "}
          <span className="text-foreground font-medium">More → Backend → HTTP Actions URL</span>{" "}
          in your Convex dashboard.
        </p>
      </Section>

      {/* Auth */}
      <Section title="Authentication">
        <p className="text-sm text-muted-foreground">
          Include your API key in the{" "}
          <code className="text-xs bg-muted px-1 rounded">Authorization</code> header of every request.
          Keys are created on the API Keys tab.
        </p>
        <CodeBlock code={`Authorization: Bearer lv_<your_api_key>`} language="header" />
        <CodeBlock
          code={`curl ${base}/api/v1/sites \\\n  -H "Authorization: Bearer lv_<your_api_key>"`}
        />
      </Section>

      {/* Sites endpoints */}
      <Section title="Sites">
        <div className="space-y-6">
          <Endpoint
            method="GET"
            path="/api/v1/sites"
            description="List all sites owned by the authenticated user."
            response={`{
  "sites": [
    {
      "id": "...",
      "name": "Warehouse A",
      "description": "Main storage facility",
      "location": "Building 3, Level 2",
      "latitude": -26.2041,
      "longitude": 28.0473,
      "createdAt": "2025-01-15T08:00:00.000Z"
    }
  ]
}`}
          />

          <Endpoint
            method="POST"
            path="/api/v1/sites"
            description="Create a new site."
            body={`{
  "name": "Warehouse A",          // required
  "description": "Main facility", // optional
  "location": "Building 3",       // optional
  "latitude": -26.2041,           // optional
  "longitude": 28.0473            // optional
}`}
            response={`{ "id": "..." }  // 201 Created`}
          />

          <Endpoint
            method="PATCH"
            path="/api/v1/sites/:id"
            description="Update a site. Only include fields you want to change."
            body={`{
  "name": "Updated Name",  // any combination of fields
  "location": "New location"
}`}
            response={`{ "id": "...", "name": "Updated Name", ... }`}
          />

          <Endpoint
            method="DELETE"
            path="/api/v1/sites/:id"
            description="Permanently delete a site and all its log entries. R2 photos are also cleaned up."
            response={`{ "deleted": true }`}
          />
        </div>
      </Section>

      {/* Logs endpoints */}
      <Section title="Logs">
        <div className="space-y-6">
          <Endpoint
            method="GET"
            path="/api/v1/logs?siteId=<id>&limit=50"
            description="List log entries for a site ordered newest first."
            notes="limit defaults to 50, max 200."
            response={`{
  "logs": [
    {
      "id": "...",
      "siteId": "...",
      "title": "Quarterly review",
      "content": "All checks completed.",
      "category": "inspection",
      "loggedAt": "2025-06-01T09:00:00.000Z",
      "location": "Level 3",
      "latitude": -26.2041,
      "longitude": 28.0473,
      "photoCount": 2,
      "createdAt": "2025-06-01T09:00:00.000Z"
    }
  ]
}`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/logs/:id"
            description="Fetch a single log entry by its ID."
            response={`{
  "id": "...",
  "siteId": "...",
  "title": "Quarterly review",
  "content": "All checks completed.",
  "category": "inspection",
  "loggedAt": "2025-06-01T09:00:00.000Z",
  "photoCount": 2,
  "createdAt": "2025-06-01T09:00:00.000Z"
}`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/logs/search?siteId=<id>&q=<query>&category=<cat>&limit=50"
            description="Full-text search log titles within a site."
            notes="category is optional: inspection | maintenance | incident | audit | general. limit defaults to 50, max 100."
            response={`{ "logs": [...], "count": 3 }`}
          />

          <Endpoint
            method="POST"
            path="/api/v1/logs"
            description="Create a new log entry. Fires matching webhooks automatically."
            body={`{
  "siteId": "...",               // required
  "title": "Quarterly review",   // required
  "content": "All checks passed.",
  "category": "inspection",      // inspection | maintenance | incident | audit | general
  "loggedAt": "2025-06-01T09:00:00.000Z",  // defaults to now
  "location": "Level 3 - East wing",
  "latitude": -26.2041,
  "longitude": 28.0473
}`}
            response={`{ "id": "..." }  // 201 Created`}
          />

          <Endpoint
            method="PATCH"
            path="/api/v1/logs/:id"
            description="Update a log entry. Only include fields you want to change. Photos cannot be changed via API."
            body={`{
  "title": "Updated title",   // any combination of fields
  "category": "maintenance",
  "content": "New notes here"
}`}
            response={`{ "id": "...", "title": "Updated title", ... }`}
          />

          <Endpoint
            method="DELETE"
            path="/api/v1/logs/:id"
            description="Permanently delete a log entry. R2 photos are also cleaned up."
            response={`{ "deleted": true }`}
          />
        </div>
      </Section>

      {/* Stats endpoint */}
      <Section title="Stats">
        <Endpoint
          method="GET"
          path="/api/v1/stats"
          description="Get a summary of your account — site count, log count, and storage usage."
          response={`{
  "totalSites": 12,
  "totalLogs": 347,
  "storageUsedBytes": 52428800,
  "storageLimitBytes": 5368709120,
  "subscriptionTier": "business"
}`}
        />
      </Section>

      {/* Webhook signatures */}
      <Section title="Webhook Signatures">
        <p className="text-sm text-muted-foreground">
          Every webhook delivery includes an{" "}
          <code className="text-xs bg-muted px-1 rounded">X-GroundWork-Signature</code> header.
          Verify it to ensure the payload was sent by GroundWork.
        </p>
        <CodeBlock
          code={`// Node.js verification example
import * as crypto from "crypto";

function verifySignature(secret, rawBody, signatureHeader) {
  const expected = "sha256=" +
    crypto.createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signatureHeader)
  );
}

// Express example
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["x-groundwork-signature"];
  if (!verifySignature(process.env.WEBHOOK_SECRET, req.body, sig)) {
    return res.status(401).send("Invalid signature");
  }
  const event = JSON.parse(req.body);
  console.log(event.event, event.data);
  res.sendStatus(200);
});`}
          language="javascript"
        />
      </Section>

      {/* Webhook payload */}
      <Section title="Webhook Payload">
        <CodeBlock
          code={`{
  "event": "log.created",
  "timestamp": "2025-06-01T09:00:00.000Z",
  "data": {
    "logId": "...",
    "siteId": "...",
    "siteName": "Warehouse A",
    "title": "Quarterly review",
    "content": "All checks completed.",
    "category": "inspection",
    "loggedAt": "2025-06-01T09:00:00.000Z",
    "location": "Level 3 - East wing",
    "latitude": -26.2041,
    "longitude": 28.0473
  }
}`}
          language="json"
        />
      </Section>
    </div>
  );
}
