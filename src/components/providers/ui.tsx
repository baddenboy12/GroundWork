/**
 * UI/UX providers layer — query client, theme, tooltips, and notifications.
 * Groups all user-facing provider concerns for cleaner composition.
 */

import { QueryClientProvider } from "./query-client.tsx";
import { ThemeProvider } from "./theme.tsx";
import { Toaster } from "../ui/sonner.tsx";
import { TooltipProvider } from "../ui/tooltip.tsx";

interface UiProvidersProps {
  children: React.ReactNode;
}

/**
 * Wraps components with UI/UX-related providers (Query, Theme, Tooltips, Notifications).
 * Should be placed below backend providers but above application content.
 *
 * @example
 * <BackendProviders>
 *   <UiProviders>
 *     <App />
 *   </UiProviders>
 * </BackendProviders>
 */
export function UiProviders({ children }: UiProvidersProps) {
  return (
    <QueryClientProvider>
      <TooltipProvider>
        <ThemeProvider>
          <Toaster />
          {children}
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
