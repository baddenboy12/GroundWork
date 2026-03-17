import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
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
  // ── Local-first: skip the async OIDC discovery fetch entirely ───────────────
  // If the device already has a stored OIDC session (set by a prior sign-in),
  // go straight to the dashboard without waiting for the auth server.
  // This is the critical fix for the "grey screen on fresh offline open" problem:
  //   • navigator.onLine is unreliable (4G radio on ≠ real internet)
  //   • The OIDC library's discovery-doc fetch hangs offline, keeping isLoading=true
  //   • We skip all of that — if a session exists, assume the user is logged in
  // When online, Convex will re-authenticate in the background seamlessly.
  if (hasStoredOidcSession()) {
    return <RedirectToDashboard />;
  }

  // No stored session — use the normal Convex auth flow (new user or signed out)
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
