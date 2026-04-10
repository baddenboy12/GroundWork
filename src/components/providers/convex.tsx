import { type ReactNode, useCallback, useMemo, useRef } from "react";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { useAuth } from "react-oidc-context";

const convexUrl = import.meta.env.VITE_CONVEX_URL ?? "http://localhost:3000";
const convex = new ConvexReactClient(convexUrl);

function useAuthFromOidc() {
  const auth = useAuth();

  // Use a ref so fetchAccessToken always reads the latest auth state
  // without needing auth in the dependency array (which causes infinite loops)
  const authRef = useRef(auth);
  authRef.current = auth;

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const current = authRef.current;
      if (!current.user) return null;

      if (forceRefreshToken) {
        try {
          const freshUser = await current.signinSilent();
          return freshUser?.id_token ?? null;
        } catch {
          return null;
        }
      }

      return current.user.id_token ?? null;
    },
    [],
  );

  // Stabilize: don't flicker during silent renewal
  const isAuthenticated = auth.isAuthenticated || !!auth.user?.id_token;
  const isLoading = auth.isLoading && !auth.user;

  return useMemo(
    () => ({ isLoading, isAuthenticated, fetchAccessToken }),
    [isLoading, isAuthenticated, fetchAccessToken],
  );
}

export function ConvexProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useAuthFromOidc}>
      {children}
    </ConvexProviderWithAuth>
  );
}
