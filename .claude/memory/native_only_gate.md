---
name: Private routes are native-app-only; web is marketing + legal + Stripe return
description: /dashboard /billing /integrations gated behind isNative. Web visitors see a "Download the app" screen.
type: project
---

The web version of GroundWork at `https://groundwork.teezfpo.com` is **not a usable app** — it only serves marketing, legal pages, and the Stripe return callback. All interactive dashboard/settings surfaces are gated to the native Android Capacitor shell.

## Route classification

| Public (web + native) | Native-only (guarded) |
|---|---|
| `/` (landing) | `/dashboard` |
| `/features` | `/billing` |
| `/privacy` `/terms` `/refund-policy` | `/integrations` |
| `/account-deletion` (Play policy) | |
| `/stripe/return` (Stripe callback + App Link target) | |
| `/auth/callback` `/auth/native-callback` | |
| `/*` (404) | |

## How

[`NativeOnlyGuard`](src/components/NativeOnlyGuard.tsx) wraps the three private route elements in [App.tsx](src/App.tsx). The guard checks [`isNative`](src/lib/platform.ts) (which looks for the `GroundWorkNative` user-agent marker set by [capacitor.config.ts](capacitor.config.ts)). If native → render children, otherwise → render "Available on Android" screen with a "Back to homepage" link.

The signed-in auto-redirect in [Index.tsx](src/pages/Index.tsx) is gated on `isNative` too — otherwise signed-in web users would bounce through the guard for a noisy UX.

## Why

User requirement: the web URL should not be a freely-usable app surface. Install = use. This also means `groundwork.teezfpo.com` only appears in Chrome Custom Tabs for the brief `/stripe/return` hop (which Android App Links intercept before CCT renders), so app users never see the web URL during normal use.

Soft gate only (UA spoofing bypasses it). Not a security boundary — Convex enforces access at the data layer. This is a UX/positioning boundary.

## Don't regress

- Don't widen the guard to public routes (breaks Play Store account-deletion policy if `/account-deletion` stops loading on the web)
- Don't narrow it to "auth required" (that would still let signed-in web users hit `/dashboard`, which defeats the point)
- Keep `/stripe/return` public — the App Link fires before render anyway, and falling back gracefully requires the route to exist

## Future nicety

The "Available on Android" screen has a `TODO` for the Play Store URL — wire it in once the listing goes live.
