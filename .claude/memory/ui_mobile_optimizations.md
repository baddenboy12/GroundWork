# Mobile UI Optimizations (March 2026 Session)

## Viewport
- Meta viewport is `width=768, viewport-fit=cover` — everything renders at ~half size on phones (~375px)
- This means all touch targets need to be roughly double normal size to feel right on mobile
- Use inline `style={{ width: X, height: X }}` for Lucide icons when Tailwind classes don't take effect (SVG attribute override)

## Dashboard Layout Changes
- **Navbar**: User menu button is absolutely positioned (`absolute right-4 top-1/2 -translate-y-1/2`) so resizing it doesn't affect the left side (logo, Sites button)
- **Sub-bar**: Two rows — top has Sites button + info icon, bottom has Back button + Filters + Export
- **FAB**: Floating `+` button for new log entries, positioned `bottom-36 right-12`, `w-20 h-20`
- Sub-bar and FAB hidden when showing Stats, Integrations, or Billing views

## User Menu Button
- Warm brown pill (`hsl(30 12% 12%)`) with border, `h-[4.5rem]` rounded-full
- User icon (no bubble background) + display name
- Diagonal subscription tier ribbon on top-right corner (amber for Business, blue for Starter)
- `focus:outline-none` + blur on dropdown close to prevent persistent focus ring
- Dropdown menu: `rounded-3xl`, warm brown background, staggered slide-in animations, `text-xl` items

## Site List Panel (Speech Bubble)
- Warm brown gradient: `linear-gradient(to bottom, hsl(30 14% 15%) 0%, hsl(30 12% 10%) 80px)`
- Diamond notch at top pointing toward Sites button area
- Panel width: 360px, positioned `left: 75px`, `top: calc(100% + 22px)`
- `rounded-24px` corners, `border: 1px solid hsl(var(--border))`
- Spring animation: `stiffness: 500, damping: 30, mass: 0.5`
- 3-dot menu inside uses `onOpenChange` tracking + 200ms grace period to prevent site list from closing
- Site rows: `py-5`, `text-lg` names, no index numbers, `w-12 h-12` menu buttons
- Edit/delete dropdown: dark brown `hsl(30 12% 8%)`, `rounded-2xl`

## Filter Panel
- Single "Filters" button opens a dropdown with search, category chips, and date range
- Category as tappable chip buttons instead of select dropdown
- All inputs `h-14 text-lg rounded-xl` for touch
- Click-outside closes panel (separate refs for button vs dropdown)

## Log Entry Cards
- Uniform height with `flex flex-col` + `mt-auto` footer
- Title `text-xl`, excerpt `text-lg`, footer `text-base`
- Site name truncated with `overflow-hidden` (no wrapping)
- Footer: date left, author + photos right (absolute `bottom-1.5`)
- `pb-12` on content area for spacing above footer
- `whileTap={{ scale: 0.96 }}` press animation

## Log Detail Dialog
- Photo cascade stack with tilted cards behind, spring swipe animations, tap-to-zoom
- Zoom overlay rendered via `createPortal(document.body)` to prevent click-through
- Close animation: CSS keyframes `log-panel-out 0.25s`, managed via `closing` state + `setTimeout(250)`
- 3-dot menu (manual div, not Radix) for edit/delete — avoids mobile repositioning
- Menu uses `AnimatePresence` for open/close animation
- Panel click handler excludes `[data-menu-trigger]` to prevent immediate close
- Backdrop click closes menu first, then entry on second click
- X close button: `w-16 h-16` with `w-8 h-8` icon
- Photo nav arrows: `p-5` with 32px icons (inline style), counter `text-2xl`

## Dialog Positioning
- New Log, Export, Create Site dialogs all positioned `top-[15%] translate-y-0`
- Export dialogs: `onInteractOutside` prevented, must use Cancel/X to close
- All dialogs: `onOpenAutoFocus` prevented to avoid keyboard popup on mobile

## Inline Views (No Route Navigation)
- Statistics, Integrations, and Billing render inline in dashboard (not separate routes)
- Keeps navbar visible at all times
- Each has `onBack` callback, spring entrance animations
- `BillingInner` exported from billing/page.tsx with optional `onBack` prop
- `IntegrationsView` and `BillingView` wrapper components in dashboard/_components/

## Offline Photo Caching
- Background sync delay reduced from 3s to 1s
- Dashboard and LogList eagerly pre-cache visible photo URLs via `caches.match()` + `fetch()`
- Photos served from R2 public URLs (not signed/temporary)
- Service worker cache-first strategy for R2 photos

## Animations Used
- Entry open: CSS `log-panel-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)`
- Entry close: CSS `log-panel-out 0.25s cubic-bezier(0.4, 0, 0.2, 1)`
- Photo cascade: `type: "spring", stiffness: 300, damping: 25, mass: 0.8`
- Site list: `type: "spring", stiffness: 500, damping: 30, mass: 0.5`
- New log dialog: `scale: 0.85 → 1`, staggered form fields
- All buttons: `active:scale-95` or `active:scale-90` press feedback

