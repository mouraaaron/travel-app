# Sidebar Design Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the desktop sidebar in `travel-app` (`AppSidebar`) into visual fidelity with Paggo's production sidebar, correcting 4 confirmed Tailwind-class deviations (logo size, corner radius, item height, typography) found by diffing against the production-accurate reference implementation.

**Architecture:** Pure presentational fix — no new components, no new dependencies, no state/logic changes. All edits are Tailwind utility-class changes to existing JSX in a single file. Each task is a self-contained className edit verified with a grep-based before/after check, followed by a manual visual QA pass in the browser.

**Tech Stack:** Next.js 14, React 18, Tailwind CSS 3, `cn()` helper (clsx + tailwind-merge) from `@/lib/utils`.

## Global Constraints

- Production-exact values are copied verbatim from `reference/paggo-university-prototypes/src/components/ui/sidebar.tsx` and `app-sidebar.tsx` (a shadcn prototype repo whose fidelity to real Paggo production was verified via Paper MCP — see inline comments citing Paper canvas nodes). Do not invent values not sourced from this reference.
- Do not touch `travel-app/src/components/layout/app-sidebar.tsx` lines 70-89 (the `lg:hidden` mobile header bar) — it's a structurally different pattern (horizontal top bar, not a rail) and was out of scope for this comparison.
- Do not touch the footer/avatar block (lines 60-68) — content differs intentionally from production (user avatar + sign-out vs. a Settings link) and was not flagged as a design deviation.
- Do not add new npm dependencies (no test-rendering library). This repo's `vitest` setup only covers `src/lib/**` logic tests — there is no `@testing-library/react`/jsdom component-test setup, so verification here uses grep-based className assertions plus manual browser QA, not automated render tests.
- Sidebar width (`248px`), background (`#333131`), and active-item background (`#131316`) are already correct in the current code — do not modify `travel-app/src/styles/paggo-shadcn-vars.css` or the `w-[248px]` class on the `<aside>` (`app-sidebar.tsx:37`).
- **Correction from prior analysis:** the nav-item horizontal gutter (`<nav className="px-3">` at line 41 + Link's own `px-3` at line 50 = 24px total) was previously flagged as misaligned with the header logo's `px-6` (24px) gutter. Recomputing precisely: 12px + 12px = 24px = 24px — **they already match**. This is not a bug and is NOT part of this plan.

---

### Task 1: Fix header logo size

The wordmark image renders at `h-6` (24px tall). Production's `PaggoLogo` wordmark renders at `h-3` (12px tall) inside the same `h-14` header — see `reference/paggo-university-prototypes/src/components/app-sidebar.tsx:290`. At 2x the production size, the logo dominates the header and makes the sparse 2-item nav below look disproportionately small — this is the single biggest contributor to the "desproporção" visual complaint.

**Files:**
- Modify: `travel-app/src/components/layout/app-sidebar.tsx:39`

**Interfaces:**
- Consumes: nothing (isolated JSX attribute change)
- Produces: nothing consumed by later tasks — independent of Task 2

- [ ] **Step 1: Write the failing verification check**

Run (from `travel-app/`):
```bash
grep -n 'className="h-6 w-auto"' src/components/layout/app-sidebar.tsx
```
Expected: one match on line 39 (confirms the oversized class is still present).

- [ ] **Step 2: Edit the logo className**

In `travel-app/src/components/layout/app-sidebar.tsx`, line 39:

Before:
```tsx
          <img src="/paggo-logo-light.svg" alt="Paggo" className="h-6 w-auto" />
```

After:
```tsx
          <img src="/paggo-logo-light.svg" alt="Paggo" className="h-3 w-auto" />
```

- [ ] **Step 3: Run the verification check again**

Run:
```bash
grep -n 'className="h-3 w-auto"' src/components/layout/app-sidebar.tsx
```
Expected: one match on line 39. Also run:
```bash
grep -n 'className="h-6 w-auto"' src/components/layout/app-sidebar.tsx
```
Expected: no matches (confirms the old class is gone).

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/app-sidebar.tsx
git commit -m "fix(sidebar): shrink header logo to production size (h-6 -> h-3)"
```

---

### Task 2: Fix nav-item shape and typography

Desktop nav-item links currently use `rounded-md` (rounded corners), no fixed height (`py-2` on `text-sm`/20px line-height renders ~36px tall), `text-sm` (14px), and `font-medium` (500). Production's `SidebarMenuButton` uses `rounded-none` (Paggo's documented "signature squared chrome" — see `reference/paggo-university-prototypes/src/components/ui/sidebar.tsx:584`, comment: "Sidebar items override to rounded-none for Paggo's signature squared chrome"), a fixed `h-8` (32px) with `py-1.5`, `text-[13px]`, `leading-[18px]`, and `font-normal` (400) (same file, line 584 base classes + line 593 `size: default: "h-8 text-sm"` — the component further narrows to `text-[13px]` via the base class string, which takes precedence as the more specific literal).

**Files:**
- Modify: `travel-app/src/components/layout/app-sidebar.tsx:49-52`

**Interfaces:**
- Consumes: nothing (isolated JSX className change, same file as Task 1 but a different line range — order between Task 1 and Task 2 does not matter)
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Write the failing verification check**

Run (from `travel-app/`):
```bash
grep -n 'rounded-md px-3 py-2 text-sm font-medium' src/components/layout/app-sidebar.tsx
```
Expected: one match (confirms the old shape/typography classes are still present).

- [ ] **Step 2: Edit the nav-item className**

In `travel-app/src/components/layout/app-sidebar.tsx`, lines 49-52:

Before:
```tsx
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
```

After:
```tsx
                className={cn(
                  "flex h-8 items-center gap-3 rounded-none px-3 py-1.5 text-[13px] font-normal leading-[18px] text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
```

- [ ] **Step 3: Run the verification check again**

Run:
```bash
grep -n 'h-8 items-center gap-3 rounded-none px-3 py-1.5 text-\[13px\] font-normal leading-\[18px\]' src/components/layout/app-sidebar.tsx
```
Expected: one match. Also run:
```bash
grep -n 'rounded-md px-3 py-2 text-sm font-medium' src/components/layout/app-sidebar.tsx
```
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/app-sidebar.tsx
git commit -m "fix(sidebar): match nav-item shape and type to production tokens (squared corners, h-8, 13px/normal)"
```

---

### Task 3: Manual visual QA against the running app

Automated checks in Tasks 1-2 only confirm the className strings changed — they don't confirm the page actually renders correctly (Tailwind class typos fail silently: an unrecognized class is just dropped, not an error). This task is a manual render check.

**Files:**
- None modified — verification only.

**Interfaces:**
- Consumes: the edits from Task 1 and Task 2 (must run after both)
- Produces: nothing (terminal task)

- [ ] **Step 1: Start the dev server**

Run (from `travel-app/`):
```bash
npm run dev
```
Expected: server starts on `http://localhost:3000` with no compile errors.

- [ ] **Step 2: Open the app and inspect the sidebar**

Navigate to `http://localhost:3000` (logged in as an employee, so `AppSidebar` renders the 2-item `EMPLOYEE_NAV_ITEMS` nav) at a viewport ≥1024px wide (the `lg:flex` breakpoint — narrower viewports show the mobile header bar instead, which is out of scope).

- [ ] **Step 3: Verify the logo size**

Using browser DevTools, inspect the `<img alt="Paggo">` element in the header. Confirm computed `height` is `12px` (was `24px`).

- [ ] **Step 4: Verify nav-item shape and typography**

Inspect one of the two `<a>` nav-item elements (e.g. "Nova viagem"). Confirm computed styles:
- `border-radius: 0px` (was a rounded value from `rounded-md`)
- `height: 32px` (was ~36px)
- `font-size: 13px` (was `14px`)
- `font-weight: 400` (was `500`)

- [ ] **Step 5: Confirm no regressions**

Confirm: sidebar width is still 248px, sidebar background is still `#333131`, the active nav item ("Nova viagem" on `/`) still shows the `#131316` background, hover states on both items still work, and the footer/avatar block is unchanged.

- [ ] **Step 6: Stop the dev server**

Stop the process (Ctrl+C) once verification is complete. No commit needed for this task (no files changed).

---

## Self-Review Notes

- **Spec coverage:** all 4 confirmed findings (logo size, border-radius, item height, font-size/weight) are each covered by Task 1 or Task 2. The 5th originally-flagged item (nav gutter) was re-verified as already-correct during plan-writing and explicitly excluded (see Global Constraints). The 6th item (idle/active opacity model) was already classified as cosmetic/equivalent, not a defect, and is out of scope.
- **Placeholder scan:** no TBD/TODO — every step has literal before/after code and literal shell commands.
- **Type/consistency check:** N/A — no functions or shared interfaces are introduced across tasks; each task edits an isolated JSX className on independent line ranges of the same file.
