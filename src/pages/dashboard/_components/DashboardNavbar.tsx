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
import { LogOut, User, CreditCard, Zap, Plus, Menu, Plug } from "lucide-react";
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
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 md:px-6 shrink-0">
      {/* Left: hamburger (mobile) + logo */}
      <div className="flex items-center gap-2">
        {isMobile && onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onMenuClick}
          >
            <Menu className="w-4 h-4" />
          </Button>
        )}
        <button
          className="flex items-center gap-2"
          onClick={() => navigate("/")}
        >
          <img
            src="https://cdn.hercules.app/file_MTBkFtbeCZf1g1fwPkBRL5mk"
            alt="LogVault"
            className="w-7 h-7 rounded-md"
          />
          <span className="font-bold text-foreground hidden sm:block">
            Log<span className="text-primary">Vault</span>
          </span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        {/* New log — icon only on mobile, label on desktop */}
        <Button size="sm" className="gap-1.5" onClick={onNewLog}>
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New log</span>
        </Button>

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
            <Button variant="ghost" className="gap-2 h-8 px-2">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground max-w-28 truncate hidden md:block">
                {user?.profile.name ?? user?.profile.email ?? "Account"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.profile.name ?? "User"}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.profile.email}</p>
              <Badge
                variant="secondary"
                className={cn(
                  "mt-1.5 text-[10px] px-2 py-0.5",
                  TIER_BADGE_STYLE[tier]
                )}
              >
                {config.name} plan
              </Badge>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/billing")}>
              <CreditCard className="w-4 h-4 mr-2" /> Subscription
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/integrations")}>
              <Plug className="w-4 h-4 mr-2" /> Integrations & API
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => removeUser()}
            >
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
