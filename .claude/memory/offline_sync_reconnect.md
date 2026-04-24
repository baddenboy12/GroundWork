---
name: Offline sync + reconnect invariants
description: Three load-bearing guards that prevent silent sync failures and phantom downgrades when the app transitions offline → online
type: project
---

When the app goes offline → online on mobile (airplane mode → LTE), three things happen concurrently:
1. Network becomes reachable (HEAD probe passes)
2. Convex WebSocket reconnects
3. Keycloak `id_token` may have expired → Convex silently refreshes it

There's a short window where network is up but Convex isn't yet authenticated. Three invariants must hold or bugs emerge:

**1. `useOfflineSync` gates on `useConvexAuth().isAuthenticated`, not just `isOnline`** — [src/hooks/use-offline-queue.ts](src/hooks/use-offline-queue.ts). Firing mutations before Convex re-auth throws UNAUTHENTICATED; the entries stay queued and the user sees no feedback.

**Why:** Corey surfaced this during a contractor demo — created a site+log offline, went to LTE, "Sync now" button did nothing. Silent `catch {}` ate the UNAUTHENTICATED error.

**How to apply:** Any future batch-retry logic that fires Convex mutations on reconnect must gate on `isConvexAuthed`, not just network. Also: never swallow errors in a sync loop — surface the first error string in the toast so the user knows why it stalled.

**2. `useCachedQuery` skips caching `null` (not just `undefined`)** — [src/hooks/use-cached-query.ts](src/hooks/use-cached-query.ts).

**Why:** `getCurrentUser` returns `null` when identity is missing (auth flap). Caching that null wipes good state (subscription tier) and the UI falls back to `toTier(undefined)` → "free".

**How to apply:** If adding new `useCachedQuery` callers, the underlying query must distinguish "no data yet" (return undefined) from "authenticated empty" (return null). If semantically nullable, write a wrapper that converts null → undefined before caching.

**3. `_setStripeSubscription` preserves `adminGrantedTier` for non-active statuses** — [convex/users.ts](convex/users.ts).

**Why:** Corey3 had a long-expired trial with `stripeCustomerId` still on record. A delayed/retried `customer.subscription.deleted` webhook fired after Corey manually granted Business, silently wiping the admin tier → Free. Admin comps (sandbox testers, support grants) must not be revocable by Stripe webhooks for a dead subscription.

**How to apply:** Only `active` or `trialing` incoming statuses override an admin grant. Any refactor of the Stripe webhook → tier path must keep this check, or comps will silently evaporate.
