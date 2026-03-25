---
name: qa-mobile
description: Automated QA testing for mobile responsiveness, touch interactions, swipe gestures, and mobile-specific UI components
user-invocable: true
---

# QA: Mobile & Responsive UI

You are a QA engineer testing GroundWork's mobile experience. Use Chrome MCP tools with viewport resizing to verify responsive layout, touch targets, and mobile-specific features.

## Pre-flight
1. Get tab context with `tabs_context_mcp` (createIfEmpty: true)
2. Navigate to `http://localhost:5173` (landing page first)
3. Resize to mobile viewport: `resize_window` to 375x812 (iPhone)

## Test Checklist

### 1. Landing Page (Mobile)
- [ ] Navbar collapses appropriately
- [ ] Hero text readable and not clipped
- [ ] Pricing carousel touch-swipeable
- [ ] Plan cards stack or scroll properly
- [ ] CTAs are full-width and touch-friendly (44px+ targets)
- [ ] Footer accessible via scroll

### 2. Dashboard (Mobile)
- [ ] Resize to 375x812
- [ ] Site sidebar hidden by default
- [ ] Menu button to show site popout
- [ ] Site popout displays correctly
- [ ] Log cards stack in single column
- [ ] Log cards have adequate touch targets
- [ ] Floating action button (+) positioned correctly
- [ ] Filter bar accessible and usable
- [ ] Navigation buttons (stats, billing, integrations) reachable

### 3. Dialogs (Mobile)
- [ ] Create Log dialog: full-width on mobile
- [ ] Form fields large enough for touch input
- [ ] Close button large and accessible (consistent sizing)
- [ ] Scroll works within dialog for long forms
- [ ] Location picker map usable on small screen
- [ ] Photo upload drag zone sized for mobile
- [ ] Camera capture input available

### 4. Photo Lightbox (Mobile)
- [ ] Swipe left/right to navigate photos (50px threshold)
- [ ] Swipe works smoothly
- [ ] Close button reachable
- [ ] Photo fills screen appropriately

### 5. Billing (Mobile)
- [ ] Plan carousel swipeable
- [ ] Plan cards readable at mobile width
- [ ] Subscription controls accessible
- [ ] License key management usable

### 6. Text Sizing & Consistency
- [ ] Headings scale down for mobile
- [ ] Body text readable (16px+ recommended)
- [ ] Close buttons consistent across all dialogs
- [ ] Capitalization consistent
- [ ] No text overflow or clipping

### 7. Tablet Breakpoint
- [ ] Resize to 768x1024 (iPad)
- [ ] 2-column grid for log cards
- [ ] Sidebar visible but narrower
- [ ] Dialogs centered, not full-width

### 8. Desktop Restoration
- [ ] Resize to 1280x800
- [ ] Layout returns to full desktop view
- [ ] 3-column grid for log cards
- [ ] Sidebar fully visible and resizable
- [ ] No layout artifacts from resizing

### 9. Touch Targets
- [ ] All interactive elements at least 44x44px
- [ ] Buttons, links, icons have adequate spacing
- [ ] No overlapping touch targets
- [ ] Dropdown menus usable on touch

### 10. PWA Standalone
- [ ] If installable, check standalone layout
- [ ] Back button handling (prevent leaving to auth provider on Android)

## Reporting
Compile PASS/FAIL/WARN report with screenshots at each breakpoint. Note:
- Layout breakpoints that need adjustment
- Touch targets too small
- Text overflow or truncation issues
- Any mobile-specific bugs
