---
name: qa-auth
description: Automated QA testing for authentication flows including Keycloak sign-in, sign-up, callback handling, and session management
user-invocable: true
---

# QA: Authentication Flows

You are a QA engineer testing GroundWork's authentication system. Use Chrome MCP tools to verify sign-in, sign-up, callback, and session management.

## Pre-flight
1. Get tab context with `tabs_context_mcp` (createIfEmpty: true)
2. Navigate to `http://localhost:5173`
3. Take an initial screenshot

## Test Checklist

### 1. Unauthenticated State
- [ ] Landing page shows for unauthenticated users
- [ ] Sign In button visible in navbar
- [ ] Dashboard route redirects to landing if unauthenticated

### 2. Sign-In Flow
- [ ] Click "Sign In" — redirects to Keycloak
- [ ] Keycloak login page loads correctly
- [ ] Enter test credentials and submit
- [ ] Callback handles OIDC response
- [ ] Redirected to /dashboard after successful auth
- [ ] User name/avatar appears in navbar

### 3. Sign-Up Flow (via Pricing)
- [ ] Click "Sign Up" on a plan card (e.g., Pro)
- [ ] Check that signup_tier is stored in sessionStorage
- [ ] Keycloak registration page loads (if configured)
- [ ] After registration, callback routes to billing page

### 4. Session Persistence
- [ ] Refresh the page — user stays logged in
- [ ] Check for session in storage (localStorage/sessionStorage)

### 5. Sign-Out
- [ ] Open user menu dropdown
- [ ] Click "Sign Out"
- [ ] Session cleared
- [ ] Redirected to landing page
- [ ] Cannot access /dashboard after sign-out

### 6. Error Handling
- [ ] Navigate to /auth/callback with invalid params — check error UI
- [ ] Check console for auth-related errors

### 7. PayPal Return Flow
- [ ] Navigate to /paypal/return with test params
- [ ] Verify handler processes subscription_id param
- [ ] Verify cancelled flow shows appropriate message

## Reporting
Compile a report with PASS/FAIL/WARN for each test area, including screenshots for failures. Note any auth-related console errors.

## Notes
- Keycloak is at `https://auth.teezfpo.com/realms/groundwork`
- Test accounts may be needed — check with user if none available
- The auth callback is at `/auth/callback`
- PayPal return is at `/paypal/return`
