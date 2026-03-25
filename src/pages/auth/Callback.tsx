import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Button } from "@/components/ui/button.tsx";
import { isNative } from "@/lib/platform";

export default function AuthCallback() {
  // Close the Chrome Custom Tab if we're on native
  useEffect(() => {
    if (isNative) {
      import("@capacitor/browser").then(({ Browser }) => {
        Browser.close().catch(() => {});
      });
    }
  }, []);
  const navigate = useNavigate();
  const auth = useAuth();
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);

  const synced = useRef(false);
  const navigateAfterAuth = useCallback(
    () => {
      const signupTier = sessionStorage.getItem("gw_signup_tier");
      if (signupTier) {
        // User signed up from a paid plan card — go to billing to start PayPal flow
        navigate("/billing", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    },
    [navigate],
  );

  // Process the OIDC callback redirect (runs once)
  useEffect(() => {
    if (auth.isLoading) return;

    // If there are no auth params in the URL, just go home
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

  if (auth.error) {
    return (
      <div className="flex flex-col items-center justify-center h-svh gap-6 px-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-destructive font-medium">Something went wrong</p>
          <p className="text-sm text-muted-foreground max-w-md">
            {auth.error.message}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate("/", { replace: true })}>
            Return home
          </Button>
          <Button onClick={() => auth.signinRedirect()}>Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-svh gap-4">
      <Spinner className="size-8" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}
