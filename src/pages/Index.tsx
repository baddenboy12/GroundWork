import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { hasStoredOidcSession } from "@/lib/offline-session.ts";
import { isNative } from "@/lib/platform";
import Navbar from "./landing/Navbar.tsx";
import Hero from "./landing/Hero.tsx";

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
    <div className="min-h-dvh bg-background">
      <Navbar />
      <Hero />
    </div>
  );
}

/**
 * On native, the AuthDialogPlugin dispatches an `authDialogCancelled` event
 * when the user dismisses the auth dialog without completing sign-in.
 * Clean up orphaned OIDC state and reload to escape the stuck loading state.
 */
function useAuthDialogCancelGuard() {
  useEffect(() => {
    if (!isNative) return;

    const handler = () => {
      // Clean up orphaned OIDC state entries (oidc.{stateKey} from signinRedirect)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("oidc.") && !key.startsWith("oidc.user:")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      window.location.replace("/");
    };

    window.addEventListener("authDialogCancelled", handler);
    return () => window.removeEventListener("authDialogCancelled", handler);
  }, []);
}

export default function Index() {
  useAuthDialogCancelGuard();

  // Auto-redirect signed-in users to the dashboard only in the native app.
  // On web, private routes are gated by NativeOnlyGuard, so redirecting would
  // bounce into the "Available on Android" screen — noisy. Show the marketing
  // landing page instead.
  if (isNative && hasStoredOidcSession()) {
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
        {isNative ? <RedirectToDashboard /> : <LandingPage />}
      </Authenticated>
      <Unauthenticated>
        <LandingPage />
      </Unauthenticated>
    </>
  );
}
