import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;
let client: ConvexHttpClient | null = null;

function getClient(): ConvexHttpClient | null {
  if (!CONVEX_URL) return null;
  if (!client) client = new ConvexHttpClient(CONVEX_URL);
  return client;
}

/** Detect platform: "android" | "web" */
function getPlatform(): string {
  // Capacitor sets this on the window object
  if (typeof window !== "undefined" && "Capacitor" in window) {
    return "android";
  }
  return "web";
}

/**
 * Report an error to the Convex clientErrors table.
 * Fire-and-forget — never throws.
 */
export function reportError(
  error: unknown,
  componentStack?: string
): void {
  try {
    const c = getClient();
    if (!c) return;

    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : String(error);

    const stack = error instanceof Error ? error.stack : undefined;

    c.mutation(api.clientErrors.logErrorAnonymous, {
      message,
      stack,
      componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      platform: getPlatform(),
    }).catch(() => {
      // Swallow — never let error reporting itself cause problems
    });
  } catch {
    // Swallow
  }
}

/** Install global error listeners. Call once at app startup. */
export function installGlobalErrorHandlers(): void {
  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason);
  });
}
