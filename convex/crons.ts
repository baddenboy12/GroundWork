import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily safety-net: downgrade CANCEL_PENDING users whose billing cycle has ended.
// Runs at 3:17 AM UTC to avoid peak hours. The primary downgrade path is via
// PayPal's BILLING.SUBSCRIPTION.CANCELLED webhook; this cron is a fallback in
// case the webhook is missed or delayed.
crons.daily(
  "process-expired-cancel-pending",
  { hourUTC: 3, minuteUTC: 17 },
  internal.users._processExpiredCancelPending,
);

export default crons;
