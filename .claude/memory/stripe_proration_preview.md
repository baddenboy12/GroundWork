---
name: Paying-user seat changes preview proration before charging
description: Create Team / Edit Seats fetch a Stripe invoices.createPreview before the silent charge, then show real dollars in a confirm dialog
type: project
---

Paying-user seat changes route through a preview → confirm → apply flow instead of a silent charge:

1. **Backend** — [convex/stripe/actions.ts](convex/stripe/actions.ts) has a shared `_prepareSeatChange` helper used by both `previewSubscriptionSeats` (dry-run) and `reviseSubscriptionSeats` (apply). Preview calls `stripe.invoices.createPreview` with the new items and returns `{ immediateChargeCents, nextInvoiceTotalCents, nextInvoiceDate, currency }`.

2. **Frontend** — [ProrationConfirmDialog](src/pages/billing/_components/ProrationConfirmDialog.tsx) renders a spinner while the preview is loading, then a two-row table ("Charged today (prorated)" + "Starting [date]: $Y.YY / month"). Confirm button is disabled until preview resolves. Cancel rolls back pending UI state.

3. **Flow wiring** in [billing/page.tsx](src/pages/billing/page.tsx):
   - `handleCreateTeam` (paying user, multi-seat): creates the team key at 1 seat first (so we have a target for preview), fetches preview, opens confirm dialog. Confirm → `reviseSubscriptionSeatsAction`. Cancel leaves the team at 1 seat (user can grow later via Edit Seats).
   - `handleEditSeats`: same preview-first pattern for self-created keys. Admin-granted keys skip the dialog (direct write).

## Guards

- **`cancel_pending` subs are blocked** from both flows — charging proration on a sub about to end leaves users paying for features they're about to lose. `hasLiveStripeSub` is narrowed to `"active" | "trialing"`.
- **Toast copy is truthful**: "Your card was charged the prorated amount just now" (not "at next billing"). See `why`: prior copy claimed "at next billing" while `proration_behavior: "always_invoice"` actually auto-finalizes the invoice within ~60s. Test mode confirmed charges complete in ~1 min (observed: 10:47 PM sub creation → 10:48 PM seat proration charge, both Paid).

## Don't regress

Do not revert to the silent-charge flow (pre-preview). It was a chargeback/support risk once prices got large and the dollar figure wasn't disclosed. The preview step is the user's clear consent point before `reviseSubscriptionSeats` fires.
