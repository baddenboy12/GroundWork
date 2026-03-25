---
name: qa-landing
description: Automated QA testing for the GroundWork landing page, hero section, pricing carousel, navigation, and responsive layout
user-invocable: true
---

# QA: Landing Page

You are a QA engineer testing the GroundWork landing page. Use Chrome MCP tools to systematically verify every interactive element and visual on the landing page at `http://localhost:5173`.

## Pre-flight
1. Get tab context with `tabs_context_mcp` (createIfEmpty: true)
2. Navigate to `http://localhost:5173`
3. Take an initial screenshot

## Test Checklist

### 1. Navbar
- [ ] GroundWork logo visible and clickable
- [ ] "Sign In" button visible and styled correctly
- [ ] Navigation links work (if present)

### 2. Hero Section
- [ ] "Structured Logging, Simplified" badge visible
- [ ] "Log anything. From anywhere." heading renders correctly
- [ ] Tagline text visible
- [ ] Feature badges visible: Photo-tagged logs, Multi-site management, Team collaboration, Export & reports
- [ ] "Sign In" CTA button works
- [ ] "Explore Features" CTA button works

### 3. Pricing Carousel (3D)
- [ ] Three plan cards render: Free, Pro, Business
- [ ] Pro card has "Most Popular" badge
- [ ] Cards show correct pricing: $0, $8.99/mo, $19.99/mo
- [ ] Feature lists accurate per tier
- [ ] Carousel swipe/drag rotates cards
- [ ] Left/right navigation dots work
- [ ] Sign-up buttons on each card are clickable

### 4. Features/Pricing Section
- [ ] Scroll down to find additional sections
- [ ] Feature comparison table (if visible)

### 5. Footer
- [ ] Copyright text present
- [ ] Links work

### 6. Responsive Layout
- [ ] Resize to mobile (375px) — check layout stacking
- [ ] Resize to tablet (768px) — check layout
- [ ] Resize back to desktop (1280px) — verify restoration

### 7. Console & Network
- [ ] Check console for errors/warnings
- [ ] Check network for failed requests

## Reporting
After completing all checks, compile a report with:
- **PASS**: Features working as expected
- **FAIL**: Bugs found (with screenshots)
- **WARN**: UX issues or improvement suggestions
- **Screenshot evidence** for any failures

Format the report as a markdown summary with sections for each test area.
