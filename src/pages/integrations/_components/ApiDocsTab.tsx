import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";

// Derive HTTP Actions base URL from the Convex deployment URL
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

export default function ApiDocsTab() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="font-semibold text-foreground">REST API Documentation</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Use the LogVault REST API to read and write log data from any system.
        </p>
      </div>

      <Section title="Base URL">
        <CodeBlock
          code={HTTP_BASE || "https://<deployment>.convex.site"}
          language="url"
        />
        <p className="text-xs text-muted-foreground">
          Find the exact URL under{" "}
          <span className="text-foreground font-medium">More → Backend → HTTP Actions URL</span>{" "}
          in your Hercules dashboard.
        </p>
      </Section>

      <Section title="Authentication">
        <p className="text-sm text-muted-foreground">
          Include your API key in the <code className="text-xs bg-muted px-1 rounded">Authorization</code> header
          of every request. Keys are available on the API Keys tab.
        </p>
        <CodeBlock
          code={`Authorization: Bearer lv_<your_api_key>`}
          language="header"
        />
        <CodeBlock
          code={`curl ${HTTP_BASE || "https://<deployment>.convex.site"}/api/v1/sites \\
  -H "Authorization: Bearer lv_<your_api_key>"`}
        />
      </Section>

      <Section title="Endpoints">
        <div className="space-y-5">
          {/* GET /api/v1/sites */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 font-mono">GET</span>
              <code className="text-sm font-mono text-foreground">/api/v1/sites</code>
            </div>
            <p className="text-xs text-muted-foreground">List all sites owned by the authenticated user.</p>
            <CodeBlock
              code={`{
  "sites": [
    {
      "id": "...",
      "name": "Warehouse A",
      "location": "Building 3, Level 2",
      "latitude": -26.2041,
      "longitude": 28.0473,
      "createdAt": "2025-01-15T08:00:00.000Z"
    }
  ]
}`}
              language="json"
            />
          </div>

          {/* GET /api/v1/logs */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 font-mono">GET</span>
              <code className="text-sm font-mono text-foreground">/api/v1/logs?siteId=&lt;id&gt;&amp;limit=50</code>
            </div>
            <p className="text-xs text-muted-foreground">
              List log entries for a site. <code className="bg-muted px-0.5 rounded">limit</code> defaults to 50, max 200.
            </p>
            <CodeBlock
              code={`curl "${HTTP_BASE || "https://<deployment>.convex.site"}/api/v1/logs?siteId=<siteId>" \\
  -H "Authorization: Bearer lv_<your_api_key>"`}
            />
          </div>

          {/* POST /api/v1/logs */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-green-500/15 text-green-400 font-mono">POST</span>
              <code className="text-sm font-mono text-foreground">/api/v1/logs</code>
            </div>
            <p className="text-xs text-muted-foreground">Create a new log entry. Also triggers any matching webhooks.</p>
            <CodeBlock
              code={`{
  "siteId": "<siteId>",         // required
  "title": "Quarterly review",  // required
  "content": "All checks completed. No issues found.",
  "category": "inspection",     // inspection | maintenance | incident | audit | general
  "loggedAt": "2025-06-01T09:00:00.000Z", // defaults to now
  "location": "Level 3 - East wing",
  "latitude": -26.2041,
  "longitude": 28.0473
}`}
              language="json"
            />
            <p className="text-xs text-muted-foreground">Returns <code className="bg-muted px-0.5 rounded">201</code> with <code className="bg-muted px-0.5 rounded">{"{ id: \"...\" }"}</code> on success.</p>
          </div>
        </div>
      </Section>

      <Section title="Webhook Signatures">
        <p className="text-sm text-muted-foreground">
          Every webhook delivery includes an <code className="text-xs bg-muted px-1 rounded">X-LogVault-Signature</code> header.
          Verify it to ensure the payload was sent by LogVault.
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
  const sig = req.headers["x-logvault-signature"];
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
    "content": "All checks completed. No issues found.",
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
