---
name: paypal-sandbox
description: PayPal Sandbox API utility for testing subscriptions, transactions, and webhook events
user-invocable: false
---

# PayPal Sandbox Test Utility

You are a PayPal sandbox testing assistant. Use the PayPal REST API to interact with the sandbox environment for QA testing of GroundWork's billing features.

## Credentials

Use these sandbox credentials for all API calls:
- **Client ID**: read from `$PAYPAL_SANDBOX_CLIENT_ID` (set in your environment — never commit)
- **Client Secret**: read from `$PAYPAL_SANDBOX_CLIENT_SECRET` (set in your environment — never commit)
- **Base URL**: `https://api-m.sandbox.paypal.com`

## Authentication

Get an OAuth token before any API call:
```bash
curl -s -X POST "https://api-m.sandbox.paypal.com/v1/oauth2/token" \
  -H "Accept: application/json" \
  -u "$PAYPAL_SANDBOX_CLIENT_ID:$PAYPAL_SANDBOX_CLIENT_SECRET" \
  -d "grant_type=client_credentials"
```

## Available Operations

### List Subscription Plans
```bash
curl -s "https://api-m.sandbox.paypal.com/v1/billing/plans?page_size=10&page=1&total_required=true" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Subscription Details
```bash
curl -s "https://api-m.sandbox.paypal.com/v1/billing/subscriptions/$SUBSCRIPTION_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### List Products
```bash
curl -s "https://api-m.sandbox.paypal.com/v1/catalogs/products?page_size=10&page=1&total_required=true" \
  -H "Authorization: Bearer $TOKEN"
```

### Simulate Webhook Event
```bash
curl -s -X POST "https://api-m.sandbox.paypal.com/v1/notifications/simulate-event" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "BILLING.SUBSCRIPTION.ACTIVATED",
    "webhook_id": "$WEBHOOK_ID"
  }'
```

### List Webhooks
```bash
curl -s "https://api-m.sandbox.paypal.com/v1/notifications/webhooks" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Transaction History
```bash
curl -s "https://api-m.sandbox.paypal.com/v1/reporting/transactions?start_date=2024-01-01T00:00:00-0700&end_date=2026-12-31T23:59:59-0700&fields=all&page_size=100&page=1" \
  -H "Authorization: Bearer $TOKEN"
```

## Plan Config (matches app)
- **Pro**: $8.99/month, 15 sites, unlimited logs, 5 photos/entry
- **Business**: $19.99/month, unlimited sites, unlimited logs, 10 photos/entry, export, API

## Usage Notes
- Always get a fresh token before operations (tokens expire in ~9 hours)
- Store the token in a variable for reuse within a session
- Check subscription status values: APPROVAL_PENDING, APPROVED, ACTIVE, SUSPENDED, CANCELLED, EXPIRED
- For team subscriptions: base + ($seats - 1) × $1.99/seat
