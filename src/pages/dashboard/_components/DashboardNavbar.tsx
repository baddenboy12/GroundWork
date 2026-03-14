import { useAuth } from "@/hooks/use-auth.ts";
import { Button } from "@/components/ui/button.tsx";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { LogOut, User } from "lucide-react";

export default function DashboardNavbar() {
  const { user, removeUser } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
      {/* Logo */}
      <button
        className="flex items-center gap-2.5"
        onClick={() => navigate("/")}
      >
        <img
          src="https://cdn.hercules.app/file_MTBkFtbeCZf1g1fwPkBRL5mk"
          alt="LogVault"
          className="w-7 h-7 rounded-md"
        />
        <span className="font-bold text-foreground">
          Log<span className="text-primary">Vault</span>
        </span>
      </button>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 h-8 px-2">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground max-w-32 truncate">
              {user?.profile.name ?? user?.profile.email ?? "Account"}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.profile.name ?? "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user?.profile.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => removeUser()}
          >
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
