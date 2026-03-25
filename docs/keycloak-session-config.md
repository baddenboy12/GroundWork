# Keycloak Session & Token Configuration

## Realm Settings > Tokens

### Refresh Token Revocation
- **Enable "Revoke Refresh Token"** — each refresh token can only be used once.
  After `signinSilent()` consumes a refresh token, it receives a new one.
  A stolen token becomes useless after one use.
- **Set "Refresh Token Max Reuse" to `0`** — no reuse allowed.

### Access Token Lifespan
- Keep at **5 minutes** (current setting). Short-lived tokens force frequent silent refresh.

## Realm Settings > Sessions

### SSO Session Timeouts
- **SSO Session Idle: 30 minutes** — how long an inactive browser SSO cookie lasts.
- **SSO Session Max: 10 hours** — absolute SSO session lifetime.

These only affect the Keycloak login page SSO cookie. They do NOT affect the app's
refresh tokens when using the `offline_access` scope.

## Offline Session Settings — DO NOT CHANGE

The app uses `scope: "openid profile email offline_access"` in the OIDC config.
This issues an "offline token" that survives Keycloak server restarts and SSO session
cleanups.

**Default Offline Session Max Lifespan: 60 days** — leave this unchanged.

Field workers may go offline for hours or days. Shortening the offline session timeout
would force re-authentication when they have no internet, breaking offline mode entirely.

The offline session settings govern the `offline_access` tokens separately from SSO.
Changing SSO timeouts is safe; changing offline session settings is not.

## How Token Renewal Works in the App

1. `src/components/providers/convex.tsx` calls `signinSilent()` when Convex requests a
   fresh token (`forceRefreshToken: true`).
2. `signinSilent()` uses the refresh token to get a new `id_token` + `access_token` +
   `refresh_token` (if revocation is enabled, the old refresh token is invalidated).
3. If `signinSilent()` fails (token expired/revoked), the user must re-authenticate.
   The `OidcErrorGuard` in `App.tsx` catches OIDC state errors and redirects to `/`.

## Sandbox Testers

Users with `sandboxMode: true` can switch subscription tiers freely from the `/billing`
page without going through PayPal. This is unrelated to Keycloak session config but
useful for testing tier-gated features. Toggle sandbox mode from the admin section on
the billing page.
