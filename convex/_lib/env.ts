/**
 * Deployment-environment helpers. Reads `GROUNDWORK_ENV` which is set per
 * Convex deployment (`production` on warmhearted-barracuda-277, `development`
 * on useful-ox-860). Defaults to "development" if unset, so local
 * `npx convex dev` runs treat themselves as dev.
 */
export function isProductionEnv(): boolean {
  return process.env.GROUNDWORK_ENV === "production";
}

export function isDevEnv(): boolean {
  return !isProductionEnv();
}
