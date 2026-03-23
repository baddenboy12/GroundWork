---
name: GroundWork project structure
description: Key directories and file organization — src/pages pattern, convex backend, twa android wrapper
type: project
---

**Frontend (src/)**:
- `main.tsx` → `App.tsx` (routes + providers)
- `pages/` — route-based: dashboard/, billing/, integrations/, landing/, paypal/, auth/, design-system/
- `pages/dashboard/` — main app: page.tsx + _components/ (dialogs, sidebars, cards, navbar) + _lib/ (utils, constants, export, subscription logic)
- `components/providers/` — auth, convex, query-client, theme, default (wraps all)
- `components/ui/` — shadcn/ui primitives
- `hooks/` — use-auth, use-cached-query, use-offline-queue, use-online-status, use-service-worker, use-subscription, use-background-cache-sync, use-debounce, use-auth-fallback
- `lib/` — utils.ts, offline-session.ts, register-sw.ts

**Backend (convex/)**:
- `schema.ts` — tables: users, licenseKeys, keyMemberships, paypalPlans, sites, apiKeys, webhooks, siteDeleteVotes, logs
- `http.ts` — REST API routes (/api/v1/sites, /api/v1/logs, /api/v1/stats, /photo-proxy, /paypal-webhook)
- `sites.ts`, `logs.ts`, `users.ts` — core CRUD queries/mutations
- `licenseKeys.ts` — team key management
- `siteDeleteVotes.ts` — team voting for site deletion
- `integrations/` — apiKeys.ts, apiKeysActions.ts, webhooks.ts
- `paypal/` — actions.ts, plans.ts
- `r2/` — storageActions.ts
- `emails/` — queries.ts, teamNotifications.ts
- `storage.ts` — legacy file storage helpers

**Android (twa/)**: Trusted Web Activity wrapper with Gradle build, signed APK.

**Why:** Knowing the layout speeds up navigation and prevents creating files in wrong locations.

**How to apply:** Dashboard components go in `src/pages/dashboard/_components/`. New Convex functions go in the relevant domain file (sites.ts, logs.ts, etc.). New UI components go in `src/components/ui/`.
