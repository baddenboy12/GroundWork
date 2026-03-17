import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import { hasStoredOidcSession } from "@/lib/offline-session.ts";
import Navbar from "./landing/Navbar.tsx";
import Hero from "./landing/Hero.tsx";
import Features from "./landing/Features.tsx";
import UseCases from "./landing/UseCases.tsx";
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
      <Features />
      <UseCases />
      <Pricing />
      <Footer />
    </div>
  );
}

export default function Index() {
  const isOnline = useOnlineStatus();

  // ── Offline mode ────────────────────────────────────────────────────────────
  // The OIDC library tries to fetch the discovery document from hercules.app on
  // startup. Offline that request hangs forever, keeping isLoading:true and
  // the app stuck on a grey screen. Instead, check localStorage directly —
  // it's synchronous and requires zero network.
  if (!isOnline) {
    return hasStoredOidcSession() ? <RedirectToDashboard /> : <LandingPage />;
  }

  // ── Online mode: normal Convex auth flow ────────────────────────────────────
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen bg-background" />
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
