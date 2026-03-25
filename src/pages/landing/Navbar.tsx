import { SignInButton } from "@/components/ui/signin.tsx";
import { Authenticated, Unauthenticated } from "convex/react";
import { Button } from "@/components/ui/button.tsx";
import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();

  return (
    <nav className="fixed left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border top-0">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo — matches dashboard sizing */}
        <a href="/" className="flex items-center gap-3">
          <img
            src="/icon/icon-192.png"
            alt="GroundWork"
            className="w-14 h-14 rounded-lg"
          />
          <span className="font-bold text-[1.75rem] text-foreground">
            Ground<span className="text-primary">Work</span>
          </span>
        </a>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Authenticated>
            <Button size="lg" className="text-base px-6" onClick={() => navigate("/dashboard")}>
              Dashboard
            </Button>
          </Authenticated>
          <Unauthenticated>
            <SignInButton size="lg" className="text-base px-6" />
          </Unauthenticated>
        </div>
      </div>
    </nav>
  );
}
