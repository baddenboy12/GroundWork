/**
 * LEGACY SHIM — kept only so stale browser caches that still reference this
 * module path don't crash with "useRef is null".  The real implementation
 * lives in @/lib/register-sw.ts and is called at module level in App.tsx.
 *
 * This function intentionally does NOTHING and uses NO React hooks.
 */
export function useServiceWorker() {
  // no-op — see src/lib/register-sw.ts
}
