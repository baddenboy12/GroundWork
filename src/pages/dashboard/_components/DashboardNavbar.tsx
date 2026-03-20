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
      <header className="h-20 border-b border-border bg-card flex items-center justify-between px-4 md:px-6 shrink-0 gap-3">
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

        {/* Right controls */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Plan badge */}
          <button
            onClick={() => navigate("/billing")}
            className={cn(
              "hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-semibold transition-opacity hover:opacity-80",
              TIER_BADGE_STYLE[tier] ?? TIER_BADGE_STYLE.free
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            {config.name}
          </button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-3 h-14 px-3 rounded-xl">
                <div className={cn(
                  "w-11 h-11 rounded-full flex items-center justify-center shrink-0",
                  isMissingName ? "bg-amber-500/20" : "bg-primary/20"
                )}>
                  {isMissingName
                    ? <AlertCircle className="w-5 h-5 text-amber-500" />
                    : <User className="w-5 h-5 text-primary" />
                  }
                </div>
                <span className="text-base text-muted-foreground max-w-36 truncate hidden md:block">
                  {displayName ?? "Set your name"}
                </span>
              </Button>
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
