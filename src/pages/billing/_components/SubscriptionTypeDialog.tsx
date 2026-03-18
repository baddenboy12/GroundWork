import { useState } from "react";
import { User, Users, Minus, Plus } from "lucide-react";
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

const MEMBER_PRICE = 1.99;

type Props = {
  open: boolean;
  onClose: () => void;
  tier: SubscriptionTier;
  /** Called when the user confirms. additionalMembers = 0 means individual. */
  onConfirm: (additionalMembers: number) => void;
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
  const [additionalMembers, setAdditionalMembers] = useState(1);

  const cfg = TIER_CONFIG[tier];
  const basePrice = parseFloat(cfg.price.replace("$", ""));
  const totalPrice = mode === "team"
    ? (basePrice + additionalMembers * MEMBER_PRICE).toFixed(2)
    : basePrice.toFixed(2);

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
                Just you — 1 seat, no team sharing.
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
                Shared sites &amp; logs pool. You are the team admin.
              </p>

              {mode === "team" && (
                <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs text-muted-foreground font-medium">
                    Additional members (beyond you)
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setAdditionalMembers((n) => Math.max(1, n - 1))}
                      className="w-8 h-8 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-accent transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-bold text-foreground w-6 text-center">
                      {additionalMembers}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAdditionalMembers((n) => Math.min(50, n + 1))}
                      className="w-8 h-8 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-accent transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs text-muted-foreground">
                      +${(additionalMembers * MEMBER_PRICE).toFixed(2)}/mo
                    </span>
                  </div>

                  {/* Price breakdown */}
                  <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>{cfg.name} base</span>
                      <span>{cfg.price}/mo</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{additionalMembers} member{additionalMembers !== 1 ? "s" : ""} × $1.99</span>
                      <span>+${(additionalMembers * MEMBER_PRICE).toFixed(2)}/mo</span>
                    </div>
                    <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1 mt-1">
                      <span>Total</span>
                      <span>${totalPrice}/mo</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    PayPal charges the base plan. Additional member fees are billed separately.
                  </p>
                </div>
              )}

              {mode !== "team" && (
                <p className="text-sm font-bold text-foreground mt-2">
                  from {cfg.price}*
                  <span className="text-xs font-normal text-muted-foreground ml-1">/ month</span>
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
            onClick={() => onConfirm(mode === "team" ? additionalMembers : 0)}
            disabled={isPending}
          >
            {isPending ? "Redirecting…" : `Continue to PayPal — $${totalPrice}/mo`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
