import { useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth.ts";
import { useSubscription } from "@/hooks/use-subscription.ts";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { LogOut, User, CreditCard, Zap, Menu, Plug, BarChart2, Pencil, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { APP_VERSION } from "@/lib/version.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

const TIER_BADGE_STYLE: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  starter: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  pro: "bg-primary/15 text-primary border-primary/30",
  business: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

type Props = {
  onNewLog: () => void;
  onStats: () => void;
  onIntegrations: () => void;
  onBilling: () => void;
  onHome: () => void;
  /** Mobile only: opens the site list sheet */
  onMenuClick?: () => void;
};

const METALLIC_STYLE: React.CSSProperties = {
  background: "linear-gradient(180deg, hsl(30 10% 14%) 0%, hsl(30 8% 9%) 100%)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.3)",
};

export default function DashboardNavbar({ onNewLog, onStats, onIntegrations, onBilling, onHome, onMenuClick }: Props) {
  const { user, removeUser, signoutRedirect } = useAuth();
  const { tier, config } = useSubscription();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // DB user for display name (more up-to-date than OIDC token)
  const dbUser = useQuery(api.users.getCurrentUser, {});
  const updateNameMutation = useMutation(api.users.updateName);

  // Display name: prefer DB name, fall back to OIDC profile name
  const dbName = dbUser?.name?.trim();
  const displayName = dbName || user?.profile.name || null;
  const isMissingName = !displayName;

  // Edit name dialog
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  const openNameDialog = () => {
    setNameInput(displayName ?? "");
    setNameDialogOpen(true);
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setNameSaving(true);
    try {
      await updateNameMutation({ name: nameInput.trim() });
      toast.success("Name updated.");
      setNameDialogOpen(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string } | undefined;
        toast.error(d?.message ?? "Failed to update name.");
      } else {
        toast.error("Failed to update name.");
      }
    } finally {
      setNameSaving(false);
    }
  };

  return (
    <>
      <header className="relative h-20 border-b border-border bg-card flex items-center px-4 md:px-6 shrink-0 gap-4">
        {/* Left: hamburger (mobile) + logo */}
        <div className="flex items-center gap-3 shrink-0">
          {isMobile && onMenuClick && (
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 shrink-0"
              onClick={onMenuClick}
            >
              <Menu className="w-6 h-6" />
            </Button>
          )}
          <button
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            onClick={onHome}
          >
            <img
              src="/icon/icon-192.png"
              alt="GroundWork"
              className="w-12 h-12 rounded-lg"
            />
            <span className="font-bold text-[1.55rem] text-foreground hidden sm:block">
              Ground<span className="text-primary">Work</span>
            </span>
          </button>
        </div>

        {/* Right controls — absolutely positioned so sizing doesn't affect left side */}
        <div className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {/* User menu with integrated tier ribbon */}
          <DropdownMenu onOpenChange={(open) => { if (!open) document.activeElement instanceof HTMLElement && document.activeElement.blur(); }}>
            <DropdownMenuTrigger asChild>
              <button
                className="relative flex items-center gap-3 h-[4.5rem] pl-5 pr-12 rounded-full active:scale-95 transition-transform focus:outline-none"
                style={{
                  backgroundColor: "hsl(30 12% 12%)",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                {/* User icon */}
                {isMissingName
                  ? <AlertCircle className="w-7 h-7 text-amber-500 shrink-0" />
                  : <User className="w-7 h-7 text-foreground shrink-0" />
                }
                {/* Name */}
                <span className="text-xl font-medium text-foreground truncate">
                  {displayName ?? "Set name"}
                </span>
                {/* Tier ribbon — diagonal sash clipped to top-right corner */}
                <div
                  className="absolute overflow-hidden"
                  style={{
                    top: -2,
                    right: -2,
                    width: 56,
                    height: 56,
                    borderRadius: "0 9999px 0 0",
                  }}
                >
                  <div
                    className={cn(
                      "absolute flex items-center justify-center",
                      tier === "business" && "bg-amber-500/90 text-amber-950",
                      tier === "pro" && "bg-primary/90 text-primary-foreground",
                      tier === "starter" && "bg-blue-500/90 text-white",
                      tier === "free" && "bg-muted text-muted-foreground",
                    )}
                    style={{
                      top: 10,
                      right: -8,
                      width: 72,
                      height: 20,
                      transform: "rotate(35deg)",
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {config.name}
                  </div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-4 rounded-3xl" style={{ backgroundColor: "hsl(30 12% 12%)", border: "1px solid hsl(var(--border))" }}>
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
                }}
              >
              <motion.div className="px-4 py-5" variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
                {isMissingName ? (
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
                    <p className="text-xl text-amber-500 font-medium">No name set</p>
                  </div>
                ) : (
                  <p className="text-2xl font-semibold text-foreground truncate">{displayName}</p>
                )}
                <p className="text-lg text-muted-foreground truncate mt-1">{user?.profile.email}</p>
                <Badge
                  variant="secondary"
                  className={cn(
                    "mt-3 text-sm px-3 py-1.5",
                    TIER_BADGE_STYLE[tier]
                  )}
                >
                  {config.name} plan
                </Badge>
              </motion.div>
              <DropdownMenuSeparator />
              {/* Set / edit name */}
              <motion.div variants={{ hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0 } }}>
              <DropdownMenuItem
                style={METALLIC_STYLE}
                className={cn(
                  "text-xl py-4 gap-3 my-1 rounded-2xl active:scale-95 transition-transform border border-white/[0.06]",
                  isMissingName && "text-amber-500 focus:text-amber-500"
                )}
                onClick={openNameDialog}
              >
                <Pencil className="w-7 h-7" />
                {isMissingName ? "Set your name" : "Edit name"}
              </DropdownMenuItem>
              </motion.div>
              <motion.div variants={{ hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0 } }}>
              <DropdownMenuItem style={METALLIC_STYLE} className="text-xl py-4 gap-3 my-1 rounded-2xl active:scale-95 transition-transform border border-white/[0.06]" onClick={onBilling}>
                <CreditCard className="w-7 h-7" /> Subscription
              </DropdownMenuItem>
              </motion.div>
              <motion.div variants={{ hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0 } }}>
              <DropdownMenuItem style={METALLIC_STYLE} className="text-xl py-4 gap-3 my-1 rounded-2xl active:scale-95 transition-transform border border-white/[0.06]" onClick={onStats}>
                <BarChart2 className="w-7 h-7" /> Statistics
              </DropdownMenuItem>
              </motion.div>
              <motion.div variants={{ hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0 } }}>
              <DropdownMenuItem style={METALLIC_STYLE} className="text-xl py-4 gap-3 my-1 rounded-2xl active:scale-95 transition-transform border border-white/[0.06]" onClick={onIntegrations}>
                <Plug className="w-7 h-7" /> Integrations & API
              </DropdownMenuItem>
              </motion.div>
              <DropdownMenuSeparator />
              <motion.div variants={{ hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0 } }}>
              <DropdownMenuItem
                style={{
                  background: "linear-gradient(180deg, hsl(5 20% 14%) 0%, hsl(5 18% 9%) 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,100,100,0.08), inset 0 -1px 0 rgba(0,0,0,0.3)",
                }}
                className="text-xl py-4 gap-3 my-1 rounded-2xl active:scale-95 transition-transform border border-red-900/30 text-destructive focus:text-destructive"
                onClick={async () => {
                  for (let i = localStorage.length - 1; i >= 0; i--) {
                    const k = localStorage.key(i);
                    if (k?.startsWith("gw_cache_")) localStorage.removeItem(k);
                  }
                  await signoutRedirect();
                }}
              >
                <LogOut className="w-7 h-7" /> Sign out
              </DropdownMenuItem>
              </motion.div>
              <DropdownMenuSeparator />
              <motion.div className="px-4 py-3 flex items-center justify-end pr-8" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}>
                <span className="text-sm font-mono text-green-500/70">v{APP_VERSION}</span>
              </motion.div>
              </motion.div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Set / edit name dialog */}
      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent
          className="sm:max-w-md !top-[30%] !translate-y-0 rounded-3xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-3xl">{isMissingName ? "Set your name" : "Edit name"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveName} className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label className="text-xl font-semibold">Display name</Label>
              <Input
                placeholder="e.g. Corey Butler"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="h-16 !text-[22px] rounded-xl"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" className="text-lg py-5 px-6 rounded-xl" onClick={() => setNameDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="text-lg py-5 px-6 rounded-xl" disabled={nameSaving || !nameInput.trim()}>
                {nameSaving ? "Saving…" : "Save name"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
