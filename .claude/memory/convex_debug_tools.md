# Convex Debug & CLI Tools (March 23, 2026)

## Internal Debug Queries (in licenseKeys.ts)
- `_debugListAllKeys`: lists all license keys with status, tier, members, paypalSubscriberId, pendingPaymentTransfer
- `_debugListUsers`: lists all users with tier, paypal status, applied key, cancel date

## Useful CLI Commands
```bash
# List all keys
npx convex run licenseKeys:_debugListAllKeys

# List all users with subscription info
npx convex run licenseKeys:_debugListUsers

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

# Push to dev
npx convex dev --once

# Deploy to prod (needs interactive confirmation)
npx convex deploy --cmd 'npm run build'
```

## Test Accounts
- Corey Butler: baddenboy12@gmail.com (app super_admin)
- Corey2 Butler2: baddenboy15@live.com
- Corey3 Butler3: c.yr@hotmail.com
- Celeste: alburyc242@gmail.com
