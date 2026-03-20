import { useAuth as useOidcAuth } from "react-oidc-context";

export function useAuth() {
  const auth = useOidcAuth();

  return {
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error ?? null,
    signinRedirect: auth.signinRedirect,
    removeUser: auth.removeUser,
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
