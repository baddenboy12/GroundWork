# Landing Page Redesign — Split Into Separate Pages

## Overview
Split the single-page landing into 4 routes: `/` (hero), `/features`, `/pricing`, `/use-cases`. Update the navbar to link between them. Improve mobile touch-friendliness, text sizing, and expand the features list to showcase more of what we've built.

## Changes

### 1. Routing (App.tsx)
- Add 3 new routes: `/features`, `/pricing`, `/use-cases`
- Create wrapper page components for each

### 2. Navbar (Navbar.tsx)
- Change hash links (`#features`, `#pricing`, `#usecases`) to route links (`/features`, `/pricing`, `/use-cases`)
- Show nav links on mobile too (they're currently `hidden md:flex`) — since we now have separate pages, the nav needs to be accessible on mobile
- Add a simple mobile hamburger menu or show links inline since there are only 3
- Increase tap target sizes for links (min 44px height)

### 3. Hero (Hero.tsx) — stays at `/`
- Remove the sections below (Features, UseCases, Pricing are now their own pages)
- Keep the hero as-is with minor touch-friendly tweaks:
  - Slightly increase button sizes
  - Make highlight items slightly larger text
  - Change "View Pricing" link to navigate to `/pricing` instead of `#pricing`

### 4. Features Page (`/features`) — expanded feature list
Current features listed (6):
1. Photo-Tagged Logs
2. Multi-Site Management
3. Custom Categories & Tags
4. Export Reports
5. Powerful Search & Filters
6. Audit-Ready Records

**Add these missing features** the app actually has:
7. Team Workspaces — Create teams, share sites, manage seats, license keys
8. Statistics Dashboard — 30-day activity charts, category breakdown, top sites
9. Offline-Ready PWA — Install on any device, works without internet, auto-syncs
10. Speech-to-Text Logging — Dictate notes hands-free in the field
11. REST API & Webhooks — Integrate with external systems (Business tier)
12. GPS Location Tagging — Auto-capture coordinates or pick from map

Increase text sizes slightly, make feature cards more touch-friendly (larger padding, active states instead of hover-only).

### 5. Pricing Page (`/pricing`)
- Move the existing Pricing component to its own page
- Wrap with Navbar + Footer
- Increase text sizes for mobile readability
- Increase button sizes to `size="lg"` for touch targets
- Fix `/mo` display issue mentioned earlier

### 6. Use Cases Page (`/use-cases`)
- Move existing UseCases component to its own page
- Wrap with Navbar + Footer
- Increase card text sizes
- Consider adding more use cases or expanding descriptions

### 7. Footer (Footer.tsx)
- Update links from hash anchors to route links
- Keep as shared component across all pages

### 8. Index.tsx
- Remove Features, UseCases, Pricing imports from LandingPage
- LandingPage now renders only: Navbar → Hero → Footer
- Add a brief CTA section between Hero and Footer with "Explore Features" / "View Pricing" buttons linking to the new pages

### 9. Mobile Touch Optimizations (all pages)
- All buttons: minimum `size="lg"` (40px+ height)
- Nav links: minimum 44px tap targets
- Feature cards: add `active:bg-accent/40` for mobile tap feedback
- Increase body text from `text-sm` to `text-base` where too small
- Section headings: ensure readable without being oversized
