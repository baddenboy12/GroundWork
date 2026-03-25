import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Button } from "@/components/ui/button.tsx";

/**
 * Native-only auth callback page.
 * Processes the OIDC code exchange manually without react-oidc-context interference.
 * Loaded at /auth/native-callback?code=...&state=...
 */

async function exchangeCodeForTokens(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const stateKey = params.get("state");

  if (!code || !stateKey) throw new Error("Missing code or state");

  // Read PKCE state stored during sign-in
  const stateJson = localStorage.getItem(`oidc.${stateKey}`);
  if (!stateJson) throw new Error("No stored state found for: " + stateKey);

  const state = JSON.parse(stateJson);
  const authority = state.authority || import.meta.env.VITE_KEYCLOAK_OIDC_AUTHORITY!;
  const clientId = state.client_id || import.meta.env.VITE_KEYCLOAK_OIDC_CLIENT_ID!;
  const tokenEndpoint = `${authority}/protocol/openid-connect/token`;

  // Exchange code for tokens
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: state.redirect_uri || "groundwork://auth/callback",
    client_id: clientId,
    code_verifier: state.code_verifier,
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  const tokens = await response.json();

  // Parse ID token for profile
  let profile: Record<string, unknown> = {};
  if (tokens.id_token) {
    try {
      const payload = tokens.id_token.split(".")[1];
      profile = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    } catch { /* ignore */ }
  }

  // Store user in oidc-client-ts format so react-oidc-context picks it up on reload
  const userKey = `oidc.user:${authority}:${clientId}`;
  localStorage.setItem(userKey, JSON.stringify({
    id_token: tokens.id_token,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_type: tokens.token_type || "Bearer",
    scope: state.scope || "openid profile email offline_access",
    profile,
    expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in || 300),
    session_state: params.get("session_state") || undefined,
  }));

  // Clean up PKCE state
  localStorage.removeItem(`oidc.${stateKey}`);
}

export default function NativeCallback() {
  const [error, setError] = useState<string | null>(null);
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    // Check if user tokens are already stored (from a successful exchange)
    const authority = import.meta.env.VITE_KEYCLOAK_OIDC_AUTHORITY!;
    const clientId = import.meta.env.VITE_KEYCLOAK_OIDC_CLIENT_ID!;
    const userKey = `oidc.user:${authority}:${clientId}`;

    if (localStorage.getItem(userKey)) {
      // Already signed in — just go to dashboard
      window.location.replace("/dashboard");
      return;
    }

    // Exchange code for tokens
    const params = new URLSearchParams(window.location.search);
    if (!params.has("code")) {
      // No code in URL — nothing to process, go home
      window.location.replace("/");
      return;
    }

    exchangeCodeForTokens()
      .then(() => {
        window.location.replace("/dashboard");
      })
      .catch((err) => {
        // If tokens got stored despite the error, just go to dashboard
        if (localStorage.getItem(userKey)) {
          window.location.replace("/dashboard");
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-svh gap-6 px-4 bg-background text-foreground">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-destructive font-medium text-lg">Sign-in Error</p>
          <p className="text-sm text-muted-foreground max-w-md break-all">{error}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => window.location.replace("/")}>
            Return home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-svh gap-4 bg-background">
      <Spinner className="size-8" />
      <p className="text-sm text-muted-foreground">Signing in...</p>
    </div>
  );
}
