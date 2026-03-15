import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

/**
 * Dedicated PayPal return handler.
 *
 * PayPal appends params like `subscription_id` and `token` to the return URL.
 * Using window.location.replace caused a full page reload which re-initialized
 * the OIDC auth provider and caused it to hang.
 *
 * Instead we use React Router's navigate() for a client-side transition —
 * no page reload, auth state preserved, sessionStorage readable immediately.
 */
export default function PayPalReturn() {
  const navigate = useNavigate();

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

    // Client-side navigation — preserves auth state, no full page reload
    navigate("/billing", { replace: true });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm">Completing subscription…</p>
      </div>
    </div>
  );
}
