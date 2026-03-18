import { useState } from "react";
import { User, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { TIER_CONFIG, type SubscriptionTier } from "../../dashboard/_lib/subscription.ts";

type Props = {
  open: boolean;
  onClose: () => void;
  tier: SubscriptionTier;
  /** Called when the user confirms. isTeam = true means create a team workspace. */
  onConfirm: (isTeam: boolean) => void;
  isPending?: boolean;
};

export default function SubscriptionTypeDialog({
  open,
  onClose,
  tier,
  onConfirm,
  isPending = false,
}: Props) {
  const [mode, setMode] = useState<"individual" | "team">("individual");

  const cfg = TIER_CONFIG[tier];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>How will you use GroundWork?</DialogTitle>
          <DialogDescription>
            Choose whether you are subscribing for yourself or setting up a team workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Individual option */}
          <button
            type="button"
            onClick={() => setMode("individual")}
            className={cn(
              "w-full flex items-start gap-4 rounded-xl border p-4 text-left transition-colors",
              mode === "individual"
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40"
            )}
          >
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
              mode === "individual" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            )}>
              <User className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Individual</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Just you — your own private workspace.
              </p>
              <p className="text-sm font-bold text-foreground mt-2">
                {cfg.price}
                <span className="text-xs font-normal text-muted-foreground ml-1">/ month</span>
              </p>
            </div>
          </button>

          {/* Team option */}
          <button
            type="button"
            onClick={() => setMode("team")}
            className={cn(
              "w-full flex items-start gap-4 rounded-xl border p-4 text-left transition-colors",
              mode === "team"
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40"
            )}
          >
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
              mode === "team" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            )}>
              <Users className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm">Team</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Create a shared team workspace. You will be the admin and can
                add members by sharing your team key.
              </p>
              <p className="text-sm font-bold text-foreground mt-2">
                {cfg.price}
                <span className="text-xs font-normal text-muted-foreground ml-1">/ month</span>
              </p>
              {mode === "team" && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Team sites are separate from your personal sites. Members can
                  be added or removed at any time from the billing page.
                </p>
              )}
            </div>
          </button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(mode === "team")}
            disabled={isPending}
          >
            {isPending ? "Redirecting…" : `Continue to PayPal — ${cfg.price}/mo`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
