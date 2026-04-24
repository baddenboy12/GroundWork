# GroundWork Memory Index

## Core
- [Project Overview](project_overview.md) — GroundWork: field site inspection PWA, v242, next milestone: live payments
- [Tech Stack](project_techstack.md) — React 19, Vite 7, Convex, Tailwind 4, shadcn/ui, Keycloak, R2, PayPal, Capacitor
- [Project Structure](project_structure.md) — Directory layout and file organization conventions
- [User Profile](user_profile.md) — Corey: solo dev building GroundWork SaaS on Windows, planning LLC

## Infrastructure
- [VPS, GitHub & Keycloak](reference_vps.md) — VPS at 172.233.163.131, GitHub repo, Keycloak admin API access
- [Production Env Vars](env_vars_production.md) — .env.production.local for prod builds, .env.local for dev Convex
- [pnpm Package Manager](pnpm_package_manager.md) — use `npx pnpm add <pkg>`; `npm install` breaks on pnpm-structured node_modules
- [Convex Run Prod Flag](convex_run_prod_flag.md) — `npx convex run` needs `--prod` to hit prod; without it, targets dev per .env.local
- [Deployment Workflow](deployment_workflow.md) — End-to-end deploy for web (SCP), Android (Capacitor), Convex backend
- [Convex Debug Tools](convex_debug_tools.md) — Debug queries, CLI commands, test accounts, sandbox mode, version tracking

## Features
- [Export System](export_system.md) — PDF (jsPDF) and Excel (ExcelJS) exports, themes, page layout, native mobile save
- [Android / Capacitor](android_capacitor.md) — Native app with auth dialog, filesystem, share plugins, build process
- [Mobile UI Optimizations](ui_mobile_optimizations.md) — Touch-friendly redesign: speech bubble site list, photo cascade, animations
- [Subscription & Carousel](subscription_carousel.md) — 3D plan carousel, tier colors, Crown icon, comparison table
- [Team Subscription & Billing](team_subscription_billing.md) — Grace periods, admin transfer, seat management, cancel-pending
- [Native Billing / Play Compliance](native_billing_play_compliance.md) — Stripe Checkout must open in Chrome Custom Tabs on Android, never in-WebView
- [Stripe Return via App Links](app_links_stripe_return.md) — /stripe/return intercepted by Android before CCT renders, hides web URL from user
- [Native-Only Route Gate](native_only_gate.md) — web is marketing+legal+callback only; /dashboard, /billing, /integrations gated to native via isNative + NativeOnlyGuard
- [Proration Preview Flow](stripe_proration_preview.md) — Create Team / Edit Seats preview the prorated charge via invoices.createPreview before applying
- [Team Dissolution Seat Trim](team_dissolution_seat_trim.md) — removeKey schedules _trimExtraSeats when last member leaves self-created team, preventing phantom seat charges
- [Landing Page](landing_page.md) — Single-page hero+pricing, /features route, Keycloak registration
- [Log Location Auto-fill](log_location_autofill.md) — Site location/GPS auto-fills in new/edit log dialogs
- [30-Day Free Trial](free_trial.md) — Pro/Business one-time-per-account trial; hasUsedTrial sticky flag, Stripe `trial_period_days`

## UI/UX
- [UI Text Scaling](ui_text_scaling.md) — Consistent close buttons, text sizing, capitalization across all dialogs
- [Deploy After Changes](feedback_deploy_after_changes.md) — Commit and push to VPS after each change, not batched
