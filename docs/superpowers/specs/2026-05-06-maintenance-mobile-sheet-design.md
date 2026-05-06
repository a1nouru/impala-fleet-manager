# Maintenance Mobile Sheet Design

## Goal

Make the Schedule Maintenance form usable on mobile by replacing the cramped, nested-scroll modal behavior with a full-screen mobile sheet while preserving the existing desktop modal workflow.

## Approved Direction

Use a full-screen sheet on mobile. The sheet should fill the viewport, keep the header visible at the top, keep the primary actions visible at the bottom, and make the form body the only vertical scroll region. Desktop should remain a centered modal with a clean max height.

## UI Behavior

- Mobile dialog content uses the full viewport width and height with no rounded desktop frame.
- Header contains the title, description, and existing close affordance.
- Form content scrolls independently between the header and footer.
- Footer remains visible and contains Cancel, Reset, and Submit actions.
- Buttons are touch-friendly and stack or wrap safely on narrow screens.
- Inventory cards use mobile-friendly spacing and larger quantity controls.
- Nested scroll traps are avoided by letting the inventory list participate in the main form scroll on mobile.

## Components Affected

- `app/dashboard/maintenance/page.tsx`
  - Schedule Maintenance dialog layout
  - Form scroll container
  - Inventory list height and card layout
  - Dialog footer action layout

No API, database, auth, or Supabase changes are required.

## Validation

- Verify the form opens on mobile and can scroll from Vehicle through the required-fields note.
- Verify Cancel, Reset, and Submit remain reachable at the bottom.
- Verify the inventory section can show multiple items without trapping the page scroll.
- Verify desktop still opens a centered modal and remains scrollable.
