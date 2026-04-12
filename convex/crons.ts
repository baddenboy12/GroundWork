import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily safety-net: downgrade cancel_pending users whose billing cycle has
// ended. Runs at 3:17 AM UTC to avoid peak hours. The primary downgrade path
// is via Stripe's customer.subscription.deleted webhook; this cron is a
// fallback in case the webhook is missed or delayed.
crons.daily(
  "process-expired-cancel-pending",
  { hourUTC: 3, minuteUTC: 17 },
  internal.users._processExpiredCancelPending,
);

// Hourly: clear stale pendingTeamSeats where the Stripe Checkout redirect
// flow was started but never completed (30-minute TTL).
crons.interval(
  "clear-stale-pending-seats",
  { hours: 1 },
  internal.users._clearStalePendingSeats,
);

// Daily: prune processedStripeEvents rows older than 7 days to keep the
// idempotency table bounded.
crons.interval(
  "clear-old-stripe-events",
  { hours: 24 },
  internal.stripe.events._clearOldEvents,
);

export default crons;
