---
name: qa-full
description: Full automated QA suite — orchestrates all QA skills in sequence to test every feature of GroundWork end-to-end
user-invocable: true
---

# QA: Full Suite Orchestrator

You are a QA lead running the complete GroundWork test suite. Execute each QA skill in sequence, collecting results into a comprehensive report.

## Configuration

Read `qa-config.md` first for test credentials, file paths, and excluded suites.

## Execution Order

Run the following skills in this order (each builds on the previous):

1. **`/qa-landing`** — Landing page, hero, pricing carousel, navigation
2. **`/qa-auth`** — Sign-in, sign-up, session, sign-out
3. **`/qa-sites`** — Site CRUD, sidebar, location picker
4. **`/qa-logs`** — Log CRUD, detail view, filtering, search
5. **`/qa-photos`** — Photo upload, compression, lightbox, reorder
6. **`/qa-billing`** — Plans, PayPal subscriptions, upgrade/downgrade
7. **`/qa-integrations`** — API keys, webhooks, docs

**Excluded** (per user config): qa-teams, qa-export, qa-offline, qa-mobile

## Pre-flight Checklist

Before starting, verify:
- [ ] Dev server running at `http://localhost:5173`
- [ ] Convex dev environment connected
- [ ] Test user account available
- [ ] PayPal sandbox credentials accessible
- [ ] Chrome MCP connected

## Execution Protocol

For each skill:
1. Announce which test suite is starting
2. Execute all test items in the skill's checklist
3. Take screenshots as evidence for failures
4. Check console and network after each major operation
5. Compile per-skill results before moving to next

## Cross-cutting Concerns

While running individual suites, also watch for:
- **Performance**: Slow loads, janky animations, delayed responses
- **Consistency**: UI patterns that differ between pages/dialogs
- **Accessibility**: Missing labels, poor contrast, broken keyboard nav
- **Error handling**: Uncaught exceptions, missing error messages
- **Data integrity**: Stale data, sync issues, missing fields

## Final Report Format

After all suites complete, generate a comprehensive report:

```markdown
# GroundWork QA Report — [Date]

## Executive Summary
- Total tests: X
- Passed: X
- Failed: X
- Warnings: X

## Critical Issues (Must Fix)
[List with screenshots and reproduction steps]

## Warnings (Should Fix)
[UX improvements, minor bugs]

## Passed (Verified Working)
[Feature areas confirmed working]

## Per-Suite Results
### Landing Page
[PASS/FAIL/WARN items]

### Authentication
[PASS/FAIL/WARN items]

[... etc for each suite]

## Recommendations
[Prioritized list of improvements]
```

Save the report to `C:\Users\cyr\projects\GroundWork\.claude\qa-reports\report-[date].md`.

## Notes
- If a blocker is found (e.g., can't authenticate), skip dependent suites and note the blocker
- PayPal sandbox operations may have delays — be patient with API responses
- Take a screenshot before and after each major state change
- Test credentials and image paths are in qa-config.md
