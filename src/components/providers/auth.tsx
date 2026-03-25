import { AuthProvider as OidcAuthProvider } from "react-oidc-context";
import { WebStorageStateStore } from "oidc-client-ts";
import { isNative } from "@/lib/platform";

// On native, use custom scheme so Android routes the callback back to the app.
// On web, use the normal origin-based callback URL.
const redirectUri = isNative
  ? "groundwork://auth/callback"
  : `${window.location.origin}/auth/callback`;

const oidcConfig = {
  authority: import.meta.env.VITE_KEYCLOAK_OIDC_AUTHORITY!,
  client_id: import.meta.env.VITE_KEYCLOAK_OIDC_CLIENT_ID!,
  prompt: "select_account",
  response_type: "code",
  scope: "openid profile email offline_access",
  redirect_uri: redirectUri,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  stateStore: new WebStorageStateStore({ store: window.localStorage }),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <OidcAuthProvider
      {...oidcConfig}
      onSigninCallback={() => {
        window.history.replaceState({}, document.title, "/dashboard");
      }}
    >
      {children}
    </OidcAuthProvider>
  );
}
