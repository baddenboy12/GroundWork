import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { DefaultProviders } from "./components/providers/default.tsx";
import { useServiceWorker } from "@/hooks/use-service-worker.ts";
import AuthCallback from "./pages/auth/Callback.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import DashboardPage from "./pages/dashboard/page.tsx";
import BillingPage from "./pages/billing/page.tsx";
import IntegrationsPage from "./pages/integrations/page.tsx";
import PayPalReturn from "./pages/paypal/return.tsx";

// In standalone PWA mode, intercept Android back-button / swipe-back gestures
// to prevent the user from leaving the app and hitting the auth provider's
// history entry. Only active when installed to the home screen.
function PwaBackGuard() {
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (!isStandalone) return;

    // Refill same-origin history buffer so the back gesture never reaches
    // the external auth page. Called once on mount and after every back press.
    const fillBuffer = () => {
      window.history.replaceState(null, "", window.location.href);
      for (let i = 0; i < 5; i++) {
        window.history.pushState(null, "", window.location.href);
      }
    };

    fillBuffer();
    window.addEventListener("popstate", fillBuffer);
    return () => window.removeEventListener("popstate", fillBuffer);
  }, []);

  return null;
}

// Intercept unhandled OIDC state-mismatch errors that occur when the user
// navigates back through browser history after a successful login.
// This prevents the auth library from looping back to the auth provider.
// Also detects when the user is stuck on /auth/callback (error state shown)
// and forces a hard restart after a short timeout.
function OidcErrorGuard() {
  useEffect(() => {
    // Unhandled-rejection handler (catches most OIDC errors)
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      const message = String(
        (event.reason as { message?: string } | null)?.message ?? event.reason ?? ""
      );
      const isOidcStateError =
        /state.*(mismatch|not found|invalid)/i.test(message) ||
        /no matching state/i.test(message) ||
        /no state in response/i.test(message);

      if (isOidcStateError) {
        event.preventDefault();
        window.location.replace("/");
      }
    };

    window.addEventListener("unhandledrejection", rejectionHandler);

    // Fallback: if the user is still on /auth/callback after 6 seconds
    // (normal auth completes in ~1-2 s), the error UI must be showing.
    // Force a hard redirect to restart the app cleanly.
    let callbackTimer: ReturnType<typeof setTimeout> | null = null;
    if (window.location.pathname === "/auth/callback") {
      callbackTimer = setTimeout(() => {
        if (window.location.pathname === "/auth/callback") {
          window.location.replace("/");
        }
      }, 6000);
    }

    return () => {
      window.removeEventListener("unhandledrejection", rejectionHandler);
      if (callbackTimer !== null) clearTimeout(callbackTimer);
    };
  }, []);

  return null;
}

export default function App() {
  useServiceWorker();
  return (
    <DefaultProviders>
      <PwaBackGuard />
      <OidcErrorGuard />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/paypal/return" element={<PayPalReturn />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
