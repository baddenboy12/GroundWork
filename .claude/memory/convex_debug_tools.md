# Convex Debug & CLI Tools (March 24, 2026)

## Internal Debug Queries (in licenseKeys.ts)
- `_debugListAllKeys`: lists all license keys with status, tier, members, paypalSubscriberId, pendingPaymentTransfer
- `_debugListUsers`: lists all users with tier, paypal status, applied key, cancel date

## Useful CLI Commands
```bash
# List all keys
npx convex run licenseKeys:_debugListAllKeys

# List all users with subscription info
npx convex run licenseKeys:_debugListUsers

# List all users (admin query — needs identity)
pnpm convex run users:listAllUsers '{}' --identity '{"email":"baddenboy12@gmail.com"}'

# Toggle sandbox mode on a user
pnpm convex run users:toggleSandboxMode '{"userId":"..."}' --identity '{"email":"baddenboy12@gmail.com"}'

# Set admin-granted tier on a user (internal mutation)
pnpm convex run users:_setAdminGrantedTier '{"userId":"...","tier":"free"}'

# Suspend a key (simulate payment failure)
npx convex run licenseKeys:_suspendKeyForPaymentFailure '{"keyId":"..."}'

# Reactivate a key
npx convex run licenseKeys:_reactivateKey '{"keyId":"..."}'

# Expire a key (simulate grace period end)
npx convex run licenseKeys:_expireKey '{"keyId":"..."}'

# Clear a user's subscription
npx convex run users:_setPaypalSubscription '{"userId":"...","paypalSubscriptionId":"","paypalSubscriptionStatus":"","subscriptionTier":"free"}'

# Clear cancel date
npx convex run users:_setCancelEffectiveDate '{"userId":"...","date":""}'

# Admin cascade-delete a user and ALL their data (logs, R2 photos, sites, team, api keys, webhooks, push tokens)
npx convex run users:_adminDeleteUserAndAllData '{"userId":"..."}'

# Push to dev
npx convex dev --once

# Deploy to prod (needs interactive confirmation)
npx convex deploy --cmd 'npm run build'
```

## Running Convex CLI in a fresh shell
The Convex CLI needs two things before `npx convex run` works:
1. Auth token at `C:/Users/cyr/.convex/config.json` — created by running `npx convex dev` once (can Ctrl+C after it connects).
2. Deployment selector — pass `CONVEX_DEPLOYMENT=useful-ox-860` as env var (there's no `.env.local` in this project).
3. For `convex dev --once` (pushing code), node_modules must be installed so `convex/server` can resolve. Use `corepack pnpm install` if node_modules is missing; pnpm is not on PATH but corepack is at `/c/Program Files/nodejs/corepack`.
4. Prefer `./node_modules/.bin/convex` over `npx convex` when pushing — `npx` installs a separate copy that can't resolve workspace deps.

## Test Accounts
- Corey Butler: baddenboy12@gmail.com (app super_admin)
- Corey2 Butler2: baddenboy15@live.com
- Corey3 Butler3: c.yr@hotmail.com
- Torian Neymour: torianneymour@yahoo.com (sandbox tester)

## Sandbox Mode
- `sandboxMode` field on users table — lets designated users switch tiers freely without PayPal
- Admin toggles it from "Admin — Sandbox Testers" section on `/billing` page
- Sandbox users see instant "Switch to this plan" buttons (same as admin)
- When they switch, `adminGrantedTier: true` is set — shows "Admin granted" badge
- Backend: `setSubscriptionTier` mutation allows admin OR sandbox users to bypass PayPal

## Convex Deployments
- **Dev**: `useful-ox-860` — used for localhost development and VPS (currently active)
- **Prod**: `warmhearted-barracuda-277` — NOT in use yet, env vars were copied from dev
- The app currently runs against the **dev** deployment everywhere (localhost + VPS)

## Version Tracking
- App version is in `src/lib/version.ts` → `APP_VERSION` constant
- Displayed in user menu dropdown as `v{APP_VERSION}` (green mono text)
- Currently: v242
