---
name: Dashboard performance optimization
description: 2026-04-24 dashboard bundle split, export lazy loading, dead-code cleanup, and deployment record
type: implementation
---

## 2026-04-24 Optimization Pass

Commit: `8034bba` (`Optimize dashboard loading and cleanup dead code`) pushed to `origin/main`.

### What Changed

- Dashboard route startup was slimmed down by lazy-loading heavy views and dialogs:
  - `StatsView` / Recharts
  - `BillingView`
  - `IntegrationsView`
  - `CreateLogDialog`
  - `ExportDialog`
  - `GlobalExportDialog`
  - `LogDetailDialog`, `EditLogDialog`, `PhotoLightbox`, and `ZoomablePhoto`
  - `CreateSiteDialog` and `EditSiteDialog`
- Leaflet CSS moved out of `src/App.tsx` and into `LocationPicker`, so map styles load only with map UI.
- `jspdf` and `exceljs` are now dynamically imported inside export generation, so export libraries do not load with the dashboard route.
- Removed unused `src/pages/dashboard/_components/SiteSidebar.tsx`.
- Convex free-tier log limit check now uses `.take(maxLogs)` instead of collecting all site logs just to count.
- Push notification logging no longer prints raw FCM tokens; verbose push logs are dev-only.
- Service worker registration failure now uses `console.warn`.

### Result

- Initial dashboard route chunk dropped from roughly `1,027 kB` to roughly `82 kB`.
- Global CSS dropped from roughly `140.5 kB` to roughly `123.8 kB` because Leaflet CSS is split out.
- Vite no longer emits the oversized dashboard chunk warning.

### Verification And Deployment

- `npm run lint` passed.
- `npm run build` passed.
- Targeted Prettier check on edited files passed.
- `git diff --check` passed, aside from normal CRLF warnings on Windows.
- Web build was deployed to the VPS with:
  - `scp -r dist/* root@172.233.163.131:/opt/groundwork/dist/`
- Live site verified `200` at `https://groundwork.teezfpo.com`.
- Convex backend deployed with `npx convex deploy --yes`.
- Android debug APK rebuilt with `npx cap sync android` and `android/gradlew.bat assembleDebug`.
- APK copied to `C:\Users\cyr\Downloads\groundwork-debug.apk`.
- No `APP_VERSION` bump was made because this was a performance/dead-code refactor, not a visible feature change.

### Maintenance Notes

- Keep map, export, chart, billing, photo-lightbox, and edit/create dialog stacks out of static dashboard imports.
- Do not re-add global `leaflet/dist/leaflet.css` in `src/App.tsx`.
- Keep `jspdf` and `exceljs` as dynamic imports inside export functions.
- Before removing lazy boundaries, check the dashboard route chunk in `npm run build`.
