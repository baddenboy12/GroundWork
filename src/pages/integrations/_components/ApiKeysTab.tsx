import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { format } from "date-fns";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Key, Plus, Trash2, ShieldOff, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
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

export default function ApiKeysTab() {
  const keys = useQuery(api.integrations.apiKeys.list, {});
  const generateKey = useAction(api.integrations.apiKeysActions.create);
  const revokeKey = useMutation(api.integrations.apiKeys.revoke);
  const deleteKey = useMutation(api.integrations.apiKeys.remove);

  const [createOpen, setCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<Id<"apiKeys"> | null>(null);

  const handleCreate = async () => {
    if (!keyName.trim()) { toast.error("Enter a name for the key"); return; }
    setIsCreating(true);
    try {
      const result = await generateKey({ name: keyName.trim() });
      setNewKey(result.fullKey);
      setCreateOpen(false);
      setKeyName("");
    } catch (e) {
      const msg = e instanceof ConvexError
        ? (e.data as { message: string }).message
        : "Failed to generate API key";
      toast.error(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyKey = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  const handleRevoke = async (keyId: Id<"apiKeys">) => {
    try {
      await revokeKey({ keyId });
      toast.success("API key revoked");
    } catch { toast.error("Failed to revoke key"); }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteKey({ keyId: deleteTargetId });
      toast.success("API key deleted");
    } catch { toast.error("Failed to delete key"); }
    setDeleteTargetId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground text-2xl">API Keys</h2>
          <p className="text-base text-muted-foreground mt-1">
            Use keys to authenticate REST API requests from external systems.
          </p>
        </div>
        <Button className="gap-2 text-lg px-5 py-3 h-auto rounded-xl active:scale-95 transition-transform" onClick={() => setCreateOpen(true)}>
          <Plus className="w-5 h-5" /> Generate key
        </Button>
      </div>

      {/* Key list */}
      {keys === undefined ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : keys.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Key className="w-10 h-10" /></EmptyMedia>
            <EmptyTitle className="text-2xl">No API keys yet</EmptyTitle>
            <EmptyDescription className="text-lg">Generate a key to start using the REST API</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button className="gap-2 text-lg px-5 py-3 h-auto rounded-xl active:scale-95 transition-transform" onClick={() => setCreateOpen(true)}>
              <Plus className="w-5 h-5" /> Generate key
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <div
              key={k._id}
              className="flex items-center gap-4 border border-border rounded-2xl px-5 py-4 bg-card"
            >
              <Key className="w-6 h-6 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-lg font-medium text-foreground">{k.name}</p>
                <p className="text-sm text-muted-foreground font-mono mt-0.5">{k.keyPrefix}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                <span>Created {format(new Date(k._creationTime), "MMM d, yyyy")}</span>
                {k.lastUsedAt && (
                  <span className="hidden sm:inline">
                    · Last used {format(new Date(k.lastUsedAt), "MMM d")}
                  </span>
                )}
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  "text-sm shrink-0 px-3 py-1",
                  k.isActive
                    ? "bg-green-500/15 text-green-400 border-green-500/30"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {k.isActive ? "Active" : "Revoked"}
              </Badge>
              <div className="flex items-center gap-2 shrink-0">
                {k.isActive && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-12 w-12 rounded-xl text-muted-foreground hover:text-amber-500 active:scale-90 transition-all"
                    title="Revoke"
                    onClick={() => handleRevoke(k._id)}
                  >
                    <ShieldOff className="w-5 h-5" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-12 w-12 rounded-xl text-muted-foreground hover:text-destructive active:scale-90 transition-all"
                  title="Delete"
                  onClick={() => setDeleteTargetId(k._id)}
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create key dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-3xl !top-[5%] !translate-y-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-2xl">Generate API key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-lg font-semibold">Key name</Label>
              <Input
                placeholder="e.g. Production integration"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="h-14 !text-[20px] rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" className="text-lg px-5 py-3 h-auto rounded-xl" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button className="text-lg px-5 py-3 h-auto rounded-xl" onClick={handleCreate} disabled={isCreating}>
              {isCreating ? "Generating…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show the new key — one-time display */}
      <Dialog open={!!newKey} onOpenChange={(open) => !open && setNewKey(null)}>
        <DialogContent className="rounded-3xl !top-[5%] !translate-y-0">
          <DialogHeader>
            <DialogTitle className="text-2xl">Your new API key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl bg-muted/60 border border-border p-4">
              <p className="font-mono text-base break-all text-foreground select-all">{newKey}</p>
            </div>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 text-base text-amber-600 dark:text-amber-400">
              Copy this key now — it will never be shown again.
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCopyKey} className="gap-2 text-lg px-5 py-3 h-auto rounded-xl active:scale-95 transition-transform">
              {keyCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {keyCopied ? "Copied!" : "Copy key"}
            </Button>
            <Button variant="secondary" className="text-lg px-5 py-3 h-auto rounded-xl" onClick={() => setNewKey(null)}>
              {"I've saved my key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(v) => !v && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API key?</AlertDialogTitle>
            <AlertDialogDescription>
              Any integrations using this key will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
