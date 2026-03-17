/**
 * Synchronously checks localStorage for a stored OIDC session.
 *
 * oidc-client-ts (via WebStorageStateStore) stores the user object under the
 * key "oidc.user:{authority}:{client_id}". We scan for any key with that prefix
 * so we don't depend on knowing the exact authority/client_id values at
 * call-time, and to be resilient to any minor key-format differences.
 *
 * This intentionally bypasses the OIDC library's async initialisation, which
 * requires fetching the OIDC discovery document from the auth server. That
 * request hangs forever when the device is offline, keeping `isLoading: true`
 * indefinitely and causing the app to show a blank screen.
 */
export function hasStoredOidcSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("oidc.user:")) return true;
    }
    return false;
  } catch {
    return false;
  }
}
