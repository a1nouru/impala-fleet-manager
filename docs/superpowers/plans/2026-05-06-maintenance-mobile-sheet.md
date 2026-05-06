# Maintenance Mobile Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Schedule Maintenance form fully usable on phones by using a full-screen mobile sheet with reachable actions and natural scrolling.

**Architecture:** Keep the existing `Dialog` and form state in `app/dashboard/maintenance/page.tsx`. Use responsive Tailwind classes so mobile gets a full-screen sheet and desktop keeps the centered modal.

**Tech Stack:** Next.js, React, TypeScript, shadcn/Radix Dialog, Tailwind CSS.

---

### Task 1: Responsive Dialog Shell

**Files:**
- Modify: `app/dashboard/maintenance/page.tsx`

- [ ] **Step 1: Replace the schedule dialog content classes**

Set `DialogContent` to full-screen on mobile and centered on desktop:

```tsx
<DialogContent className="inset-0 top-0 left-0 h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 p-0 sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[92vh] sm:w-[calc(100vw-2rem)] sm:max-w-[700px] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:gap-4 sm:rounded-lg sm:border sm:p-6 flex flex-col">
```

- [ ] **Step 2: Make the header stable**

Wrap the existing `DialogHeader` with mobile padding and bottom border:

```tsx
<DialogHeader className="shrink-0 border-b px-4 py-4 pr-12 text-left sm:border-0 sm:p-0 sm:pr-0">
```

- [ ] **Step 3: Make the form body the scroll container**

Replace the outer `ScrollArea` class:

```tsx
<ScrollArea className="min-h-0 flex-1 overflow-y-auto">
```

and add mobile padding to the inner form:

```tsx
<div className="grid gap-4 px-4 py-4 pb-6 sm:px-1 sm:py-4">
```

### Task 2: Mobile-Friendly Inventory Section

**Files:**
- Modify: `app/dashboard/maintenance/page.tsx`

- [ ] **Step 1: Remove the nested mobile scroll trap**

Use natural height on mobile and fixed height only on desktop:

```tsx
<ScrollArea className="max-h-none rounded-md border p-3 sm:h-96 sm:p-4">
```

- [ ] **Step 2: Improve inventory card layout**

Change each inventory card and header row to wrap cleanly on mobile:

```tsx
<div key={itemName} className="rounded-lg border p-3 space-y-3">
  <div className="flex items-start gap-3">
    <div className="min-w-0 flex-1">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
```

- [ ] **Step 3: Increase quantity controls**

Set quantity controls to touch-friendly sizes:

```tsx
className="h-10 w-10 p-0 sm:h-6 sm:w-6"
className="h-10 w-20 text-center text-sm sm:h-6 sm:w-16 sm:text-xs"
```

### Task 3: Sticky Mobile Footer Actions

**Files:**
- Modify: `app/dashboard/maintenance/page.tsx`

- [ ] **Step 1: Make dialog footer visible**

Update the schedule dialog footer:

```tsx
<DialogFooter className="shrink-0 border-t bg-background px-4 py-3 sm:border-0 sm:p-0">
```

- [ ] **Step 2: Make actions responsive and touch-friendly**

Update the action wrapper and buttons:

```tsx
<div className="grid w-full grid-cols-3 gap-2 sm:flex sm:justify-end">
```

Each footer button gets:

```tsx
className="h-11 sm:h-10"
```

The submit button keeps:

```tsx
className="h-11 bg-black text-white hover:bg-gray-800 sm:h-10"
```

### Task 4: Verification

**Files:**
- Verify: `app/dashboard/maintenance/page.tsx`

- [ ] **Step 1: Run lint/type checks available for the project**

Run:

```bash
npm run lint
```

Expected: no new lint errors from `app/dashboard/maintenance/page.tsx`.

- [ ] **Step 2: Check IDE diagnostics**

Use the linter diagnostics for `app/dashboard/maintenance/page.tsx`.

- [ ] **Step 3: Manual mobile verification**

Open the maintenance page at a narrow viewport and confirm:

- The form opens full-screen on mobile.
- The form scrolls from top to bottom.
- Inventory quantity controls are tappable.
- Footer actions remain reachable.
- Desktop still uses a centered modal.
