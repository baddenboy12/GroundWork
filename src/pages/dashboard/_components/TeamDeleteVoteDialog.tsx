import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import { Check, Clock, Trash2, Users, X } from "lucide-react";
import { cn } from "@/lib/utils.ts";

type Props = {
  open: boolean;
  onClose: () => void;
  siteId: Id<"sites"> | null;
  siteName: string;
  /** Called after the site is fully deleted (immediate or last vote). */
  onDeleted?: (id: Id<"sites">) => void;
};

function formatRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

export default function TeamDeleteVoteDialog({
  open,
  onClose,
  siteId,
  siteName,
  onDeleted,
}: Props) {
  // Tick every minute to keep the countdown live
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [open]);

  const vote = useQuery(
    api.siteDeleteVotes.getForSite,
    siteId ? { siteId } : "skip"
  );

  const proposeMutation = useMutation(api.siteDeleteVotes.propose);
  const castVoteMutation = useMutation(api.siteDeleteVotes.castVote);
  const cancelMutation = useMutation(api.siteDeleteVotes.cancel);

  const handlePropose = async () => {
    if (!siteId) return;
    try {
      const result = await proposeMutation({ siteId });
      if (result.immediate) {
        toast.success("Site deleted");
        onDeleted?.(siteId);
        onClose();
      } else {
        toast.success("Deletion vote started — all team members must approve");
      }
    } catch (err) {
      if (err instanceof ConvexError) {
        toast.error((err.data as { message: string }).message);
      } else {
        toast.error("Failed to start vote");
      }
    }
  };

  const handleCastVote = async () => {
    if (!vote) return;
    try {
      const result = await castVoteMutation({ voteId: vote.voteId });
      if (result.deleted) {
        toast.success("All members approved — site deleted");
        if (siteId) onDeleted?.(siteId);
        onClose();
      } else {
        toast.success("Your vote has been recorded");
      }
    } catch (err) {
      if (err instanceof ConvexError) {
        toast.error((err.data as { message: string }).message);
      } else {
        toast.error("Failed to cast vote");
      }
    }
  };

  const handleCancel = async () => {
    if (!vote) return;
    try {
      await cancelMutation({ voteId: vote.voteId });
      toast.success("Deletion vote cancelled");
    } catch (err) {
      if (err instanceof ConvexError) {
        toast.error((err.data as { message: string }).message);
      } else {
        toast.error("Failed to cancel vote");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        {vote === undefined ? (
          /* Loading */
          <div className="space-y-3 py-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : vote === null ? (
          /* ── No active vote: show the "propose" screen ─────────────────── */
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-destructive" />
                Delete team site
              </DialogTitle>
              <DialogDescription>
                Team sites require unanimous approval from all members before
                deletion.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-1">
              <div className="rounded-xl bg-destructive/8 border border-destructive/20 px-4 py-3 space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  &ldquo;{siteName}&rdquo;
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  All log entries will be permanently deleted. This cannot be
                  undone.
                </p>
              </div>
              <p className="text-xs text-center text-muted-foreground leading-relaxed">
                A 24-hour vote will be started. The site is deleted only when
                every team member approves.
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handlePropose}>
                Start deletion vote
              </Button>
            </div>
          </>
        ) : (
          /* ── Active vote: show progress + member checklist ─────────────── */
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Team deletion vote
              </DialogTitle>
              <DialogDescription>
                Proposed by {vote.proposerName} &middot; &ldquo;{siteName}&rdquo;
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-1">
              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    {vote.approvedCount} of {vote.memberCount} approved
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatRemaining(vote.expiresAt)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-destructive transition-all duration-500"
                    style={{
                      width: `${(vote.approvedCount / vote.memberCount) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Member list */}
              <div className="space-y-1.5">
                {vote.members.map((m) => (
                  <div
                    key={m.userId}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                      m.hasVoted ? "bg-destructive/8" : "bg-muted/40"
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]",
                        m.hasVoted
                          ? "bg-destructive/20 text-destructive"
                          : "bg-muted-foreground/20 text-muted-foreground"
                      )}
                    >
                      {m.hasVoted ? <Check className="w-3 h-3" /> : "…"}
                    </div>
                    <span
                      className={cn(
                        "flex-1 text-sm",
                        m.hasVoted ? "text-foreground font-medium" : "text-muted-foreground"
                      )}
                    >
                      {m.name}
                      {m.isMe && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </span>
                    {m.hasVoted && (
                      <span className="text-[10px] font-semibold text-destructive uppercase tracking-wide">
                        Approved
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>

              {/* Proposer can cancel */}
              {vote.isProposer && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={handleCancel}
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Cancel vote
                </Button>
              )}

              {/* Waiting for others — already voted */}
              {vote.hasVoted && !vote.isProposer && (
                <Button variant="ghost" size="sm" disabled>
                  <Check className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                  Vote recorded
                </Button>
              )}

              {/* Still needs to vote */}
              {!vote.hasVoted && (
                <Button variant="destructive" size="sm" onClick={handleCastVote}>
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  Approve deletion
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
