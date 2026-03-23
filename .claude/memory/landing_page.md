# Landing Page (March 23, 2026)

## Structure
- Single scrollable page at `/` (no separate routes for features/pricing)
- Merged Hero + Pricing into one view that fits without scrolling
- Sections: Navbar → Hero message + Plan Carousel → Footer
- Features page at `/features` with 12 feature cards + 3 use case cards
- Hash navigation: `#features` link from landing page

## Navbar
- GroundWork logo + brand text (larger, matching dashboard size)
- "Explore Features" button links to `/features`
- "Sign In" button (larger, touch-friendly)
- No Features/Pricing nav links in header

## Hero
- Tagline badge: "Structured Logging, Simplified"
- Headline: "Log anything. From anywhere."
- Subtitle: general-purpose positioning (not field-ops specific)
- Feature pills: Photo-tagged logs, Multi-site management, Team collaboration, Export & reports
- Two CTA buttons: Sign In + Explore Features

## Pricing (embedded in Hero page)
- Same 3D carousel as billing page (PlanCarousel component)
- Cards show: Free ($0), Pro ($8.99/mo, "Most Popular"), Business ($19.99/mo)
- Buttons say "Sign Up" (not "Sign In") and use `prompt=create` for Keycloak registration
- Pro/Business buttons store `gw_signup_tier` in sessionStorage for post-registration redirect to billing

## Features Page (/features)
- 12 feature cards in responsive grid
- Features: Photo-Tagged Logs, Multi-Site Management, Custom Categories, Export Reports, Search & Filters, Audit-Ready Records, Team Workspaces, Statistics Dashboard, Offline-Ready, REST API & Webhooks, GPS Location Tagging, Real-Time Collaboration
- 3 use case cards: Tower & Telecom, Generator Maintenance, Site Surveys & Audits
- Offline-Ready: no mention of PWA (may convert to native Android app)
- Description is general-purpose, not marketed directly to field ops

## Footer
- Simplified: GroundWork logo + copyright
- No extra nav links

## Keycloak Registration
- Sign Up buttons use `prompt: "create"` to go directly to Keycloak registration page
- Email verification disabled in Keycloak (smooth signup flow)
- After registration, user redirected to billing page if `gw_signup_tier` is set