---

## March 22 Session — Dashboard & Dialog Overhaul

### Dashboard Buttons
- Filters, Export, Sites buttons: scaled up with `transform: scale()`, metallic gradient backgrounds (`linear-gradient` warm browns), increased icon/text sizes
- Info icon: enlarged with bigger clickable area
- FAB (+ button): metallic shine gradient, thicker plus icon, slightly bigger

### Dialog/Window Improvements
- **Edit Site Dialog**: `w-[98%]`, `rounded-3xl`, larger close button with lighter background + click animation, prevent auto-focus on site name, prevent outside-click close, positioned `top-[5%]`
- **Create Site Dialog**: same treatment as Edit Site
- **Edit Log Entry Dialog**: `rounded-3xl`, all fields scaled up (`!text-[24px]`, `h-[3.8rem]`), notes textarea in MS Reference Sans Serif font, photo thumbnails in 4-column grid, larger close button with animation, prevent outside-click close, positioned `top-[12%]`
- **Create Log Entry Dialog**: mirrors Edit Log Entry changes, positioned `top-[5%]`
- **Export Logs Dialog**: enlarged all elements (tabs, format cards, option rows, buttons), `rounded-3xl`, larger close button, positioned `top-[5%]`
  - Theme picker: converted from Radix Popover to absolute dropdown
  - Sites/Category dropdowns: converted from inline collapsible to floating absolute dropdowns with `overflow: visible` toggle for mobile touch scrolling
  - Title row moved above Theme row
  - Entries selector: floating scrollable list
  - Category: full-width clickable button row

### LocationPicker Enhancements
- Added `inputClassName` prop for per-dialog font size control
- Added `showMapByDefault` prop — Edit Log sets false to prevent auto-opening map
- Dismissing map no longer erases coordinates (keeps coords in state, only hides map visually)
- Map height increased to 440px via inline style
- All text scaled up: header text-lg, coords text-base, hint text-base
- GPS button and dismiss button enlarged

### Photo Drag-to-Reorder
- New `useDragReorder` hook (`src/pages/dashboard/_lib/use-drag-reorder.ts`)
  - Pointer Events API for cross-platform drag
  - Long-press threshold: 300ms touch, 150ms mouse
  - `elementsFromPoint()` to detect target grid cell
  - `arrayMove` utility for reordering
  - Swap cooldown (200ms) for animation breathing room
  - `swappedIndex` state for pulse animation on displaced items
  - Prevents scroll during drag via `touchmove` listener with `passive: false`
- PhotoUploader and OfflinePhotoUploader use `LayoutGroup` + `motion.div` with `layout` and `layoutId` for smooth swap animations
- Take Photo / Browse Files buttons: spring tap/hover animations

### Log Detail View
- 3-dot menu repositioned (further down and left)
- Notes: line-clamp-12 (more visible rows)
- Edit/Delete menu items: visible clickable areas with rounded backgrounds, spring tap animation, larger text
- Content font changed to Consolas (log cards and detail view)

### Site List Dropdown (Edit Log Entry)
- Custom dropdown replacing Radix Select — button with chevron, absolute positioned list
- Removed search field from list
- Click animation on button (spring scale)
- Category-style open/close animations, rounded dropdown menu
- Each site item: visible clickable area, rounded background, spring tap animation
- Closes on outside click (document mousedown listener)
- Fixed width dropdown (`min-w-[340px]`) independent of button width

### User Menu Updates
- Menu items: darker metallic gradient backgrounds, spring tap animations, spacing between items
- Sign out button: dark brown-red color
- Removed "Version" text, increased version number size, iterated to v240

### Background Color
- Changed from pure black to very dark warm brown: `hsl(25 12% 4%)`

### Edit Name Dialog
- Positioned slightly above center (`top-[40%]`)
- Prevent auto-focus on display name field
- Increased text sizes

### Statistics Page
- New "Top Author" stat card (teal) showing most active author and log count
- Required Convex backend change to `getStats` query — added `topAuthor` field

### Integrations Page
- API Keys section: enlarged text, larger buttons, removed duplicate Generate Key button
- Webhooks section: enlarged text, larger buttons, removed duplicate Add Webhook button
- API Docs page: enlarged text, forced line breaks between two-sentence descriptions

### Key Technical Patterns
- `transform: scale()` on wrapper divs for uniform visual scaling without affecting layout
- `!important` CSS (`!text-[26px]`) to override component-level styles
- `overflow: visible` toggle on dialog content to enable absolute dropdowns to float outside
- Document-level `mousedown` listeners for outside-click-to-close (mobile-friendly, no touchstart)
- Inline `style={{ fontSize: "Xpx" }}` when Tailwind classes get overridden by component defaults
- Portal-free dropdown approach (absolute positioning + overflow toggle) for touch event compatibility
