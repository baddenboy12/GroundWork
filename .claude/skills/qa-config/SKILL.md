---
name: qa-config
description: Shared QA test configuration — credentials, file paths, and scope for all QA skills
user-invocable: false
---

# QA Test Configuration

## Test Account
- **Keycloak Username**: read from `$KEYCLOAK_TEST_USER` (set in your environment — never commit)
- **Keycloak Password**: read from `$KEYCLOAK_TEST_PASSWORD` (set in your environment — never commit)
- **Keycloak URL**: `https://auth.teezfpo.com/realms/groundwork`

## Test Assets
- **Test Images**: `C:\Users\cyr\Downloads\unnamed pics` (use any images found here for photo upload tests)

## PayPal Sandbox
- **Client ID**: read from `$PAYPAL_SANDBOX_CLIENT_ID` (set in your environment — never commit)
- **Client Secret**: read from `$PAYPAL_SANDBOX_CLIENT_SECRET` (set in your environment — never commit)
- **Base URL**: `https://api-m.sandbox.paypal.com`

## App URLs
- **Local**: `http://localhost:5173`
- **Production**: `https://groundwork.teezfpo.com`
- **Convex**: `https://useful-ox-860.convex.cloud`

## Scope — Excluded Tests
The following suites are **excluded** from QA runs:
- ~~qa-mobile~~ — No mobile viewport testing needed
- ~~qa-offline~~ — No offline mode testing needed
- ~~qa-teams~~ — No team features testing needed
- ~~qa-export~~ — No export verification needed
