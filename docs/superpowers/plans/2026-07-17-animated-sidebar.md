# Animated Hover-to-Expand Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the always-expanded, fixed-position 248px sidebar with a hover-to-expand animated sidebar (64px collapsed / 248px expanded) that pushes the main content via real flexbox, with no distortion to the responsive admin charts.

**Architecture:** Split the current `AppSidebar` into a `DesktopSidebar` (animated, framer-motion) and a `MobileHeader` (unchanged, extracted verbatim), sharing nav data from a new `nav-items.ts`. A new `AuthenticatedShell` composes both plus `main` inside a real flex row (sidebar as flex item, `main` as `flex-1`), replacing the duplicated markup in `(app)/layout.tsx` and `admin/layout.tsx`.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, `framer-motion` (already a dependency, no version bump needed), TypeScript strict mode.

## Global Constraints

- No new dependencies — `framer-motion` `^12.42.2` is already installed and used elsewhere in the codebase (e.g. `src/components/admin/onsite-week-detail.tsx`).
- Collapsed sidebar width: `64px`. Expanded width: `248px` (same value as today's fixed width — do not change).
- Width/opacity transitions: `{ duration: 0.2, ease: "easeInOut" }`, but `duration: 0` when `useReducedMotion()` reports a reduced-motion preference (matches the existing convention in `onsite-week-detail.tsx`).
- Mobile (`< lg` breakpoint) is entirely out of scope — the mobile header's markup and behavior must stay byte-for-byte identical to today.
- No new automated tests: this codebase has no component-render test setup (`vitest.config.ts` uses `environment: "node"`, no `@testing-library/react`). Verification is `npx tsc --noEmit`, `npm run lint`, and manual browser checks via `npm run dev`, matching the precedent in `docs/superpowers/specs/2026-07-16-sidebar-signout-style-design.md`.
- Do not modify `src/components/layout/sign-out-button.tsx` — it's consumed as-is.
- Spec reference: `docs/superpowers/specs/2026-07-17-animated-sidebar-design.md`.

---

## Task 1: Shared nav item data

**Files:**
- Create: `src/components/layout/nav-items.ts`

**Interfaces:**
- Produces: `NavItem` interface (`{ href: string; label: string; icon: LucideIcon }`), `PERSONAL_NAV_ITEMS: NavItem[]`, `ADMIN_NAV_ITEMS: NavItem[]` — consumed by Task 2 (`MobileHeader`) and Task 3 (`DesktopSidebar`).

- [ ] **Step 1: Create the shared nav data file**

```ts
import type { LucideIcon } from "lucide-react";
import {
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Plane,
  Settings,
  Users,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const PERSONAL_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Nova viagem", icon: Plane },
  { href: "/requests", label: "Minhas solicitações", icon: ClipboardList },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Painel", icon: LayoutDashboard },
  { href: "/admin/requests", label: "Solicitações", icon: ClipboardCheck },
  { href: "/admin/onsite-weeks", label: "Semanas Presenciais", icon: CalendarRange },
  { href: "/admin/employees", label: "Funcionários", icon: Users },
  { href: "/admin/reports", label: "Relatórios", icon: FileText },
  { href: "/admin/settings", label: "Configurações", icon: Settings },
];
```

This is the exact data that lives in today's `src/components/layout/app-sidebar.tsx` (lines 19-37), moved verbatim so both `MobileHeader` and `DesktopSidebar` can import it without one depending on the other.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors (the file isn't imported anywhere yet, so this only checks the file's own syntax/types).

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/nav-items.ts
git commit -m "Extract sidebar nav item data into its own module"
```

---

## Task 2: `MobileHeader` (verbatim extraction, no behavior change)

**Files:**
- Create: `src/components/layout/mobile-header.tsx`

**Interfaces:**
- Consumes: `NavItem`, `PERSONAL_NAV_ITEMS`, `ADMIN_NAV_ITEMS` from `./nav-items` (Task 1).
- Produces: `MobileHeader({ fullName, role }: { fullName: string; role: "employee" | "admin" })` — consumed by Task 4 (`AuthenticatedShell`).

- [ ] **Step 1: Create the mobile header component**

This is the `<header lg:hidden>` block from today's `app-sidebar.tsx` (lines 92-111), extracted with no changes to markup, classes, or behavior:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, initialsFromName } from "@/lib/utils";
import { ADMIN_NAV_ITEMS, PERSONAL_NAV_ITEMS } from "./nav-items";

export function MobileHeader({ fullName, role }: { fullName: string; role: "employee" | "admin" }) {
  const pathname = usePathname();
  const initials = initialsFromName(fullName);
  const isAdmin = role === "admin";
  const mobileNavItems = isAdmin ? [...ADMIN_NAV_ITEMS, ...PERSONAL_NAV_ITEMS] : PERSONAL_NAV_ITEMS;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground lg:hidden">
      <img src="/paggo-icon.svg" alt="Paggo" className="h-6 w-6" />
      <nav className="flex items-center gap-4">
        {mobileNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "text-sm font-medium text-sidebar-foreground/70",
              pathname === item.href && "text-sidebar-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {initials}
      </span>
    </header>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/mobile-header.tsx
git commit -m "Extract MobileHeader as its own component"
```

---

## Task 3: `DesktopSidebar` (animated hover-to-expand)

**Files:**
- Create: `src/components/layout/desktop-sidebar.tsx`

**Interfaces:**
- Consumes: `NavItem`, `ADMIN_NAV_ITEMS`, `PERSONAL_NAV_ITEMS` from `./nav-items` (Task 1); `SignOutButton` from `./sign-out-button` (unchanged, existing file); `cn`, `initialsFromName` from `@/lib/utils`.
- Produces: `DesktopSidebar({ fullName, role }: { fullName: string; role: "employee" | "admin" })` — consumed by Task 4 (`AuthenticatedShell`).

- [ ] **Step 1: Create the animated sidebar component**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn, initialsFromName } from "@/lib/utils";
import { ADMIN_NAV_ITEMS, PERSONAL_NAV_ITEMS, type NavItem } from "./nav-items";
import { SignOutButton } from "./sign-out-button";

