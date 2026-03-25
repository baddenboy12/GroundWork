---
name: qa-teams
description: Automated QA testing for team management including license keys, seat management, admin transfer, member kicking, and site deletion voting
user-invocable: true
---

# QA: Team Management

You are a QA engineer testing GroundWork's team features. Use Chrome MCP tools and the PayPal sandbox API to verify team subscription, license keys, member management, and voting.

## Pre-flight
1. Get tab context with `tabs_context_mcp` (createIfEmpty: true)
2. Navigate to `http://localhost:5173/dashboard` (must be authenticated as team admin)
3. Navigate to billing view
4. Get PayPal sandbox token for API verification

## Test Checklist

### 1. Team Subscription Setup
- [ ] Select "Team" subscription type
- [ ] Seat count selector (+/- buttons) works
- [ ] Price calculation: base + (seats - 1) × $1.99/seat
- [ ] Subscribe via PayPal sandbox
- [ ] Team subscription created successfully
- [ ] Verify via PayPal API

### 2. License Key Management
- [ ] License keys section visible for team admins
- [ ] "Create Key" button generates new key code
- [ ] Key code displayed and copyable
- [ ] Key list shows: key code, member count, status
- [ ] Each key shows member details

### 3. Apply Key (Join Team)
- [ ] "Apply Key" input visible
- [ ] Paste valid key code
- [ ] Submit joins the team
- [ ] Member appears in team list
- [ ] Shared workspace accessible

### 4. Remove Key (Leave Team)
- [ ] Member can leave via "Remove Key" / leave button
- [ ] Confirmation dialog
- [ ] Cannot leave if sole member (with appropriate message)
- [ ] After leaving, returns to individual subscription state

### 5. Admin Transfer
- [ ] Admin can promote another member to admin
- [ ] Transfer dialog shows confirmation
- [ ] Subscription follows the admin role
- [ ] New admin sees billing controls
- [ ] Old admin loses billing controls
- [ ] PayPal subscription transferred correctly

### 6. Kick Member
- [ ] Admin can remove a member
- [ ] Confirmation dialog
- [ ] Member removed from team
- [ ] Kicked member loses access to team workspace

### 7. Seat Management
- [ ] Admin can adjust seat count
- [ ] Increase seats: PayPal revision triggered
- [ ] Decrease seats: validation (can't go below current member count)
- [ ] Verify PayPal subscription revised with new amount

### 8. Site Deletion Voting
- [ ] Propose site deletion in team context
- [ ] Voting dialog opens with countdown timer (60 min)
- [ ] Vote count displays: "X of Y approved"
- [ ] In-progress badge visible in site list
- [ ] Auto-delete when all members vote yes
- [ ] Vote dialog updates in real-time
- [ ] Dialog closes if site deleted by another member's vote

### 9. Payment Suspension (Team-wide)
- [ ] If admin's payment fails, entire team goes read-only
- [ ] Banner visible for all team members
- [ ] Data accessible but no create/edit

## Reporting
Compile PASS/FAIL/WARN report. Team features require multiple user perspectives — note which tests need a second test account. Include PayPal API verification for subscription changes.
