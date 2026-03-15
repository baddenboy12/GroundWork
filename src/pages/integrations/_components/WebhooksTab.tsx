import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Webhook, Plus, Trash2, Play, ToggleLeft, ToggleRight, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";

const WEBHOOK_EVENTS = [
  { value: "log.created", label: "Log created", description: "Fires when a new log entry is added" },
  { value: "log.updated", label: "Log updated", description: "Fires when a log entry is edited" },
  { value: "log.deleted", label: "Log deleted", description: "Fires when a log entry is removed" },
];

export default function WebhooksTab() {
  const webhooks = useQuery(api.integrations.webhooks.list, {});
  const createWebhook = useAction(api.integrations.webhookActions.create);
  const testWebhook = useAction(api.integrations.webhookActions.test);
  const toggleWebhook = useMutation(api.integrations.webhooks.toggle);
  const deleteWebhook = useMutation(api.integrations.webhooks.remove);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["log.created"]);
  const [isCreating, setIsCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<Id<"webhooks"> | null>(null);
  const [testingId, setTestingId] = useState<Id<"webhooks"> | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Webhook name is required"); return; }
    if (!url.trim()) { toast.error("URL is required"); return; }
    if (events.length === 0) { toast.error("Select at least one event"); return; }
    setIsCreating(true);
    try {
      const result = await createWebhook({ name: name.trim(), url: url.trim(), events });
      setNewSecret(result.secret);
      setAddOpen(false);
      setName(""); setUrl(""); setEvents(["log.created"]);
    } catch (e) {
      const msg = e instanceof ConvexError
        ? (e.data as { message: string }).message
        : "Failed to create webhook";
      toast.error(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleTest = async (webhookId: Id<"webhooks">) => {
    setTestingId(webhookId);
    try {
      const result = await testWebhook({ webhookId });
      if (result.success) {
        toast.success(`Test delivered successfully (HTTP ${result.status})`);
      } else {
        toast.error(result.error ?? `Delivery failed (HTTP ${result.status ?? "?"})`);
      }
    } catch { toast.error("Test failed"); }
    setTestingId(null);
  };

  const handleCopySecret = async () => {
    if (!newSecret) return;
    await navigator.clipboard.writeText(newSecret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const toggleEvent = (event: string) => {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground">Webhooks</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Receive real-time event notifications at your endpoint URLs.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4" /> Add webhook
        </Button>
      </div>

      {/* Webhook list */}
      {webhooks === undefined ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : webhooks.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Webhook /></EmptyMedia>
            <EmptyTitle>No webhooks yet</EmptyTitle>
            <EmptyDescription>Add a webhook to receive event notifications</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Add webhook
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div
              key={wh._id}
              className="border border-border rounded-xl px-4 py-3 bg-card space-y-2"
            >
              <div className="flex items-start gap-3">
                <Webhook className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{wh.name}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{wh.url}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {wh.events.map((ev) => (
                      <Badge key={ev} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {ev}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px] shrink-0",
                    wh.isActive
                      ? "bg-green-500/15 text-green-400 border-green-500/30"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {wh.isActive ? "Active" : "Paused"}
                </Badge>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    title={wh.isActive ? "Pause" : "Enable"}
                    onClick={() => toggleWebhook({ webhookId: wh._id })}
                  >
                    {wh.isActive
                      ? <ToggleRight className="w-3.5 h-3.5 text-green-500" />
                      : <ToggleLeft className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    title="Send test"
                    disabled={testingId === wh._id}
                    onClick={() => handleTest(wh._id)}
                  >
                    <Play className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title="Delete"
                    onClick={() => setDeleteTargetId(wh._id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add webhook dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add webhook</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Slack notifications"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Endpoint URL</Label>
              <Input
                placeholder="https://example.com/webhook"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                type="url"
              />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              {WEBHOOK_EVENTS.map((ev) => (
                <div key={ev.value} className="flex items-start gap-3">
                  <Checkbox
                    id={ev.value}
                    checked={events.includes(ev.value)}
                    onCheckedChange={() => toggleEvent(ev.value)}
                  />
                  <div>
                    <label htmlFor={ev.value} className="text-sm font-medium cursor-pointer">
                      {ev.label}
                    </label>
                    <p className="text-xs text-muted-foreground">{ev.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? "Creating…" : "Create webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show signing secret — one-time display */}
      <Dialog open={!!newSecret} onOpenChange={(open) => !open && setNewSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook signing secret</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Use this secret to verify that webhook payloads are sent by LogVault.
              Compute <code className="text-xs bg-muted px-1 rounded">HMAC-SHA256(secret, body)</code> and
              compare it to the <code className="text-xs bg-muted px-1 rounded">X-LogVault-Signature</code> header.
            </p>
            <div className="rounded-lg bg-muted/60 border border-border p-3">
              <p className="font-mono text-sm break-all text-foreground select-all">{newSecret}</p>
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-600 dark:text-amber-400">
              Copy this secret now — it will never be shown again.
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCopySecret} className="gap-1.5">
              {secretCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {secretCopied ? "Copied!" : "Copy secret"}
            </Button>
            <Button variant="secondary" onClick={() => setNewSecret(null)}>
              {"I've saved my secret"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(v) => !v && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              This endpoint will stop receiving events immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTargetId) return;
                try {
                  await deleteWebhook({ webhookId: deleteTargetId });
                  toast.success("Webhook deleted");
                } catch { toast.error("Failed to delete webhook"); }
                setDeleteTargetId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
