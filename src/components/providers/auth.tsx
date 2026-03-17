import { HerculesAuthProvider } from "@usehercules/auth/react";
import { WebStorageStateStore } from "oidc-client-ts";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <HerculesAuthProvider
      authority={import.meta.env.VITE_HERCULES_OIDC_AUTHORITY!}
      client_id={import.meta.env.VITE_HERCULES_OIDC_CLIENT_ID!}
      userManagerSettings={{
        prompt: import.meta.env.VITE_HERCULES_OIDC_PROMPT ?? "select_account",
        response_type:
          import.meta.env.VITE_HERCULES_OIDC_RESPONSE_TYPE ?? "code",
        scope:
          import.meta.env.VITE_HERCULES_OIDC_SCOPE ??
          "openid profile email offline_access",
        redirect_uri:
          import.meta.env.VITE_HERCULES_OIDC_REDIRECT_URI ??
          `${window.location.origin}/auth/callback`,
        // Persist auth tokens to localStorage so the user stays logged in
        // after closing and reopening the PWA with no internet connection.
        userStore: new WebStorageStateStore({ store: window.localStorage }),
        stateStore: new WebStorageStateStore({ store: window.localStorage }),
      }}
    >
      {children}
    </HerculesAuthProvider>
  );
}
