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

/** Price per extra member seat above the first (in dollars) */
export const EXTRA_SEAT_PRICE = 1.99;

/** Maximum number of seats allowed per team */
export const MAX_TEAM_SEATS = 50;

function calcTeamPrice(basePriceStr: string, seats: number): string {
  const base = parseFloat(basePriceStr.replace("$", ""));
  const total = base + Math.max(0, seats - 1) * EXTRA_SEAT_PRICE;
  return `$${total.toFixed(2)}`;
}

type Props = {
  open: boolean;
  onClose: () => void;
  tier: SubscriptionTier;
  /** Called when the user confirms. isTeam = true means create a team workspace. */
  onConfirm: (isTeam: boolean, maxMembers: number) => void;
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
  const [seats, setSeats] = useState(1);

  const cfg = TIER_CONFIG[tier];
  const basePrice = parseFloat(cfg.price.replace("$", ""));
  const extraSeats = Math.max(0, seats - 1);
  const totalPrice = basePrice + extraSeats * EXTRA_SEAT_PRICE;

  const handleConfirm = () => {
    onConfirm(mode === "team", mode === "team" ? seats : 1);
  };

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
              {mode !== "team" && (
                <p className="text-sm font-bold text-foreground mt-2">
                  {cfg.price}
                  <span className="text-xs font-normal text-muted-foreground ml-1">+ ${EXTRA_SEAT_PRICE}/extra seat /mo</span>
                </p>
              )}
            </div>
          </button>

          {/* Seat selector — only visible when team mode is active */}
          {mode === "team" && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4">
              {/* Seat counter */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-foreground">Number of seats</p>
                <p className="text-xs text-muted-foreground">
                  How many people (including you) will use this workspace?
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setSeats(Math.max(1, seats - 1))}
                    className="w-8 h-8 rounded-lg border border-border bg-background flex items-center justify-center text-foreground hover:bg-accent transition-colors disabled:opacity-40"
                    disabled={seats <= 1}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex-1 text-center">
                    <span className="text-xl font-bold text-foreground">{seats}</span>
                    <span className="text-xs text-muted-foreground ml-1.5">
                      {seats === 1 ? "member" : "members"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSeats(Math.min(MAX_TEAM_SEATS, seats + 1))}
                    className="w-8 h-8 rounded-lg border border-border bg-background flex items-center justify-center text-foreground hover:bg-accent transition-colors disabled:opacity-40"
                    disabled={seats >= MAX_TEAM_SEATS}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Price breakdown */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>{cfg.name} base plan</span>
                  <span>{cfg.price}/mo</span>
                </div>
                {extraSeats > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>
                      {extraSeats} extra seat{extraSeats > 1 ? "s" : ""} × ${EXTRA_SEAT_PRICE.toFixed(2)}
                    </span>
                    <span>${(extraSeats * EXTRA_SEAT_PRICE).toFixed(2)}/mo</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-foreground border-t border-border/60 pt-1.5 mt-1">
                  <span>Total</span>
                  <span>{calcTeamPrice(cfg.price, seats)}/mo</span>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                You can adjust the number of seats any time from the billing page.
                New members will not be able to join once all seats are filled.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending
              ? "Redirecting…"
              : `Continue to Stripe — ${
                  mode === "team"
                    ? `${calcTeamPrice(cfg.price, seats)}/mo`
                    : `${cfg.price}/mo`
                }`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
