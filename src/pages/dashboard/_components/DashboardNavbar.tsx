import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth.ts";
import { useSubscription } from "@/hooks/use-subscription.ts";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { LogOut, User, CreditCard, Zap, Menu, Plug, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { APP_VERSION } from "@/lib/version.ts";

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

  return (
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
            src="https://cdn.hercules.app/file_Ntyxh5KPFwMSNtrnKtE21IB8"
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
              <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <span className="text-base text-muted-foreground max-w-36 truncate hidden md:block">
                {user?.profile.name ?? user?.profile.email ?? "Account"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <div className="px-4 py-4">
              <p className="text-lg font-semibold text-foreground truncate">
                {user?.profile.name ?? "User"}
              </p>
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
                // Clear all locally-cached query data before signing out so
                // a different user on this device doesn't see stale data.
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
  );
}
