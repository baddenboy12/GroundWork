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
import { LogOut, User, CreditCard, Zap, Menu, Plug } from "lucide-react";
import { cn } from "@/lib/utils.ts";

const TIER_BADGE_STYLE: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  starter: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  pro: "bg-primary/15 text-primary border-primary/30",
  business: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

type Props = {
  onNewLog: () => void;
  /** Mobile only: opens the site list sheet */
  onMenuClick?: () => void;
};

export default function DashboardNavbar({ onNewLog, onMenuClick }: Props) {
  const { user, removeUser } = useAuth();
  const { tier, config } = useSubscription();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-6 shrink-0">
      {/* Left: hamburger (mobile) + logo */}
      <div className="flex items-center gap-2">
        {isMobile && onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={onMenuClick}
          >
            <Menu className="w-5 h-5" />
          </Button>
        )}
        <button
          className="flex items-center gap-2"
          onClick={() => navigate("/")}
        >
          <img
            src="https://cdn.hercules.app/file_Ntyxh5KPFwMSNtrnKtE21IB8"
            alt="GroundWork"
            className="w-8 h-8 rounded-md"
          />
          <span className="font-bold text-foreground hidden sm:block">
            Ground<span className="text-primary">Work</span>
          </span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        {/* Plan badge — desktop only */}
        <button
          onClick={() => navigate("/billing")}
          className={cn(
            "hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-opacity hover:opacity-80",
            TIER_BADGE_STYLE[tier] ?? TIER_BADGE_STYLE.free
          )}
        >
          <Zap className="w-3 h-3" />
          {config.name}
        </button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 h-11 px-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground max-w-28 truncate hidden md:block">
                {user?.profile.name ?? user?.profile.email ?? "Account"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="px-4 py-3">
              <p className="text-base font-semibold text-foreground truncate">
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
            <DropdownMenuItem className="text-base py-3 gap-3" onClick={() => navigate("/billing")}>
              <CreditCard className="w-5 h-5" /> Subscription
            </DropdownMenuItem>
            <DropdownMenuItem className="text-base py-3 gap-3" onClick={() => navigate("/integrations")}>
              <Plug className="w-5 h-5" /> Integrations & API
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-base py-3 gap-3 text-destructive focus:text-destructive"
              onClick={() => removeUser()}
            >
              <LogOut className="w-5 h-5" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
