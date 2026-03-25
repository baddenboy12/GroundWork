---
name: qa-integrations
description: Automated QA testing for API keys, webhooks, API docs, and Business-tier integration features
user-invocable: true
---

# QA: Integrations & API

You are a QA engineer testing GroundWork's integrations features. Use Chrome MCP tools to verify API key management, webhooks, and API documentation.

## Pre-flight
1. Get tab context with `tabs_context_mcp` (createIfEmpty: true)
2. Navigate to `http://localhost:5173/dashboard` (must be authenticated with Business tier)
3. Navigate to integrations view

## Test Checklist

### 1. Tier Gating
- [ ] Free/Pro: integrations button shows tier lock
- [ ] Business: integrations page accessible
- [ ] Upgrade dialog for locked users

### 2. API Keys Tab
- [ ] Tab visible and selectable
- [ ] "Generate Key" button visible
- [ ] Enter key name — submit creates key
- [ ] Full key displayed once (lv_... format)
- [ ] Copy button works — "Copied!" feedback
- [ ] Key list shows all active keys with creation date
- [ ] Key hash displayed (not full key) after initial view
- [ ] Revoke key — status changes to revoked
- [ ] Delete key — removed from list
- [ ] Cannot use revoked key for API calls

### 3. API Key Validation
- [ ] Use generated key to call API endpoint:
  ```bash
  curl -s "https://useful-ox-860.convex.site/api/sites" \
    -H "Authorization: Bearer lv_GENERATED_KEY"
  ```
- [ ] Valid key returns data
- [ ] Revoked key returns 401
- [ ] Invalid key returns 401

### 4. Webhooks Tab
- [ ] Tab visible and selectable
- [ ] "Create Webhook" button visible
- [ ] Create webhook modal: name, URL, event checkboxes
- [ ] Event types: log.created, log.updated, log.deleted
- [ ] Submit creates webhook — secret displayed once
- [ ] Webhook list shows: name, URL, status (active/disabled)
- [ ] Toggle webhook enabled/disabled
- [ ] Test webhook — sends test event to URL
- [ ] Delete webhook — removed from list

### 5. API Docs Tab
- [ ] Tab visible and selectable
- [ ] REST API specification visible
- [ ] Endpoints documented: sites, logs, stats
- [ ] Authentication format documented (Bearer token)
- [ ] Examples shown: cURL, Python, JavaScript
- [ ] Rate limiting info (if implemented)

### 6. Console & Network
- [ ] Check console for errors
- [ ] Verify API key generation network calls succeed
- [ ] Webhook test fires and response logged

## Reporting
Compile PASS/FAIL/WARN report. Include:
- Screenshots of each tab
- API key lifecycle test results
- Webhook delivery verification
- Documentation accuracy check
