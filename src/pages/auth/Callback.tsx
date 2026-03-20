import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Button } from "@/components/ui/button.tsx";

export default function AuthCallback() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);

  const synced = useRef(false);
  const navigateHome = useCallback(
    () => navigate("/", { replace: true }),
    [navigate],
  );

  // Process the OIDC callback redirect (runs once)
  useEffect(() => {
    if (auth.isLoading) return;

    // If there are no auth params in the URL, just go home
    const params = new URLSearchParams(window.location.search);
    if (!params.has("code") && !params.has("error")) {
      navigateHome();
    }
  }, [auth.isLoading, navigateHome]);

  // Once Convex is authenticated, sync the user and navigate
  useEffect(() => {
    if (!isConvexAuthenticated || synced.current) return;
    synced.current = true;
    updateCurrentUser().then(navigateHome).catch(navigateHome);
  }, [isConvexAuthenticated, updateCurrentUser, navigateHome]);

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
          <Button variant="secondary" onClick={navigateHome}>
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
