---
name: Production env vars live in .env.production.local
description: Prod builds read from .env.production.local (gitignored); .env.local is for dev Convex workflow only
type: reference
---

## Two env files, two purposes

- **`.env.local`** — used by `npx convex dev` and local Vite dev server. Points at the **dev** Convex deployment (`useful-ox-860`). Do not expect OIDC vars here.
- **`.env.production.local`** — used by `vite build` (which runs in production mode by default). Contains the **prod** Convex + Keycloak config. Vite's mode-specific `.local` files take precedence over `.env.local`, so both files coexist cleanly.

Both are gitignored by the `.env*` pattern in [.gitignore](.gitignore).

## Required VITE_ vars for production builds

All four are validated by [src/lib/env.ts](src/lib/env.ts), which now **throws** (not just logs) when any is missing — so a misconfigured build fails loudly at app start instead of rendering a misleading "Login error" toast.

```
VITE_CONVEX_URL=https://warmhearted-barracuda-277.convex.cloud
VITE_CONVEX_SITE_URL=https://warmhearted-barracuda-277.convex.site
VITE_KEYCLOAK_OIDC_AUTHORITY=https://auth.teezfpo.com/realms/groundwork
VITE_KEYCLOAK_OIDC_CLIENT_ID=groundwork-app
```

## Pre-deploy sanity check

Before `scp`ing `dist/` to the VPS, grep the bundle to confirm env vars were embedded:

```bash
grep -l "auth.teezfpo" dist/assets/*.js            # must match
grep -l "warmhearted-barracuda-277" dist/assets/*.js  # must match
grep -l "useful-ox-860" dist/assets/*.js           # must NOT match (dev URL leak)
```

If the first two come back empty, the build read the wrong env file — abort before deploying.

## Why this exists

On 2026-04-23 a v247 deploy shipped a bundle built from `.env.local` alone — no OIDC vars, dev Convex URL. Auth broke for every user. The runtime `env.ts` was silent in prod, so the build succeeded anyway. Fixed by adding `.env.production.local` + making `env.ts` throw in all modes.
