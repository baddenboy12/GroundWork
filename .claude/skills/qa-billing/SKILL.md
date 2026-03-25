---
name: qa-billing
description: Automated QA testing for billing, subscription management, PayPal integration, plan carousel, and upgrade/downgrade flows
user-invocable: true
---

# QA: Billing & Subscriptions

You are a QA engineer testing GroundWork's billing system. Use Chrome MCP tools AND the PayPal sandbox API (via paypal-sandbox skill) to verify subscription flows end-to-end.

## Pre-flight
1. Get tab context with `tabs_context_mcp` (createIfEmpty: true)
2. Navigate to `http://localhost:5173/dashboard` (must be authenticated)
3. Navigate to billing view
4. Get a PayPal sandbox OAuth token for API verification

## PayPal API Setup
```bash
TOKEN=$(curl -s -X POST "https://api-m.sandbox.paypal.com/v1/oauth2/token" \
  -u "REDACTED_PAYPAL_CLIENT_ID:REDACTED_PAYPAL_SECRET" \
  -d "grant_type=client_credentials" | jq -r '.access_token')
```

## Test Checklist

### 1. Plan Carousel (3D)
- [ ] Three plan cards render: Free ($0), Pro ($8.99), Business ($19.99)
- [ ] 3D rotation animation smooth
- [ ] Swipe/drag to rotate works
- [ ] Left/right arrow buttons work
- [ ] Keyboard arrow keys work
- [ ] Pro card has "Most Popular" badge
- [ ] Current plan highlighted/indicated
- [ ] Feature lists accurate per tier

### 2. Current Plan Display
- [ ] Shows current tier name
- [ ] Shows PayPal subscription status (ACTIVE, APPROVED, CANCEL_PENDING)
- [ ] Status indicator styled appropriately

### 3. Subscription Type Selection
- [ ] Individual vs Team radio buttons
- [ ] Team mode shows seat count selector (+/- buttons)
- [ ] Seat range: 1-10
- [ ] Price calculation correct: base + (seats - 1) × $1.99
- [ ] Confirm button submits choice

### 4. Upgrade Flow
- [ ] Select a higher tier — upgrade button appears
- [ ] Click upgrade — PayPal subscription flow launches
- [ ] PayPal approval page loads (sandbox)
- [ ] After approval, return to app
- [ ] Subscription ID synced — verify via PayPal API:
  ```bash
  curl -s "https://api-m.sandbox.paypal.com/v1/billing/subscriptions/$SUB_ID" \
    -H "Authorization: Bearer $TOKEN"
  ```
- [ ] UI updates to show new tier
- [ ] Feature limits updated (sites, logs, photos)

### 5. Downgrade Flow
- [ ] Select a lower tier
- [ ] Downgrade confirmation appears
- [ ] Grace period info displayed
- [ ] After confirm, subscription revised via PayPal

### 6. Cancel Subscription
- [ ] Cancel button visible
- [ ] Click cancel — confirmation dialog
- [ ] Grace period info shown
- [ ] Confirm cancellation
- [ ] Status changes to CANCEL_PENDING
- [ ] Verify via PayPal API subscription status

### 7. Payment Failure Handling
- [ ] If subscription payment fails, banner shows
- [ ] App enters read-only mode
- [ ] Can still view data but not create/edit

### 8. Feature Comparison Table
- [ ] Table shows all tiers side-by-side
- [ ] Feature rows accurate (sites, logs, photos, export, API)
- [ ] Current plan column highlighted

### 9. PayPal Return Handler
- [ ] Navigate to /paypal/return?subscription_id=test
- [ ] Handler processes params correctly
- [ ] Cancelled param handled: /paypal/return?cancelled=true

### 10. Cross-verify with PayPal API
After each subscription operation, verify server-side state:
- List products and plans
- Get subscription details
- Check subscription status matches UI

## Reporting
Compile detailed PASS/FAIL/WARN report. Include:
- Screenshots of each billing state
- PayPal API response verification
- Any sync discrepancies between app UI and PayPal
- Payment flow timing issues
