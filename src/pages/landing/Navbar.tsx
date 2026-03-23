import { SignInButton } from "@/components/ui/signin.tsx";
import { Authenticated, Unauthenticated } from "convex/react";
import { Button } from "@/components/ui/button.tsx";
import { useNavigate, Link } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
        {/* Logo — matches dashboard sizing */}
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/icon/icon-192.png"
            alt="GroundWork"
            className="w-12 h-12 rounded-lg"
          />
          <span className="font-bold text-[1.55rem] text-foreground">
            Ground<span className="text-primary">Work</span>
          </span>
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-6 text-base text-muted-foreground">
          <Link to="/features" className="hover:text-foreground active:text-foreground transition-colors py-2">Features</Link>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Authenticated>
            <Button size="lg" onClick={() => navigate("/dashboard")}>
              Dashboard
            </Button>
          </Authenticated>
          <Unauthenticated>
            <SignInButton size="lg" />
          </Unauthenticated>
        </div>
      </div>
    </nav>
  );
}
