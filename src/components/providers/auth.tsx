import { AuthProvider as OidcAuthProvider } from "react-oidc-context";
import { WebStorageStateStore, type User } from "oidc-client-ts";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api.js";
import { isNative } from "@/lib/platform";

const authority = import.meta.env.VITE_KEYCLOAK_OIDC_AUTHORITY!;

const nativeMetadata = {
  issuer: authority,
  authorization_endpoint: `${authority}/protocol/openid-connect/auth`,
  token_endpoint: `${authority}/protocol/openid-connect/token`,
  userinfo_endpoint: `${authority}/protocol/openid-connect/userinfo`,
  end_session_endpoint: `${authority}/protocol/openid-connect/logout`,
  jwks_uri: `${authority}/protocol/openid-connect/certs`,
  revocation_endpoint: `${authority}/protocol/openid-connect/revoke`,
};

// On /auth/native-callback, NativeCallback.tsx handles the token exchange manually.
// Prevent react-oidc-context from auto-processing the callback on that route.
const isNativeCallbackRoute = window.location.pathname === "/auth/native-callback";

const oidcConfig = {
  authority,
  client_id: import.meta.env.VITE_KEYCLOAK_OIDC_CLIENT_ID!,
  prompt: "select_account",
  response_type: "code",
  scope: "openid profile email offline_access",
  redirect_uri: `${window.location.origin}/auth/callback`,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  stateStore: new WebStorageStateStore({ store: window.localStorage }),
  ...(isNative ? { metadata: nativeMetadata } : {}),
  ...(isNativeCallbackRoute ? { skipSigninCallback: true } : {}),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <OidcAuthProvider
      {...oidcConfig}
      onSigninCallback={(user: User | void) => {
        // Ensure the Convex user record exists by calling updateCurrentUser
        // directly via HTTP client. This covers both web and native flows.
        if (user?.id_token) {
          const httpClient = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL!);
          httpClient.setAuth(user.id_token);
          httpClient.mutation(api.users.updateCurrentUser, {}).catch((err) => {
            console.error("[auth] onSigninCallback: failed to sync user:", err);
          });
        }
        window.history.replaceState({}, document.title, "/dashboard");
      }}
    >
      {children}
    </OidcAuthProvider>
  );
}
