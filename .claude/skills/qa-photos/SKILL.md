---
name: qa-photos
description: Automated QA testing for photo upload, compression, lightbox, reordering, and offline photo handling
user-invocable: true
---

# QA: Photo Management

You are a QA engineer testing GroundWork's photo features. Use Chrome MCP tools to verify upload, compression, lightbox, reordering, and offline photo handling.

## Pre-flight
1. Get tab context with `tabs_context_mcp` (createIfEmpty: true)
2. Navigate to `http://localhost:5173/dashboard` (must be authenticated)
3. Open a create or edit log dialog

## Test Checklist

### 1. Photo Upload (Online)
- [ ] Drag-and-drop zone visible and styled
- [ ] File input (click to browse) works
- [ ] Camera input available on mobile (capture attribute)
- [ ] Accepted file types: images only
- [ ] Photo compression occurs (target ~600KB)
- [ ] Preview thumbnails appear after selection
- [ ] Multiple photos can be added (up to tier limit)
- [ ] Max photo limit enforced — error toast if exceeded
- [ ] Photos upload to R2 on form submit
- [ ] Upload progress/feedback visible

### 2. Photo Reordering
- [ ] Drag-reorder thumbnails in create/edit dialog
- [ ] Order preserved after submit
- [ ] Visual feedback during drag

### 3. Photo Removal
- [ ] Remove button on individual photo thumbnails
- [ ] Photo removed from preview immediately
- [ ] Removed photo not included in submission

### 4. Photo Lightbox
- [ ] Click photo in log detail — lightbox opens fullscreen
- [ ] Photo displays at full resolution
- [ ] Left/right arrow navigation works
- [ ] Keyboard navigation (←/→ arrow keys)
- [ ] Swipe gestures on mobile (left/right, 50px threshold)
- [ ] Escape key closes lightbox
- [ ] Close button (X) works
- [ ] Slide transition animation with direction

### 5. Photo in Log Cards
- [ ] Cover photo displays as card thumbnail
- [ ] Photo count badge visible on card
- [ ] Hover zoom effect on thumbnail (if implemented)

### 6. Offline Photo Upload
- [ ] When offline, offline uploader component appears
- [ ] Drag-drop and file input still work offline
- [ ] Photos compressed to base64 data URLs
- [ ] "Saved locally" notice displays
- [ ] Photos stored in local storage
- [ ] Processing spinner shows during compression
- [ ] Reorder and remove work offline
- [ ] Photos sync to R2 when reconnected

### 7. Console & Network
- [ ] Check console for compression errors
- [ ] Check network for R2 upload requests (should succeed)
- [ ] Verify no CORS issues with R2

## Reporting
Compile PASS/FAIL/WARN report with screenshots. Pay special attention to:
- Compression quality (are photos too blurry?)
- Upload speed
- Mobile camera capture behavior
- Offline-to-online sync reliability
