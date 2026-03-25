---
name: qa-sites
description: Automated QA testing for site management including create, edit, delete, sidebar, location picker, and team deletion voting
user-invocable: true
---

# QA: Site Management

You are a QA engineer testing GroundWork's site management features. Use Chrome MCP tools to verify all site CRUD operations, sidebar behavior, and team deletion voting.

## Pre-flight
1. Get tab context with `tabs_context_mcp` (createIfEmpty: true)
2. Navigate to `http://localhost:5173/dashboard` (must be authenticated)
3. Take an initial screenshot

## Test Checklist

### 1. Site Sidebar
- [ ] Sidebar visible on desktop (left panel)
- [ ] Site list displays all user sites
- [ ] Each site card shows: name, log count, last modified
- [ ] Search/filter input works
- [ ] Sidebar is resizable (drag handle, 140-420px range)
- [ ] Width persists to localStorage on resize
- [ ] "Create Site" button visible
- [ ] Per-site dropdown menu (edit, delete)
- [ ] Click site selects it and shows its logs
- [ ] Selected site has highlight styling
- [ ] Back button returns to home view (all logs)

### 2. Create Site
- [ ] Click "Create Site" button
- [ ] Create Site dialog opens
- [ ] Name field accepts input (required)
- [ ] Location field accepts text (optional)
- [ ] Location picker map loads
- [ ] Can place pin on map
- [ ] Geocoding search works (search by place name)
- [ ] GPS auto-fill works (if permission granted)
- [ ] Submit creates site — success toast
- [ ] New site appears in sidebar
- [ ] Tier gate: check maxSites limit enforced

### 3. Edit Site
- [ ] Open site dropdown menu — click Edit
- [ ] Edit dialog pre-populates name, location, coords
- [ ] Map shows current location pin
- [ ] Can update name and location
- [ ] Submit updates site — success toast
- [ ] Changes reflected in sidebar

### 4. Delete Site
- [ ] Open site dropdown menu — click Delete
- [ ] Confirmation dialog appears
- [ ] For individual accounts: immediate delete after confirm
- [ ] For team accounts: voting dialog shows
  - [ ] Vote count displays ("X of Y members approved")
  - [ ] Countdown timer visible (60 min default)
  - [ ] In-progress badge shows in site list
- [ ] Deleted site removed from sidebar

### 5. Site Popout (Mobile)
- [ ] On narrow screens, site list accessible via popout/popover
- [ ] Popout shows same site list
- [ ] Can select site from popout
- [ ] Pending (offline-created) sites show if any

### 6. Console & Network
- [ ] Check console for errors during all operations
- [ ] Check network for failed mutations
- [ ] Verify location picker tile requests succeed

## Reporting
Compile detailed PASS/FAIL/WARN report. Include screenshots for failures and note any UX friction (e.g., slow map loading, unclear validation).
