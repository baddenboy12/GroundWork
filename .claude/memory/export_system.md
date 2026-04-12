---
name: Export system (PDF + Excel)
description: PDF and Excel export architecture, themes, page layout, native mobile save flow
type: feature
---

## PDF Export (`src/pages/dashboard/_lib/export.ts`)

**Architecture**: Uses jsPDF to generate styled PDF reports. Two export types:
- **Single-site**: One site's logs with cover page showing site name
- **Multi-site (global)**: All selected sites grouped by site name

**Cover page** (drawCoverDark):
- Dark background with left accent strip
- Title shown once (no redundant label)
- Date top-right, period + category inline below title
- Stats box with category-colored bars
- "GroundWork" branding bottom-right

**Entry pages**:
- Running header: report title (left) + generated date (right)
- Site divider with orange accent bar, site name, entry count
- Entry cards with blue/red/orange left border by category
- Two-column notes layout for excessively long entries (detected by line count threshold)
- Photo grid below each entry with paged overflow

**Critical page-break rules**:
- First entry in each site section NEVER page-breaks away from its divider (`ei > 0` guard)
- Overflow entries use a `while (y > pageH - 14)` loop to add pages
- Photos are rendered with `renderPhotoRowsPaged` which handles cross-page photo grids

**Photo handling**:
- Photos fetched via proxy (`/photo-proxy?url=...`) and cached as data URLs
- `fetchPhotoInfo` returns { dataUrl, ar (aspect ratio) }
- Photos are pre-fetched in parallel before PDF generation
- Photo rows calculated by `calcPhotoRows` with uniform height scaling

## Excel Export (ExcelJS)

**Architecture**: ExcelJS workbook with single sheet per export. Entries as sections with:
- Category-colored title bars (accent color matches PDF theme)
- Alternating row shading (light slate / white)
- Label column (col A) with slate background
- Hair borders between rows
- Photo grid: up to 4 photos per row in columns B-E
- Photos embedded as images with uniform height scaling

## Native Mobile Export (Capacitor)

**Save flow** (`nativeSaveFile` function):
1. Convert blob to base64 using chunked approach (64KB chunks to avoid O(n^2) string concat)
2. Write to Capacitor `Directory.Cache` via `Filesystem.writeFile`
3. Open system share sheet via `Share.share({ url: result.uri })`
4. User can save/send from share sheet

**Performance**: ~5 seconds for a 9-entry report with photos (was 40s before chunked base64 fix)

**Platform detection**: `isNative` from `@/lib/platform` — true when running in Capacitor WebView

## Theme Constants
- Cover: dark navy (#1A2332 area), accent orange, white titles
- Entry borders: category-colored (red=incident, blue=inspection, orange=maintenance)
- Footer: "Confidential field report" left, page numbers right
