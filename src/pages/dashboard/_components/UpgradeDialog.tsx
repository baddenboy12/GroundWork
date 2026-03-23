import { useNavigate } from "react-router-dom";
import { Lock, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { type SubscriptionTier, TIER_CONFIG } from "../_lib/subscription.ts";

type Props = {
  open: boolean;
  onClose: () => void;
  /** The minimum tier required to use the feature */
  requiredTier: SubscriptionTier;
  /** Short description of the locked feature */
  featureName: string;
  featureDescription?: string;
};

export default function UpgradeDialog({
  open,
  onClose,
  requiredTier,
  featureName,
  featureDescription,
}: Props) {
  const navigate = useNavigate();
  const config = TIER_CONFIG[requiredTier];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm [&>button]:w-12 [&>button]:h-12 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-xl [&>button]:bg-white/10 [&>button>svg]:!w-7 [&>button>svg]:!h-7 [&>button]:active:scale-75 [&>button]:transition-transform">
        <DialogHeader>
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center mb-3">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <DialogTitle className="text-xl">{featureName} is a {config.name} feature</DialogTitle>
          <DialogDescription className="text-base">
            {featureDescription ??
              `Upgrade to ${config.name} to unlock ${featureName.toLowerCase()}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-1.5">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {config.name} Plan
          </p>
          <p className="text-2xl font-bold text-foreground">
            {config.price}
            <span className="text-base font-normal text-muted-foreground ml-1">
              {config.period}
            </span>
          </p>
          <p className="text-base text-muted-foreground">{config.tagline}</p>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="ghost" className="flex-1 text-base" onClick={onClose}>
            Maybe later
          </Button>
          <Button
            className="flex-1 gap-1.5 text-base"
            onClick={() => {
              onClose();
              navigate("/billing");
            }}
          >
            <Zap className="w-4 h-4" /> View plans
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
