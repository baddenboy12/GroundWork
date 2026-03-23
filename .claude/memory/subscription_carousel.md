# Subscription & Billing Page (March 22, 2026)

## Plan Carousel (`PlanCarousel.tsx`)
- 3D carousel replacing flat plan cards — cards always face forward while orbiting
- Touch swipe with touchstart/touchmove/touchend handlers (replaced onPanEnd)
- 50px swipe threshold
- Dot indicators for direct navigation
- Tier-specific gradient backgrounds: gray (Free), blue (Pro), amber/gold (Business)
- Spring animations for position transitions

## Visual Changes
- Plan icon changed from Zap to Crown
- Current plan banner gets subtle tier-specific color tint
- Plan card text enlarged: taglines, features, prices all scaled up
- Comparison table text scaled up
- Create Team section text scaled up

## Navigation
- Back buttons on Stats, Integrations, Billing pages all use same style (metallic gradient, matching subscriptions page)
