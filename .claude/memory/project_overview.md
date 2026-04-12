---
name: GroundWork project overview
description: GroundWork is a self-hosted PWA for field site inspection logging with teams, subscriptions, and a REST API
type: project
---

GroundWork is a field site inspection/logging application built as a self-hosted PWA.

**Core domain**: Users manage "sites" (physical locations with GPS coords) and create "logs" (inspection, maintenance, incident, audit, general entries) with photo attachments. Logs have title, content, category, timestamps, and optional GPS/location data.

**Key features**:
- Site management with map view (Leaflet)
- Log entries with photo uploads (R2 cloud storage + legacy Convex storage)
- Team collaboration via license keys (team members share sites)
- Team site deletion requires unanimous vote
- Export to PDF (jspdf) and Excel (exceljs)
- REST API (v1) for sites, logs, stats — requires Business plan + API key (Bearer `lv_` prefix, SHA-256 hashed)
- Webhooks integration
- PayPal subscriptions (pro, business tiers)
- Offline support with service worker and offline queue
- Android app via Capacitor (native auth, filesystem, share plugins)
- APK built locally: `npx cap sync android && gradlew assembleDebug`

**Why:** This is the user's primary product — a SaaS for field workers/inspectors to log site visits.

**How to apply:** All feature work should be understood in the context of field inspection workflows. Subscription tiers (free: 1 site, pro: 15 sites, business: unlimited + API access) gate features.

**Current version**: v242 (as of March 25, 2026)

**Next milestone**: Switch from PayPal sandbox to live payments. Corey is considering waiting for his LLC EIN to integrate Stripe instead of going live with PayPal.
