---
name: Stripe return uses Android App Links to hide web URL from CCT
description: Native Stripe Checkout return is intercepted by Android before Chrome Custom Tabs renders groundwork.teezfpo.com
type: project
---

When Stripe redirects Chrome Custom Tabs to `https://groundwork.teezfpo.com/stripe/return?session_id=…`, Android intercepts the URL via **App Links (autoVerify)** and opens the GroundWork app directly instead. User never sees `groundwork.teezfpo.com` in CCT's URL bar.

**Why:** user requirement — no exposure of the web URL to app users through any process. Before this, Stripe's "← Back to merchant" link (and the successful-payment redirect) would navigate CCT to `/stripe/return`, which briefly flashed the site URL + then the in-browser app UI.

## Moving parts — don't break these together

1. **VPS: `/opt/groundwork/dist/.well-known/assetlinks.json`** — lists the SHA-256 fingerprints of every keystore that should be allowed to claim the domain. Served at `https://groundwork.teezfpo.com/.well-known/assetlinks.json` with `Content-Type: application/json`. Source of truth lives at [public/.well-known/assetlinks.json](public/.well-known/assetlinks.json) and is copied verbatim into `dist/` by Vite — but `scp -r dist/* …` **skips it** because the shell glob `*` excludes dotfiles; deploy with an explicit `scp dist/.well-known/assetlinks.json …` or `scp -r dist/.well-known …` after the main bundle copy.

   **Required fingerprints (as of v1.0.5, May 2026):**
   - **Play App Signing certificate** (`40:D1:74:FF:1C:83:17:4D:77:0F:87:79:42:75:78:86:1F:70:E0:74:8A:82:5B:70:01:8E:DD:B5:06:7D:76:9A`) — what end users' Play-installed APKs are signed with. **THIS IS THE CRITICAL ONE.** Get from Play Console → Setup → App integrity → App signing → "App signing key certificate" → SHA-256.
   - **Upload key certificate** (`0C:65:C7:9C:40:29:97:F2:58:52:57:66:39:4F:DF:FE:A7:53:20:DA:DB:A4:97:EA:80:C0:F4:88:C2:71:60:7F`) — for any internal-track or sideloaded AAB-signed installs.
   - **Debug keystore** (`B8:52:77:D0:18:F5:F7:4B:91:A2:CB:4B:83:6D:60:7C:5E:BE:24:FA:3A:59:96:9B:15:61:CA:A1:D7:AD:94:65`) — default `~/.android/debug.keystore`, lets sideloaded debug APKs verify the App Link locally.

   **Lesson learned (May 2026):** The file used to contain only the upload keystore SHA-256 (`8D:1D:18:…`, which was actually stale from before the Apr-2026 upload key reset). End-user APKs are re-signed by Play App Signing with a different cert, so only the App Signing fingerprint matters for production users. Play Console's "Deep links" page reported "1 domain failed validation" for `groundwork.teezfpo.com` and "Link not working" for `/stripe/return` — symptom in-app was that Stripe Checkout return landed in CCT showing the web `NativeOnlyGuard` "Available on Android" page instead of bouncing into the app. Fix shipped in v1.0.5 (versionCode 6).

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
