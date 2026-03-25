import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Button } from "@/components/ui/button.tsx";
import { isNative } from "@/lib/platform";

/**
 * On native, process the OIDC callback manually:
 * 1. Extract code + state from URL
 * 2. Look up stored PKCE state from localStorage
 * 3. Exchange code for tokens via fetch to Keycloak token endpoint
 * 4. Store tokens so react-oidc-context picks them up
 */
async function processNativeCallback(): Promise<boolean> {
  // Read params from localStorage (stored by deep link handler to avoid
  // react-oidc-context auto-processing the URL params)
  const raw = localStorage.getItem("gw_native_callback");
  if (!raw) return false;
  localStorage.removeItem("gw_native_callback");

  const { code, state: stateKey, session_state } = JSON.parse(raw);
  if (!code || !stateKey) return false;

  const stateJson = localStorage.getItem(`oidc.${stateKey}`);
  if (!stateJson) return false;

  const state = JSON.parse(stateJson);
  const authority = state.authority || import.meta.env.VITE_KEYCLOAK_OIDC_AUTHORITY!;
  const tokenEndpoint = `${authority}/protocol/openid-connect/token`;

  // Exchange authorization code for tokens
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: state.redirect_uri || "groundwork://auth/callback",
    client_id: state.client_id || import.meta.env.VITE_KEYCLOAK_OIDC_CLIENT_ID!,
    code_verifier: state.code_verifier,
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${err}`);
  }

  const tokens = await response.json();

  // Parse the ID token to get user profile
  const idTokenParts = tokens.id_token?.split(".");
  let profile: Record<string, unknown> = {};
  if (idTokenParts?.length === 3) {
    try {
      profile = JSON.parse(atob(idTokenParts[1].replace(/-/g, "+").replace(/_/g, "/")));
    } catch { /* ignore parse errors */ }
  }

  // Store user in the format oidc-client-ts expects
  const user = {
    id_token: tokens.id_token,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_type: tokens.token_type || "Bearer",
    scope: state.scope || "openid profile email offline_access",
    profile,
    expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in || 300),
    session_state: session_state || undefined,
  };

  // Store under the key react-oidc-context expects
  const userKey = `oidc.user:${authority}:${state.client_id || import.meta.env.VITE_KEYCLOAK_OIDC_CLIENT_ID!}`;
  localStorage.setItem(userKey, JSON.stringify(user));

  // Clean up the state entry
  localStorage.removeItem(`oidc.${stateKey}`);

  return true;
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);
  const [nativeError, setNativeError] = useState<string | null>(null);
  const nativeProcessed = useRef(false);

  // Close Chrome Custom Tab on native
  useEffect(() => {
    if (isNative) {
      import("@capacitor/browser").then(({ Browser }) => {
        Browser.close().catch(() => {});
      });
    }
  }, []);

  // On native: process the callback manually, then reload to pick up the stored user
  useEffect(() => {
    if (!isNative || nativeProcessed.current) return;
    nativeProcessed.current = true;

    const params = new URLSearchParams(window.location.search);
    if (!params.has("code")) return;

    processNativeCallback()
      .then((success) => {
        if (success) {
          // Reload the app so react-oidc-context picks up the stored user
          window.location.replace("/dashboard");
        }
      })
      .catch((err) => {
        setNativeError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  const synced = useRef(false);
  const navigateAfterAuth = useCallback(() => {
    const signupTier = sessionStorage.getItem("gw_signup_tier");
    if (signupTier) {
      navigate("/billing", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  // Web: process the OIDC callback redirect (runs once)
  useEffect(() => {
    if (isNative) return; // native handles it above
    if (auth.isLoading) return;

    const params = new URLSearchParams(window.location.search);
    if (!params.has("code") && !params.has("error")) {
      navigateAfterAuth();
    }
  }, [auth.isLoading, navigateAfterAuth]);

  // Once Convex is authenticated, sync the user and navigate
  useEffect(() => {
    if (!isConvexAuthenticated || synced.current) return;
    synced.current = true;
    updateCurrentUser().then(navigateAfterAuth).catch(navigateAfterAuth);
  }, [isConvexAuthenticated, updateCurrentUser, navigateAfterAuth]);

  if (nativeError) {
    return (
      <div className="flex flex-col items-center justify-center h-svh gap-6 px-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-destructive font-medium">Auth Error</p>
          <p className="text-sm text-muted-foreground max-w-md break-all">{nativeError}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate("/", { replace: true })}>Return home</Button>
          <Button onClick={() => window.location.replace("/")}>Try again</Button>
        </div>
      </div>
    );
  }

  if (auth.error && !isNative) {
    return (
      <div className="flex flex-col items-center justify-center h-svh gap-6 px-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-destructive font-medium">Auth Error</p>
          <p className="text-sm text-muted-foreground max-w-md break-all">{auth.error.message}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate("/", { replace: true })}>Return home</Button>
          <Button onClick={() => auth.signinRedirect()}>Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-svh gap-4">
      <Spinner className="size-8" />
      <p className="text-sm text-muted-foreground">Signing in...</p>
    </div>
  );
}
