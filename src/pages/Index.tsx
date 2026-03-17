import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useAuthFallback, MarkAuthResolved } from "@/hooks/use-auth-fallback.ts";
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
  const { shouldUseFallback, markResolved } = useAuthFallback();
  const handleResolved = useCallback(() => markResolved(), [markResolved]);

  // navigator.onLine is unreliable (true even with 4G but no data plan).
  // If Convex auth doesn't resolve within 5 s we assume no real internet and
  // read the stored OIDC session from localStorage instead.
  if (shouldUseFallback) {
    return hasStoredOidcSession() ? <RedirectToDashboard /> : <LandingPage />;
  }

  return (
    <>
      <AuthLoading>
        <div className="min-h-screen bg-background" />
      </AuthLoading>
      <Authenticated>
        <MarkAuthResolved onMark={handleResolved} />
        <RedirectToDashboard />
      </Authenticated>
      <Unauthenticated>
        <MarkAuthResolved onMark={handleResolved} />
        <LandingPage />
      </Unauthenticated>
    </>
  );
}
