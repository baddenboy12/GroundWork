import { useEffect } from "react";
import { Loader2 } from "lucide-react";

/**
 * Dedicated PayPal return handler.
 *
 * PayPal appends params like `subscription_id` and `token` to the return URL.
 * If those params land on /billing, the Hercules Auth OIDC library can mistake
 * them for auth-related tokens and get stuck in a loading loop.
 *
 * This page intercepts the return, saves what we need to sessionStorage,
 * then hard-redirects to /billing with a clean URL.
 */
export default function PayPalReturn() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscriptionId = params.get("subscription_id");
    const cancelled = params.get("paypal_cancelled");

    if (subscriptionId) {
      sessionStorage.setItem("paypal_pending_subscription_id", subscriptionId);
    }
    if (cancelled === "1") {
      sessionStorage.setItem("paypal_cancelled", "1");
    }

    // Replace current history entry so the back button works correctly
    window.location.replace("/billing");
  }, []);

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm">Completing subscription…</p>
      </div>
    </div>
  );
}
