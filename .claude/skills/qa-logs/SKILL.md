---
name: qa-logs
description: Automated QA testing for log CRUD operations including create, edit, delete, detail view, photo handling, and filtering
user-invocable: true
---

# QA: Log Management

You are a QA engineer testing GroundWork's log management features. Use Chrome MCP tools to verify all log CRUD operations, filtering, and detail views.

## Pre-flight
1. Get tab context with `tabs_context_mcp` (createIfEmpty: true)
2. Navigate to `http://localhost:5173/dashboard` (must be authenticated)
3. Take an initial screenshot of the dashboard

## Test Checklist

### 1. Dashboard Home View
- [ ] Log cards display with cover photo, title, badges
- [ ] Site and category badges visible on cards
- [ ] Metadata icons (photos, location, date) visible
- [ ] Grid layout renders correctly (responsive columns)
- [ ] Empty state shows if no logs exist

### 2. Create Log
- [ ] Click floating action button (+)
- [ ] Create Log dialog opens
- [ ] Site autocomplete works (type to search, fuzzy match)
- [ ] Can create new site inline if not found
- [ ] Title field accepts input (required validation)
- [ ] Content textarea works
- [ ] Category dropdown has options: inspection, maintenance, incident, audit, general
- [ ] Date/time picker defaults to now
- [ ] Location auto-fill triggers (GPS permission check)
- [ ] Location picker map loads and is interactive
- [ ] Photo upload: drag-drop zone visible
- [ ] Photo upload: file input works
- [ ] Photo compression occurs (check file size)
- [ ] Submit creates log — success toast appears
- [ ] New log appears in dashboard grid
- [ ] Validation: submit without title shows error

### 3. Log Detail View
- [ ] Click a log card — detail dialog opens
- [ ] Title, content, author, timestamp display correctly
- [ ] Category badge visible
- [ ] Location displays if set
- [ ] Photos display in gallery
- [ ] Photo lightbox: click photo opens fullscreen
- [ ] Photo lightbox: arrow navigation works
- [ ] Photo lightbox: escape closes
- [ ] Edit button visible (for log author/admin)
- [ ] Delete button visible
- [ ] Menu dropdown with additional options

### 4. Edit Log
- [ ] Click edit from detail view
- [ ] Edit dialog pre-populates all fields
- [ ] Can modify title, content, category
- [ ] Can update location via picker
- [ ] Can reorder photos (drag)
- [ ] Can remove individual photos
- [ ] Submit updates log — success toast
- [ ] Changes reflected in dashboard

### 5. Delete Log
- [ ] Click delete from detail/menu
- [ ] Confirmation dialog appears
- [ ] Confirm deletes log — success toast
- [ ] Log removed from dashboard grid

### 6. Filtering & Search
- [ ] Search bar accepts text input (debounced)
- [ ] Search filters results by title/content
- [ ] Category dropdown filters by category
- [ ] Date range picker filters by date
- [ ] Active filter count badge updates
- [ ] "Clear all" resets filters
- [ ] Result count displays

### 7. Console & Network
- [ ] Check console for errors during all operations
- [ ] Check network for failed API calls
- [ ] Verify Convex mutations succeed

## Reporting
Compile detailed PASS/FAIL/WARN report with screenshots. Note any validation issues, UX friction, or error states encountered.
