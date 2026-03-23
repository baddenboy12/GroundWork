import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { hasStoredOidcSession } from "@/lib/offline-session.ts";
import Navbar from "./landing/Navbar.tsx";
import Hero from "./landing/Hero.tsx";
import Pricing from "./landing/Pricing.tsx";
import Footer from "./landing/Footer.tsx";

function RedirectToDashboard() {
  const navigate = useNavigate();
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      for (let i = 0; i < 10; i++) {
        window.history.pushState(null, "", "/dashboard");
      }
    }

    navigate("/dashboard", { replace: true });
  }, [navigate]);
  return null;
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <Pricing />
      <Footer />
    </div>
  );
}

export default function Index() {
  if (hasStoredOidcSession()) {
    return <RedirectToDashboard />;
  }

  return (
    <>
      <AuthLoading>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        </div>
      </AuthLoading>
      <Authenticated>
        <RedirectToDashboard />
      </Authenticated>
      <Unauthenticated>
        <LandingPage />
      </Unauthenticated>
    </>
  );
}
