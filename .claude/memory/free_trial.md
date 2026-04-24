---
name: 30-day free trial for Pro and Business
description: How trial eligibility, grant, and one-time limit are enforced across schema, Stripe Checkout, and webhook paths
type: project
---

Pro and Business subscriptions start with a 30-day free trial on the user's first paid checkout. After the trial, Stripe auto-charges when the invoice period lapses — no custom state machine. Each account may only consume **one** trial across its lifetime (can't trial Pro then Business).

**Why:** Reduces acquisition friction; one-time limit prevents trial stacking across tiers.

**How to apply:**

- Eligibility = `!user.hasUsedTrial && !user.stripeSubscriptionId && !user.adminGrantedTier && !user.sandboxMode`. The flag is sticky — cancel during trial does NOT restore eligibility.
- `hasUsedTrial` is written in BOTH `handleSubscriptionUpserted` (webhook) AND `syncSubscription` (return handler), keyed off `sub.trial_end != null` not status — so late-arriving webhooks still catch trials that already converted to `active`.
- Only `createCheckoutSession` grants trials. `takeOverSubscription` (admin transfer, continuation) and `reviseSubscriptionTier` (price swap on existing sub) must NEVER add `trial_period_days` — explicit code comments on both paths.
- Stripe params on trial: `trial_period_days: 30`, `trial_settings.end_behavior.missing_payment_method: "cancel"`, `payment_method_collection: "always"`. The cancel-on-missing-PM avoids the past_due/grace-period path.
- Constant `TRIAL_DAYS` lives in `convex/_lib/trial.ts`, imported by `stripe/actions.ts`. UI strings are hardcoded "30-day" for now (no symmetric frontend constant — change in one place if the duration ever moves).
- Landing page query skips auth via `useQuery(..., isAuthenticated ? {} : "skip")`; unauthenticated users always see the trial CTA since server enforces eligibility.
- Billing page reads the eligibility query unconditionally and guards with `!isCurrent && !hasActiveStripeSub && !(isAdmin || sandboxMode)` so admin/sandbox/existing-sub paths never show the trial CTA.

**Resetting an account for trial testing:** `adminResetUserStripeFields` wipes `stripeCustomerId`, `stripeSubscriptionId`, `stripeSubscriptionStatus`, `stripeCheckoutSessionId`, `stripeCancelEffectiveDate`, `pendingTeamSeats`, `pendingTeamSeatsAt`, `hasUsedTrial`, sets tier="free" and adminGrantedTier=false. Does NOT clear sandboxMode (toggle separately).