export function DesktopSidebar({ fullName, role }: { fullName: string; role: "employee" | "admin" }) {
  const pathname = usePathname();
  const initials = initialsFromName(fullName);
  const isAdmin = role === "admin";
  const [open, setOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const transition = { duration: shouldReduceMotion ? 0 : 0.2, ease: "easeInOut" as const };

  function renderLink(item: NavItem) {
    const active = pathname === item.href;
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex h-8 items-center gap-3 rounded-none px-3 py-1.5 text-[13px] font-normal leading-[18px] text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          active && "bg-sidebar-accent text-sidebar-accent-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <motion.span animate={{ opacity: open ? 1 : 0 }} transition={transition} className="whitespace-nowrap">
          {item.label}
        </motion.span>
      </Link>
    );
  }

  return (
    <motion.aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      animate={{ width: open ? 248 : 64 }}
      transition={transition}
      className="sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground lg:flex"
    >
      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
        <img src="/paggo-icon.svg" alt="Paggo" className="h-6 w-6 shrink-0" />
        <AnimatePresence>
          {open && (
            <motion.img
              key="full-logo"
              src="/paggo-logo-light.svg"
              alt="Paggo"
              className="h-[18px] w-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition}
            />
          )}
        </AnimatePresence>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {isAdmin ? (
          <>
            {ADMIN_NAV_ITEMS.map(renderLink)}
            <motion.p
              animate={{ opacity: open ? 1 : 0 }}
              transition={transition}
              className="mt-4 whitespace-nowrap px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/40"
            >
              Pessoal
            </motion.p>
            {PERSONAL_NAV_ITEMS.map(renderLink)}
          </>
        ) : (
          PERSONAL_NAV_ITEMS.map(renderLink)
        )}
      </nav>
      <div className="flex flex-col gap-3 border-t border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </span>
          <motion.span
            animate={{ opacity: open ? 1 : 0 }}
            transition={transition}
            style={{ pointerEvents: open ? "auto" : "none" }}
            className="whitespace-nowrap text-sm font-medium"
          >
            {fullName}
          </motion.span>
        </div>
        <motion.div
          animate={{ opacity: open ? 1 : 0 }}
          transition={transition}
          style={{ pointerEvents: open ? "auto" : "none" }}
        >
          <SignOutButton />
        </motion.div>
      </div>
    </motion.aside>
  );
}
```

Notes for the implementer, so the reasoning isn't a mystery when reading this in isolation:
- `overflow-hidden` lives **only** on the outer `motion.aside`, not on `nav` or on individual `Link`s. That's what makes the collapse work: labels keep their natural (un-shrunk) width and just get visually clipped at the 64px boundary while `open` is `false`, instead of wrapping or squeezing the icon. Adding `overflow-hidden` at a deeper level would clip icons too.
- Padding on the logo row and footer row is `px-4` (not the `px-6` you might expect from a quick copy-paste) specifically so the icon (24px) / avatar (32px) stay fully visible inside the 64px collapsed width — `px-6` would push them past the 64px boundary and get them clipped in half.
- The full logo image is conditionally mounted (`{open && ...}` inside `AnimatePresence`), not just faded via opacity, so it contributes zero width to the row when collapsed.
- `pointerEvents: "none"` on the name/sign-out wrapper prevents an invisible "Sair" button from swallowing clicks while collapsed.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/desktop-sidebar.tsx
git commit -m "Add animated hover-to-expand DesktopSidebar"
```

