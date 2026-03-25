import { useAuth as useOidcAuth } from "react-oidc-context";
import { isNative } from "@/lib/platform";

// Generate crypto-safe random string
function randomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(36).padStart(2, "0")).join("").substring(0, length);
}

// PKCE S256 code challenge
async function pkceChallengeFromVerifier(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function nativeSignIn() {
  const authority = import.meta.env.VITE_KEYCLOAK_OIDC_AUTHORITY!;
  const clientId = import.meta.env.VITE_KEYCLOAK_OIDC_CLIENT_ID!;
  const redirectUri = "groundwork://auth/callback";

  const codeVerifier = randomString(64);
  const codeChallenge = await pkceChallengeFromVerifier(codeVerifier);
  const state = randomString(32);
  const nonce = randomString(32);

  // Store state in oidc-client-ts format
  localStorage.setItem(`oidc.${state}`, JSON.stringify({
    id: state,
    created: Math.floor(Date.now() / 1000),
    request_type: "si:r",
    code_verifier: codeVerifier,
    authority,
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid profile email offline_access",
    response_type: "code",
    nonce,
    extraTokenParams: {},
    skipUserInfo: false,
  }));

  const authUrl = new URL(`${authority}/protocol/openid-connect/auth`);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid profile email offline_access");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("prompt", "select_account");

  const { Browser } = await import("@capacitor/browser");
  await Browser.open({
    url: authUrl.toString(),
    presentationStyle: "popover",
    toolbarColor: "#0f1117",
  });
}

async function nativeSignOut() {
  const authority = import.meta.env.VITE_KEYCLOAK_OIDC_AUTHORITY!;
  const logoutUrl = new URL(`${authority}/protocol/openid-connect/logout`);
  logoutUrl.searchParams.set("post_logout_redirect_uri", "groundwork://auth/callback");
  logoutUrl.searchParams.set("client_id", import.meta.env.VITE_KEYCLOAK_OIDC_CLIENT_ID!);

  // Clear local auth state first
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith("oidc.") || key.startsWith("oidc-client-ts"))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));

  // Open Keycloak logout in Browser plugin, then it redirects back via deep link
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({
    url: logoutUrl.toString(),
    presentationStyle: "popover",
    toolbarColor: "#0f1117",
  });
}

export function useAuth() {
  const auth = useOidcAuth();

  const signinRedirect = async () => {
    if (isNative) {
      await nativeSignIn();
      return;
    }
    return auth.signinRedirect();
  };

  const signoutRedirect = async () => {
    if (isNative) {
      await auth.removeUser();
      await nativeSignOut();
      return;
    }
    return auth.signoutRedirect({
      post_logout_redirect_uri: window.location.origin,
    });
  };

  return {
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error ?? null,
    signinRedirect,
    removeUser: auth.removeUser,
    signoutRedirect,
    user: auth.user
      ? {
          profile: {
            name: auth.user.profile.name ?? auth.user.profile.preferred_username ?? null,
            email: auth.user.profile.email ?? null,
          },
        }
      : null,
  };
}
