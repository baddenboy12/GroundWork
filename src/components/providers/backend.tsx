/**
 * Backend providers layer — authentication and data fetching.
 * Groups Convex and Auth providers for cleaner composition.
 */

import { AuthProvider } from "./auth.tsx";
import { ConvexProvider } from "./convex.tsx";

interface BackendProvidersProps {
  children: React.ReactNode;
}

/**
 * Wraps components with backend-related providers (Auth, Convex).
 * Should be placed at the top level above UI providers.
 *
 * @example
 * <BackendProviders>
 *   <UiProviders>
 *     <App />
 *   </UiProviders>
 * </BackendProviders>
 */
export function BackendProviders({ children }: BackendProvidersProps) {
  return (
    <AuthProvider>
      <ConvexProvider>
        {children}
      </ConvexProvider>
    </AuthProvider>
  );
}