---

## Task 4: `AuthenticatedShell` (de-duplicates the two layouts)

**Files:**
- Create: `src/components/layout/authenticated-shell.tsx`

**Interfaces:**
- Consumes: `DesktopSidebar` from `./desktop-sidebar` (Task 3), `MobileHeader` from `./mobile-header` (Task 2).
- Produces: `AuthenticatedShell({ fullName, role, children }: { fullName: string; role: "employee" | "admin"; children: React.ReactNode })` — consumed by Task 5 (both layout files).

- [ ] **Step 1: Create the shell component**

No `"use client"` directive here — it has no hooks or event handlers of its own, so it stays a Server Component (both `DesktopSidebar` and `MobileHeader` are independently marked `"use client"`, which is where the client boundary actually needs to be).

```tsx
import { DesktopSidebar } from "./desktop-sidebar";
import { MobileHeader } from "./mobile-header";

export function AuthenticatedShell({
  fullName,
  role,
  children,
}: {
  fullName: string;
  role: "employee" | "admin";
  children: React.ReactNode;
}) {
  return (
    <>
      <MobileHeader fullName={fullName} role={role} />
      <div className="flex">
        <DesktopSidebar fullName={fullName} role={role} />
        <main className="min-h-screen min-w-0 flex-1">
          <div className="px-6 pb-16 pt-8">{children}</div>
        </main>
      </div>
    </>
  );
}
```

The `main` no longer needs `lg:pl-[248px]` — its width is now a natural consequence of the flex row (`DesktopSidebar` takes its animated width, `main` takes `flex-1` for the rest), which is the whole point of switching from overlay-padding to real push.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/authenticated-shell.tsx
git commit -m "Add AuthenticatedShell composing DesktopSidebar, MobileHeader, and main"
```

---

## Task 5: Wire up the layouts, remove the old sidebar, verify end-to-end

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/admin/layout.tsx`
- Delete: `src/components/layout/app-sidebar.tsx`

**Interfaces:**
- Consumes: `AuthenticatedShell` from `@/components/layout/authenticated-shell` (Task 4).

- [ ] **Step 1: Update `src/app/(app)/layout.tsx`**

Replace the whole file with:

```tsx
import { redirect } from "next/navigation";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { getCurrentProfile } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  return (
    <AuthenticatedShell fullName={profile.fullName} role={profile.role}>
      {children}
    </AuthenticatedShell>
  );
}
```

- [ ] **Step 2: Update `src/app/admin/layout.tsx`**

Replace the whole file with:

```tsx
import { redirect } from "next/navigation";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { getCurrentProfile } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  if (profile.role !== "admin") {
    redirect("/");
  }

  return (
    <AuthenticatedShell fullName={profile.fullName} role="admin">
      {children}
    </AuthenticatedShell>
  );
}
```

- [ ] **Step 3: Delete the old sidebar component**

```bash
rm src/components/layout/app-sidebar.tsx
```

- [ ] **Step 4: Confirm no remaining references**

Run: `grep -rn "app-sidebar\|AppSidebar" src`
Expected: no output (only unrelated copies under `.claude/worktrees/` and `.worktrees/` may still reference it — those are separate worktrees, out of scope).

- [ ] **Step 5: Type-check and lint the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Manual browser verification**

Run: `npm run dev`, then in a browser:

1. Log in as an employee, land on `/`. Desktop viewport (≥1024px wide): sidebar shows as a 64px icon-only rail. Hover over it — it smoothly expands to 248px, showing "Nova viagem" / "Minhas solicitações" labels, the full Paggo wordmark, and (at the bottom) your name + "Sair". Move the mouse away — it collapses back to 64px, all labels fading out.
2. Log in as an admin, visit `/admin`. Same hover behavior, plus the "Pessoal" section divider fades in/out with the rest of the personal nav items.
3. On `/admin`, watch the spend chart and the breakdown charts (bar/pie) while hovering the sidebar in and out. They should resize smoothly with the available width — no stretching, no broken aspect ratio, no console errors.
4. With the sidebar expanded (hover), click "Sair". Confirm it signs out and redirects to `/login`.
5. Resize the browser below 1024px (or use device toolbar). Confirm the desktop sidebar disappears entirely and the mobile top header bar looks and behaves exactly as it did before this change (same links, same avatar, no hover-expand behavior).
6. With OS-level "reduce motion" enabled (if convenient to test), confirm the sidebar still expands/collapses on hover but instantly, without the animated transition.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/layout.tsx" src/app/admin/layout.tsx
git rm src/components/layout/app-sidebar.tsx
git commit -m "Wire AuthenticatedShell into app and admin layouts, remove old AppSidebar"
```
