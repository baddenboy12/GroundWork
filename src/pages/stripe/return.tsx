import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

/**
 * Dedicated Stripe return handler.
 *
 * Stripe replaces `{CHECKOUT_SESSION_ID}` in the success_url with the actual
 * session id, so we arrive at `/stripe/return?session_id=cs_test_...`.
 *
 * Following the same pattern as the previous PayPal return handler: we use
 * React Router's navigate() for a client-side transition so the OIDC provider
 * isn't re-initialised (a full reload caused auth state to hang in the past).
 */
export default function StripeReturn() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const cancelled = params.get("stripe_cancelled");

    if (sessionId) {
      sessionStorage.setItem("stripe_pending_session_id", sessionId);
    }
    if (cancelled === "1") {
      sessionStorage.setItem("stripe_cancelled", "1");
    }

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
