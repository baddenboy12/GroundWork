---
name: qa-export
description: Automated QA testing for PDF, Excel, and CSV export features including themes, filters, tier gating, and download verification
user-invocable: true
---

# QA: Export Features

You are a QA engineer testing GroundWork's export functionality. Use Chrome MCP tools to verify PDF, Excel, and CSV export generation, theming, filtering, and tier gates.

## Pre-flight
1. Get tab context with `tabs_context_mcp` (createIfEmpty: true)
2. Navigate to `http://localhost:5173/dashboard` (must be authenticated with Business tier)
3. Ensure at least one site with multiple logs exists

## Test Checklist

### 1. Tier Gating
- [ ] Free tier: export button shows upgrade lock
- [ ] Pro tier: export button shows upgrade lock
- [ ] Business tier: export button functional
- [ ] Upgrade dialog shows correct messaging
- [ ] "Upgrade" CTA navigates to billing

### 2. Per-Site Export Dialog
- [ ] Select a site, click export button
- [ ] Export dialog opens
- [ ] Format options visible: PDF, Excel (XLSX), CSV
- [ ] Selection modes: filter-based auto-select, individual checkboxes
- [ ] Filter controls: date range, category, search text
- [ ] Log count updates with filters

### 3. PDF Export
- [ ] Select PDF format
- [ ] Theme picker shows 5 themes with preview thumbnails
- [ ] Can select different themes
- [ ] Title and subtitle fields available
- [ ] Cover page option toggle
- [ ] Generate PDF — progress indicator shows
- [ ] PDF downloads with timestamped filename
- [ ] Verify PDF opens and contains: cover page, log entries, photos, metadata

### 4. Excel Export
- [ ] Select Excel format
- [ ] Generate XLSX — downloads successfully
- [ ] Verify file opens and contains: headers, log data, auto-sized columns
- [ ] Category colors applied (if implemented)

### 5. CSV Export
- [ ] Select CSV format
- [ ] Generate CSV — downloads successfully
- [ ] Verify file contains: headers, all fields, proper escaping

### 6. Global Export
- [ ] Click global export button (not per-site)
- [ ] Global export dialog opens
- [ ] Same format and filter options available
- [ ] Exports aggregate logs from all sites
- [ ] Download with timestamped filename

### 7. Offline Blocking
- [ ] Simulate offline (disconnect network or use Chrome DevTools)
- [ ] Export button disabled with WiFi icon tooltip
- [ ] Cannot trigger export while offline

### 8. Console & Network
- [ ] Check console for generation errors
- [ ] Check for jsPDF/ExcelJS library loading
- [ ] Verify client-side generation (no server requests for file)

## Reporting
Compile PASS/FAIL/WARN report with screenshots. Note:
- Export generation speed
- PDF quality and theme rendering
- File sizes
- Any missing data in exports
