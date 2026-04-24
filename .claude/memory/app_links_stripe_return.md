---
name: Stripe return uses Android App Links to hide web URL from CCT
description: Native Stripe Checkout return is intercepted by Android before Chrome Custom Tabs renders groundwork.teezfpo.com
type: project
---

When Stripe redirects Chrome Custom Tabs to `https://groundwork.teezfpo.com/stripe/return?session_id=…`, Android intercepts the URL via **App Links (autoVerify)** and opens the GroundWork app directly instead. User never sees `groundwork.teezfpo.com` in CCT's URL bar.

**Why:** user requirement — no exposure of the web URL to app users through any process. Before this, Stripe's "← Back to merchant" link (and the successful-payment redirect) would navigate CCT to `/stripe/return`, which briefly flashed the site URL + then the in-browser app UI.

## Moving parts — don't break these together

1. **VPS: `/opt/groundwork/dist/.well-known/assetlinks.json`** — lists the SHA256 fingerprints of every keystore that should be allowed to claim the domain. Served at `https://groundwork.teezfpo.com/.well-known/assetlinks.json` with `Content-Type: application/json`. Currently contains two fingerprints (previous and current debug keystores). When a release build is created, add the release keystore fingerprint + Play App Signing upload cert here, or the App Link fails silently and CCT falls back to showing the URL.

2. **`android/app/src/main/AndroidManifest.xml`** — intent filter with `android:autoVerify="true"` and `android:path="/stripe/return"` scoped exactly so only this path triggers the app. Do not widen to `pathPrefix="/"` or users won't be able to browse the site in their regular Chrome.

3. **`src/App.tsx` — `StripeAppLinkHandler`** — React component inside `<BrowserRouter>` that subscribes to `@capacitor/app`'s `appUrlOpen`, closes CCT via `@capacitor/browser`'s `Browser.close()`, and calls `navigate('/stripe/return' + search, { replace: true })`. The existing `/stripe/return` → `/billing` flow + the mount useEffect in [billing/page.tsx](src/pages/billing/page.tsx) handles session_id sync and team/takeover completion — that logic is NOT duplicated in `launchCheckout`'s `browserFinished` handler (which now only resets pending UI state).

4. **`src/pages/billing/page.tsx` — `launchCheckout`** — on native, uses `Browser.open` only. Does NOT re-implement post-checkout work; that travels through the App Link → `/stripe/return` pathway.

## Verifying App Link status after install

```bash
adb shell pm get-app-links com.teezfpo.groundwork
```

Should show `verified_state=verified` for `groundwork.teezfpo.com`. On first install, Android may show a chooser dialog once before verification completes — user picks "Always" once and it sticks.

## Adjacent rule that still applies

[native_billing_play_compliance.md](native_billing_play_compliance.md) — Stripe Checkout URL itself still opens in CCT (Google Play forbids in-app WebView for payment collection). App Links only affect the return URL, not the Stripe page.
