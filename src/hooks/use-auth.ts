import { useAuth as useOidcAuth } from "react-oidc-context";
import { isNative } from "@/lib/platform";

export function useAuth() {
  const auth = useOidcAuth();

  const signinRedirect = async () => {
    if (isNative) {
      try {
        // Use react-oidc-context's own UserManager to create the signin request
        // This ensures the state/PKCE matches for the callback processing
        const manager = (auth as any).userManager;
        if (manager) {
          const request = await manager.createSigninRequest({});
          const { Browser } = await import("@capacitor/browser");
          await Browser.open({
            url: request.url,
            presentationStyle: "popover",
            toolbarColor: "#0f1117",
          });
          return;
        }
      } catch (err) {
        console.error("Native sign-in error:", err);
      }
    }

    return auth.signinRedirect();
  };

  return {
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error ?? null,
    signinRedirect,
    removeUser: auth.removeUser,
    signoutRedirect: () =>
      auth.signoutRedirect({
        post_logout_redirect_uri: window.location.origin,
      }),
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
