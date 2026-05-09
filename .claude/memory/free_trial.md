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

## Trial-signup auto-launch from landing (v1.0.5+, May 2026)

When a user lands on `/billing` post-signup with `gw_signup_tier` set in sessionStorage (set by `handleSignUp` in [src/pages/landing/Hero.tsx](src/pages/landing/Hero.tsx)), `/billing` now skips both confirmation dialogs and **auto-launches Stripe Checkout** as Individual / 1 seat. A full-screen overlay covers the regular `/billing` UI from arrival until either checkout completes (overlay clears on `/billing` remount after `/stripe/return`) or the user cancels in CCT (overlay flips to "Trial signup not completed — Try again").

**Why:** Two cancel-able dialogs (`SubscriptionTypeDialog` + "Continue in your browser") plus the underlying browseable `/billing` UI gave new signups too many escape hatches; users were dropping out of the funnel before reaching Stripe. Play Console feedback flagged the flow as "too lax."

**Storage choice (v263+, May 9 2026 fix):** `gw_signup_tier` is stored in **localStorage**, not sessionStorage. On native, the AuthDialog → main WebView handoff plus the hard `window.location.replace("/auth/callback")` in `NativeCallback.tsx` was sometimes losing the sessionStorage value, dropping the user on `/dashboard` instead of `/billing` post-signup. localStorage survives the entire chain. Cleanup happens once in the `/billing` mount useEffect after we consume the value.

**Belt-and-suspenders guard (v263+):** [src/pages/Index.tsx](src/pages/Index.tsx)'s `RedirectToDashboard` also checks `localStorage["gw_signup_tier"]` and routes to `/billing` instead of `/dashboard` when set. This catches any case where `navigateAfterAuth` in [Callback.tsx](src/pages/auth/Callback.tsx) missed the value or where the user was bounced through `/` first.

**Mount-time auto-launch (v264+, May 9 2026 fix):** The `/billing` auto-launch useEffect fires on mount with no `isLoading` / `tier` dependency. Earlier versions (v262-v263) gated on `useSubscription().isLoading`, which on first `/billing` mount post-signup was sometimes still `true` because the Convex `getCurrentUser` query hadn't resolved yet — leaving the overlay never triggered until the user navigated away and back. The user is guaranteed authenticated by mount time (Callback only navigates to `/billing` after `isConvexAuthenticated` is true and `updateCurrentUser` succeeds), so we don't need to wait. The (rare) edge case of "user is already on the chosen tier" is handled by `handleStripeSubscribe`'s early-return calling `opts.onCancelled()` so the overlay flips to "Try again" rather than getting stuck on the spinner.

**Implementation:** All in [src/pages/billing/page.tsx](src/pages/billing/page.tsx):
- `signupAutoLaunch` state (`"preparing" | "cancelled" | null`) and `autoLaunchTierRef`.
- `launchCheckout` accepts `{ skipConfirm: true }` to bypass the "Continue in your browser" dialog.
- `handleStripeSubscribe` accepts `{ skipConfirm, onCancelled }`. `onCancelled` fires on browserFinished (CCT closed without success redirect) AND on the createCheckoutSession error catch — keeps the overlay from getting stuck on "preparing".
- The overlay has **no** close, X, back, or Cancel button by design. Only "Try again" when in cancelled state.

**Team conversion:** Removed from the trial signup funnel. Users who want a team subscribe via the regular in-app `/billing` plan-card flow afterward — `SubscriptionTypeDialog` and the "Continue in your browser" dialog are still in use for that path (regression-tested). The `gw_sub_team` sessionStorage flag is therefore never set during trial signup.

**Edge cases:**
- Already-on-tier user signing up clicking the same trial CTA: short-circuits before setting overlay (`tierRank` check). No checkout launches.
- App Link verification still failing on a device (e.g. assetlinks.json edge case): Stripe success could redirect into CCT instead of intercepting back to app. The overlay would then flip to `"cancelled"` when user manually closes CCT — confusing UX but rare and self-correcting on retry. Not special-cased.
- Web users: `/billing` is wrapped in `NativeOnlyGuard` so the overlay is never reached on web; users still hit "Available on Android" page. Web trial signup is an explicit dead-end (separate work).
