---
name: qa-offline
description: Automated QA testing for offline functionality including queue, sync, cached views, service worker, and offline log/photo creation
user-invocable: true
---

# QA: Offline Functionality

You are a QA engineer testing GroundWork's offline capabilities. Use Chrome MCP tools to verify offline queue, sync, cached data, and service worker behavior.

## Pre-flight
1. Get tab context with `tabs_context_mcp` (createIfEmpty: true)
2. Navigate to `http://localhost:5173/dashboard` (must be authenticated)
3. Ensure some data exists (sites and logs) for cache testing

## Test Checklist

### 1. Online Baseline
- [ ] Dashboard loads with all data
- [ ] Service worker registered (check console for SW messages)
- [ ] Background cache sync running (proactive caching)

### 2. Go Offline
- [ ] Use Chrome DevTools or network simulation to go offline
  ```javascript
  // In Chrome console or via javascript_tool:
  // Note: actual offline testing may require Chrome DevTools Network tab
  ```
- [ ] "You're offline" banner appears
- [ ] Pending entry count shows (if any)
- [ ] "Sync Now" button visible but disabled (offline)

### 3. View Cached Data
- [ ] Dashboard still shows cached log entries
- [ ] Log cards render with cached photos
- [ ] Site sidebar shows cached sites
- [ ] Can click log cards to view details (cached)
- [ ] Cached data is read-only indication clear

### 4. Create Log While Offline
- [ ] Click floating action button (+)
- [ ] Create dialog opens
- [ ] Offline photo uploader component appears (not regular uploader)
- [ ] Can fill all fields: site, title, content, category
- [ ] Photo upload: compresses to base64 data URL
- [ ] "Saved locally" notice displays
- [ ] Processing spinner during photo compression
- [ ] Submit stores entry in offline queue
- [ ] Amber-bordered card appears in dashboard ("Pending sync" badge)
- [ ] Entry shows in pending entries section at top

### 5. Multiple Offline Entries
- [ ] Create additional offline entries
- [ ] All appear with pending badges
- [ ] Pending count updates in banner

### 6. Export Blocking
- [ ] Export button disabled while offline
- [ ] WiFi icon + tooltip explaining offline restriction

### 7. Reconnect & Sync
- [ ] Re-enable network connection
- [ ] Offline banner disappears
- [ ] Auto-sync triggers (or click "Sync Now")
- [ ] Spinner shows during sync
- [ ] Offline entries sync to server
- [ ] Amber borders removed — entries become normal cards
- [ ] Photos uploaded from base64 to R2
- [ ] Toast notification on sync completion
- [ ] Verify entries exist in Convex (via network requests)

### 8. Conflict Handling
- [ ] If same log edited online and offline, last-write-wins
- [ ] No data loss or crashes

### 9. PWA / Service Worker
- [ ] App installable (if on mobile or desktop PWA prompt)
- [ ] Standalone mode works (no address bar)
- [ ] Assets cached (check cache storage)
- [ ] Cache-first for assets, network-first for API

### 10. Console & Network
- [ ] Check console for SW registration/errors
- [ ] Check for IndexedDB/localStorage usage
- [ ] Verify sync API calls on reconnect

## Reporting
Compile PASS/FAIL/WARN report. Pay special attention to:
- Data integrity (no lost entries)
- Photo sync reliability (base64 → R2)
- UI feedback clarity (is it obvious you're offline?)
- Sync timing and error recovery

## Notes
- Offline simulation may require using Chrome DevTools Network tab manually
- The javascript_tool can check navigator.onLine but may not actually simulate offline
- Consider testing with actual network disconnect for most realistic results
