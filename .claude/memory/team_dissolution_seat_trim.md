---
name: removeKey trims Stripe extra seats when last member leaves a self-created team
description: Prevents a bug where dissolving a multi-seat team left the Stripe sub paying for phantom seats
type: project
---

When the last member leaves a self-created (Stripe-backed) team, [`removeKey`](convex/licenseKeys.ts) schedules `internal.stripe.actions._trimExtraSeats` **before** deleting the key. This drops the extra-seat line item on the subscriber's Stripe subscription back to zero, leaving them with just the base tier ($8.99 Pro or $19.99 Business) going forward.

## Why

Prior to this fix, dissolving a team deleted the Convex key + team sites + logs + photos but **never touched Stripe**. The subscriber kept paying for extra seats on a team that no longer existed — next invoice still reflected the higher total. Bug confirmed in test mode with Corey3: a 4-seat Business team cost $25.96/mo on the upcoming invoice even after the team was dissolved.

Stripe auto-generates a prorated credit note when extra seats are removed mid-cycle (`proration_behavior: "always_invoice"` on the update). The credit applies as "Applied balance" on the next invoice — e.g. removing 3 seats 2 minutes after adding them produced a `($5.97)` credit that reduced the next `$19.99` invoice to `$14.02`.

## How to apply

- Admin-granted keys skip the Stripe step (they have no sub). Handled by the `key.selfCreated` check.
- The scheduler pattern is necessary because `removeKey` is a V8 mutation; `_trimExtraSeats` is a Node action (Stripe SDK requires Node runtime).
- `_trimExtraSeats` no-ops gracefully on a canceled sub, missing sub, missing seat price, or missing seat item — it's safe to schedule even when the sub state is uncertain.

## Adjacent admin utility

[`adminResetUserStripeFields`](convex/users.ts) (internal mutation) wipes a user's Stripe fields (`stripeCustomerId`, `stripeSubscriptionId`, etc.) + drops tier to free + flips `adminGrantedTier` false. Used when switching between live and test Stripe modes, since customer/sub IDs don't translate between modes. Invoke with:

```bash
npx convex run --prod users:adminResetUserStripeFields '{"userId":"..."}'
```
