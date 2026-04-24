---
name: Native Stripe checkout must use Chrome Custom Tabs (Play compliance)
description: On native (Capacitor), Stripe Checkout opens via @capacitor/browser, not window.location.href — required for Google Play policy
type: project
---

On native platforms (Android Capacitor), Stripe Checkout is launched via `@capacitor/browser`'s `Browser.open()` — which uses Chrome Custom Tabs on Android — not `window.location.href = checkoutUrl`.

**Why:** Google Play policy forbids collecting subscription payments inside the app's WebView. Loading Stripe Checkout via `window.location.href` navigates the app's WebView to stripe.com, which reviewers flag as an in-app digital purchase flow that isn't Play Billing. CCT runs in a separate browser context with a visible URL bar, so it counts as an external browser for policy purposes — same pattern Spotify/Netflix use.

**How to apply:** The web path (`!isNative`) still uses `window.location.href` and the `/stripe/return` handler. The native path uses `launchCheckout()` in [billing/page.tsx](src/pages/billing/page.tsx), which:
1. Opens Stripe URL via `Browser.open`
2. Listens for `browserFinished` (CCT closed)
3. Calls `syncSubscription({})` (no args → looks up customer's latest sub)
4. Runs post-checkout handlers (team-key creation or admin-transfer completion), guarded against CCT cancellation by checking the user's `subscriptionTier` / `stripeSubscriptionStatus`

The `syncSubscription` Convex action was extended to support empty args because `session_id` never reaches the app — Stripe redirects to `/stripe/return` inside the CCT's browser context, whose sessionStorage is separate from the app's WebView.

Do not revert any of these paths to in-app WebView navigation. Prices and "Subscribe" CTAs in app UI are fine to show — the restriction is on the payment collection itself.
