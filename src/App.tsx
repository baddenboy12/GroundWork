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

// Intercept unhandled OIDC state-mismatch errors that occur when the user
// navigates back through browser history after a successful login.
// This prevents the auth library from looping back to the auth provider.
function OidcErrorGuard() {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
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

    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return null;
}

export default function App() {
  useServiceWorker();
  return (
    <DefaultProviders>
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
