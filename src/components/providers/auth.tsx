import { AuthProvider as OidcAuthProvider } from "react-oidc-context";
import { WebStorageStateStore } from "oidc-client-ts";
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

const oidcConfig = {
  authority,
  client_id: import.meta.env.VITE_KEYCLOAK_OIDC_CLIENT_ID!,
  prompt: "select_account",
  response_type: "code",
  scope: "openid profile email offline_access",
  redirect_uri: isNative
    ? "groundwork://auth/callback"
    : `${window.location.origin}/auth/callback`,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  stateStore: new WebStorageStateStore({ store: window.localStorage }),
  ...(isNative ? { metadata: nativeMetadata } : {}),
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
