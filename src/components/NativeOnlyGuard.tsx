import type { ReactNode } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import { isNative } from "@/lib/platform";
import { useAuth } from "@/hooks/use-auth";

interface Props {
  children: ReactNode;
}

/**
 * Renders children only when the app is running inside the Capacitor native
 * WebView (detected via `GroundWorkNative` user-agent marker). For any browser
 * visit, shows a friendly "available on Android" screen. This is a UX gate,
 * not a security boundary — Convex enforces access at the data layer.
 */
export function NativeOnlyGuard({ children }: Props) {
  const { isAuthenticated, signoutRedirect } = useAuth();

  if (isNative) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <a
          href="https://play.google.com/store/apps/details?id=com.teezfpo.groundwork"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block transition-opacity hover:opacity-90"
          aria-label="Get GroundWork on Google Play"
        >
          <img
            src="/google-play-badge.png"
            alt="Get it on Google Play"
            className="h-20 w-auto"
          />
        </a>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Available on Android
          </h1>
          <p className="text-sm text-muted-foreground">
            GroundWork's dashboard and settings live in the Android app. If
            you already have the app installed, open it to continue.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Back to homepage
          </a>
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => { void signoutRedirect(); }}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
