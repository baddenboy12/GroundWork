/**
 * Validate required environment variables at startup.
 * Throws immediately if any are missing so you get a clear error
 * instead of a silent runtime failure.
 */

const REQUIRED_VARS = [
  "VITE_CONVEX_URL",
  "VITE_KEYCLOAK_OIDC_AUTHORITY",
  "VITE_KEYCLOAK_OIDC_CLIENT_ID",
  "VITE_CONVEX_SITE_URL",
] as const;

type EnvKey = (typeof REQUIRED_VARS)[number];

function validateEnv(): Record<EnvKey, string> {
  const missing: string[] = [];
  const result: Partial<Record<EnvKey, string>> = {};

  for (const key of REQUIRED_VARS) {
    const value = import.meta.env[key];
    if (!value || typeof value !== "string" || value.trim() === "") {
      missing.push(key);
    } else {
      result[key] = value;
    }
  }

  if (missing.length > 0) {
    const message = `[GroundWork] Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join("\n")}\n\nCheck your .env file and restart the dev server.`;
    // Throw in both dev and prod so a broken build fails loudly at app start
    // (surfaced by ErrorBoundary) instead of silently rendering with undefined
    // auth/backend URLs, which manifests as a misleading "Login error" later.
    throw new Error(message);
  }

  return result as Record<EnvKey, string>;
}

export const env = validateEnv();
