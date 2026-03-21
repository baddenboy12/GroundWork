import { useState } from "react";
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
  /** Mobile only: opens the site list sheet */
  onMenuClick?: () => void;
};

export default function DashboardNavbar({ onNewLog, onStats, onMenuClick }: Props) {
  const { user, removeUser } = useAuth();
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
            onClick={() => navigate("/")}
          >
            <img
              src="/icon/icon-192.png"
              alt="GroundWork"
              className="w-12 h-12 rounded-lg"
            />
            <span className="font-bold text-xl text-foreground hidden sm:block">
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
                    top: 0,
                    right: 0,
                    width: 50,
                    height: 50,
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
                      top: 6,
                      right: -10,
                      width: 72,
                      height: 18,
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
            <DropdownMenuContent align="end" className="w-72">
              <div className="px-4 py-4">
                {isMissingName ? (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <p className="text-sm text-amber-500 font-medium">No name set</p>
                  </div>
                ) : (
                  <p className="text-lg font-semibold text-foreground truncate">{displayName}</p>
                )}
                <p className="text-sm text-muted-foreground truncate">{user?.profile.email}</p>
                <Badge
                  variant="secondary"
                  className={cn(
                    "mt-2 text-xs px-2.5 py-1",
                    TIER_BADGE_STYLE[tier]
                  )}
                >
                  {config.name} plan
                </Badge>
              </div>
              <DropdownMenuSeparator />
              {/* Set / edit name */}
              <DropdownMenuItem
                className={cn(
                  "text-base py-3.5 gap-3",
                  isMissingName && "text-amber-500 focus:text-amber-500"
                )}
                onClick={openNameDialog}
              >
                <Pencil className="w-5 h-5" />
                {isMissingName ? "Set your name" : "Edit name"}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-base py-3.5 gap-3" onClick={() => navigate("/billing")}>
                <CreditCard className="w-5 h-5" /> Subscription
              </DropdownMenuItem>
              <DropdownMenuItem className="text-base py-3.5 gap-3" onClick={onStats}>
                <BarChart2 className="w-5 h-5" /> Statistics
              </DropdownMenuItem>
              <DropdownMenuItem className="text-base py-3.5 gap-3" onClick={() => navigate("/integrations")}>
                <Plug className="w-5 h-5" /> Integrations & API
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-base py-3.5 gap-3 text-destructive focus:text-destructive"
                onClick={async () => {
                  for (let i = localStorage.length - 1; i >= 0; i--) {
                    const k = localStorage.key(i);
                    if (k?.startsWith("gw_cache_")) localStorage.removeItem(k);
                  }
                  await removeUser();
                  navigate("/");
                }}
              >
                <LogOut className="w-5 h-5" /> Sign out
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs text-muted-foreground/50">Version</span>
                <span className="text-xs font-mono text-muted-foreground/50">v{APP_VERSION}</span>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Set / edit name dialog */}
      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isMissingName ? "Set your name" : "Edit name"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveName} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input
                placeholder="e.g. Corey Butler"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setNameDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={nameSaving || !nameInput.trim()}>
                {nameSaving ? "Saving…" : "Save name"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
