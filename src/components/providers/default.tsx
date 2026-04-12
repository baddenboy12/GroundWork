import { BackendProviders } from "./backend.tsx";
import { UiProviders } from "./ui.tsx";

/**
 * Default provider composition for the entire application.
 * Combines backend (Auth, Convex) and UI (Query, Theme, Tooltips) providers.
 *
 * Layer structure (top to bottom):
 * 1. BackendProviders (Auth, Convex)
 * 2. UiProviders (Query Client, Theme, Tooltips, Notifications)
 * 3. App content
 */
export function DefaultProviders({ children }: { children: React.ReactNode }) {
  return (
    <BackendProviders>
      <UiProviders>
        {children}
      </UiProviders>
    </BackendProviders>
  );
}
