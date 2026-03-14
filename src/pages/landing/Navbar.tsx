import { SignInButton } from "@/components/ui/signin.tsx";
import { Authenticated, Unauthenticated } from "convex/react";
import { Button } from "@/components/ui/button.tsx";
import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img
            src="https://cdn.hercules.app/file_MTBkFtbeCZf1g1fwPkBRL5mk"
            alt="LogVault"
            className="w-8 h-8 rounded-lg"
          />
          <span className="text-xl font-bold tracking-tight text-foreground">
            Log<span className="text-primary">Vault</span>
          </span>
        </div>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          <a href="#usecases" className="hover:text-foreground transition-colors">Use Cases</a>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Authenticated>
            <Button onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </Button>
          </Authenticated>
          <Unauthenticated>
            <SignInButton />
          </Unauthenticated>
        </div>
      </div>
    </nav>
  );
}
