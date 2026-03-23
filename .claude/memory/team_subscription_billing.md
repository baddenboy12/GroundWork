# Team Subscription & Billing Logic (March 23, 2026)

## Team Creation via PayPal
- When creating a team with extra seats, a custom PayPal plan is created with adjusted pricing: `base_price + (extra_seats * $1.99)`
- The `createSelfKey` mutation creates the key with `maxMembers: 1` initially
- After PayPal approval, `reviseSubscriptionSeats` adjusts the seat count and price
- Key has `selfCreated: true` flag when created through PayPal flow

## Subscription Cancellation (Graceful)
- Cancel sets status to `CANCEL_PENDING` (not immediate downgrade)
- Queries PayPal for `billing_info.next_billing_time` and stores as `paypalCancelEffectiveDate`
- Tier stays active until billing cycle ends
- Amber "Cancelling" badge shown on plan header
- Banner: "Your plan remains active until [date]"
- Cancel button hidden while pending
- Actual downgrade happens via `BILLING.SUBSCRIPTION.CANCELLED` webhook OR Convex cron safety net
- Cron job `checkExpiredCancellations` runs hourly to catch missed webhooks

## Payment Failure Grace Period
- `BILLING.SUBSCRIPTION.SUSPENDED` webhook triggers 14-day grace period
- Key status set to `suspended`, `suspendedAt` timestamp stored
- Red banner on ALL team member screens: "Payment failed — read-only mode"
- Content creation blocked (no new sites/logs), existing content still viewable/editable
- Cron job `checkExpiredSuspensions` runs daily to expire keys after 14 days
- `_reactivateKey` restores full access when payment recovers

## Admin Transfer with Payment Handoff
- `transferAdmin` mutation: updates key's `adminUserId`, sets `pendingPaymentTransfer: true`
- Old admin's PayPal subscription set to `CANCEL_PENDING` (runs until billing cycle end)
- New admin sees red banner: "Payment setup required" with "Set Up Payment via PayPal" button
- `takeOverSubscription` action creates a new PayPal subscription for the new admin at same tier/seats/price
- `completePaymentTransfer` clears `pendingPaymentTransfer` and updates `paypalSubscriberId` on the key
- If old admin's sub expires before new admin sets up payment → key suspends (grace period), NOT dissolved
- Only current admin can cancel the subscription

## Tier Upgrade/Downgrade
- `reviseSubscriptionTier` creates a custom PayPal plan at the new tier price (factoring in seat count)
- Requires PayPal approval for price increases
- `pendingTier` stored on key, applied via `_applyPendingTier` after PayPal approval
- Verification: only apply pending tier when `subscriptionId` is present (prevents back-button exploit)

## Seat Management
- Adding seats: `reviseSubscriptionSeats` → PayPal revision → approval if price increase
- Removing seats: price reduction takes effect next billing cycle
- Kicking a member does NOT auto-reduce seats (allows swap)
- Persistent amber banner when `members < maxMembers` with clickable "Edit Seats" link

## Open Seat Banner
- Shown in team section when `memberCount < maxMembers` and user is admin
- "You have N open seat(s). Invite a replacement or use Edit Seats to reduce..."
- Disappears automatically when seats match members

## PayPal Credentials (Sandbox)
- Stored in Convex environment variables (not local .env files)
- Client ID and Secret needed for direct API calls
