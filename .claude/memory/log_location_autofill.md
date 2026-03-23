# Log Location Auto-fill from Site (March 23, 2026)

## Behavior
- When creating a new log within a selected site, the site's location and GPS coordinates auto-fill in the Location field
- When editing an existing log that has no location but its site does, location auto-fills from site
- Auto-filled location can be changed before saving
- Uses `didAutoFillRef` ref to ensure auto-fill happens exactly once per dialog open

## Implementation
- `NewLogDialog.tsx`: useEffect with `didAutoFillRef` watches for `open + initialSiteName + sites` — fills location/coords from matching site
- `EditLogDialog.tsx`: separate useEffect watches for `open + sites` — if log has no location but site does, fills from site
- `locationFromSite` state tracks whether current location came from site (for clearing on site change)

## Files
- `src/pages/dashboard/_components/NewLogDialog.tsx`
- `src/pages/dashboard/_components/EditLogDialog.tsx`
