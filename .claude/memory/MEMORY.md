# GroundWork Memory Index

## Core
- [Project Overview](project_overview.md) — GroundWork: field site inspection PWA, v242, next milestone: live payments
- [Tech Stack](project_techstack.md) — React 19, Vite 7, Convex, Tailwind 4, shadcn/ui, Keycloak, R2, PayPal, Capacitor
- [Project Structure](project_structure.md) — Directory layout and file organization conventions
- [User Profile](user_profile.md) — Corey: solo dev building GroundWork SaaS on Windows, planning LLC

## Infrastructure
- [VPS, GitHub & Keycloak](reference_vps.md) — VPS at 172.233.163.131, GitHub repo, Keycloak admin API access
- [Deployment Workflow](deployment_workflow.md) — End-to-end deploy for web (SCP), Android (Capacitor), Convex backend
- [Convex Debug Tools](convex_debug_tools.md) — Debug queries, CLI commands, test accounts, sandbox mode, version tracking

## Features
- [Export System](export_system.md) — PDF (jsPDF) and Excel (ExcelJS) exports, themes, page layout, native mobile save
- [Android / Capacitor](android_capacitor.md) — Native app with auth dialog, filesystem, share plugins, build process
- [Mobile UI Optimizations](ui_mobile_optimizations.md) — Touch-friendly redesign: speech bubble site list, photo cascade, animations
- [Subscription & Carousel](subscription_carousel.md) — 3D plan carousel, tier colors, Crown icon, comparison table
- [Team Subscription & Billing](team_subscription_billing.md) — Grace periods, admin transfer, seat management, cancel-pending
- [Landing Page](landing_page.md) — Single-page hero+pricing, /features route, Keycloak registration
- [Log Location Auto-fill](log_location_autofill.md) — Site location/GPS auto-fills in new/edit log dialogs

## UI/UX
- [UI Text Scaling](ui_text_scaling.md) — Consistent close buttons, text sizing, capitalization across all dialogs
- [Deploy After Changes](feedback_deploy_after_changes.md) — Commit and push to VPS after each change, not batched
