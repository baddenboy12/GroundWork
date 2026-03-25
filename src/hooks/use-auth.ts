import { useAuth as useOidcAuth } from "react-oidc-context";
import { isNative } from "@/lib/platform";

async function nativeSignOut() {
  const authority = import.meta.env.VITE_KEYCLOAK_OIDC_AUTHORITY!;
  const clientId = import.meta.env.VITE_KEYCLOAK_OIDC_CLIENT_ID!;

  const userKey = `oidc.user:${authority}:${clientId}`;
  const userJson = localStorage.getItem(userKey);
  const idToken = userJson ? JSON.parse(userJson).id_token : null;

  // Clear all OIDC state
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith("oidc.") || key.startsWith("oidc-client-ts"))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));

  // Logout from Keycloak via background fetch
  try {
    const logoutUrl = new URL(`${authority}/protocol/openid-connect/logout`);
    logoutUrl.searchParams.set("client_id", clientId);
    if (idToken) logoutUrl.searchParams.set("id_token_hint", idToken);
    await fetch(logoutUrl.toString(), { mode: "no-cors" });
  } catch { /* best effort */ }

  window.location.replace("/");
}

export function useAuth() {
  const auth = useOidcAuth();

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
    // signinRedirect works normally — the AuthDialogPlugin intercepts
    // the navigation to auth.teezfpo.com and opens a dialog WebView
    signinRedirect: auth.signinRedirect,
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
