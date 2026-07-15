# Admin Self-Booking Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make it visible in the UI that an admin can create and track travel requests for themselves — the backend already allows this (no role check blocks it), but the admin sidebar currently omits "Nova viagem" / "Minhas solicitações", hiding the possibility. No new access restriction is introduced by this plan.

**Architecture:** `AppSidebar` (`src/components/layout/app-sidebar.tsx`) gains a second, labeled nav section for admins containing the two personal items, reusing the existing item-array + `.map()` pattern. `src/app/(app)/requests/page.tsx` gets an explicit `.eq("employee_id", ...)` filter so "Minhas solicitações" is scoped to the current user for every role — today it only works correctly for employees by accident, because RLS restricts what they can read; the same RLS policy grants admins read access to every request in the org, so without this filter an admin would see everyone's requests under a "my requests" heading.

**Tech Stack:** Next.js 14 App Router (Server Components), TypeScript, Supabase (`@supabase/ssr`), Tailwind, `lucide-react` icons.

## Global Constraints

- No new role/permission checks anywhere — this plan only changes navigation visibility and query scoping, never what a role is *allowed* to do (per explicit user instruction: don't add blockers).
- This repo has no React rendering test setup (only `vitest` unit tests on `src/lib/*`, per `travel-app/docs/superpowers/specs/2026-07-13-admin-employees-directory-design.md:88-92`) — verification for both tasks is `npx tsc --noEmit`, `npm run lint`, `npm test` (regression), plus manual click-through in the browser, not new unit tests.
- Match existing code style: plain arrays of nav items + `.map()`, `cn()` for conditional classes, Tailwind utility classes matching what's already in the file — no new UI library or abstraction layer.

---

### Task 1: Personal nav section for admins in `AppSidebar`

**Files:**
- Modify: `travel-app/src/components/layout/app-sidebar.tsx` (entire file — see full replacement below)

**Interfaces:**
- Consumes: nothing new — same `AppSidebar({ fullName, role }: { fullName: string; role: "employee" | "admin" })` signature, called from `travel-app/src/app/(app)/layout.tsx:13` and `travel-app/src/app/admin/layout.tsx:16` (both unchanged).
- Produces: nothing consumed by Task 2 — the two tasks are independent and can be done in either order.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `travel-app/src/components/layout/app-sidebar.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  Plane,
  Settings,
  Users,
} from "lucide-react";
import { cn, initialsFromName } from "@/lib/utils";
import { SignOutButton } from "./sign-out-button";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const PERSONAL_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Nova viagem", icon: Plane },
  { href: "/requests", label: "Minhas solicitações", icon: ClipboardList },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Painel", icon: LayoutDashboard },
  { href: "/admin/requests", label: "Solicitações", icon: ClipboardCheck },
  { href: "/admin/employees", label: "Funcionários", icon: Users },
  { href: "/admin/reports", label: "Relatórios", icon: FileText },
  { href: "/admin/settings", label: "Configurações", icon: Settings },
];

export function AppSidebar({ fullName, role }: { fullName: string; role: "employee" | "admin" }) {
  const pathname = usePathname();
  const initials = initialsFromName(fullName);
  const isAdmin = role === "admin";
  const mobileNavItems = isAdmin ? [...ADMIN_NAV_ITEMS, ...PERSONAL_NAV_ITEMS] : PERSONAL_NAV_ITEMS;

  function renderDesktopLink(item: NavItem) {
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
        <Icon className="h-4 w-4" />
        {item.label}
      </Link>
    );
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-14 items-center px-6">
          <img src="/paggo-logo-light.svg" alt="Paggo" className="h-[18px] w-auto" />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {isAdmin ? (
            <>
              {ADMIN_NAV_ITEMS.map(renderDesktopLink)}
              <p className="mt-4 px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/40">
                Pessoal
              </p>
              {PERSONAL_NAV_ITEMS.map(renderDesktopLink)}
            </>
          ) : (
            PERSONAL_NAV_ITEMS.map(renderDesktopLink)
          )}
        </nav>
        <div className="flex flex-col gap-3 border-t border-sidebar-border px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </span>
            <span className="text-sm font-medium">{fullName}</span>
          </div>
          <SignOutButton />
        </div>
      </aside>
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
    </>
  );
}
```

What changed vs. the original:
- `EMPLOYEE_NAV_ITEMS` renamed to `PERSONAL_NAV_ITEMS` (same two entries, same order) — it's no longer employee-exclusive.
- New `NavItem` interface and `LucideIcon` type import, so the same item shape can be reused across both arrays and merged for mobile.
- Desktop `<nav>`: admins now render `ADMIN_NAV_ITEMS`, then a `Pessoal` label, then `PERSONAL_NAV_ITEMS`. Employees render only `PERSONAL_NAV_ITEMS`, unchanged from before.
- The per-item `<Link>` JSX for desktop was extracted into `renderDesktopLink` purely because it's now called from two `.map()` sites instead of one — no behavior change to the markup itself.
- Mobile `<header>` nav is untouched in structure; it now maps over `mobileNavItems` (computed once above) instead of a `navItems` variable, so admins see all 7 items in one row and employees still see their 2.

- [ ] **Step 2: Type-check**

Run: `cd travel-app && npx tsc --noEmit`
Expected: no errors mentioning `app-sidebar.tsx`.

- [ ] **Step 3: Lint**

Run: `cd travel-app && npm run lint`
Expected: no new errors or warnings mentioning `app-sidebar.tsx`.

- [ ] **Step 4: Commit**

```bash
git add travel-app/src/components/layout/app-sidebar.tsx
git commit -m "feat: show personal trip nav items to admins in a separate sidebar section"
```

---

### Task 2: Scope `/requests` to the current user

**Files:**
- Modify: `travel-app/src/app/(app)/requests/page.tsx`

**Interfaces:**
- Consumes: `getCurrentProfile(): Promise<CurrentProfile | null>` from `travel-app/src/lib/session.ts:10`, where `CurrentProfile` has `id: string` (`travel-app/src/lib/session.ts:3-8`) — same function already used by `travel-app/src/app/(app)/layout.tsx:6` and `travel-app/src/app/admin/layout.tsx:6`.
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Add the current-user filter**

Replace the entire contents of `travel-app/src/app/(app)/requests/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toTravelRequest } from "@/lib/requests-mapper";
import { RequestsList } from "@/components/trip/requests-list";
import { getCurrentProfile } from "@/lib/session";

export default async function RequestsPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("requests")
    .select("*")
    .eq("employee_id", profile.id)
    .order("created_at", { ascending: false });

  const requests = (rows ?? []).map(toTravelRequest);

  return <RequestsList requests={requests} />;
}
```

This mirrors the `if (!profile) { redirect("/login"); }` pattern already used in `travel-app/src/app/admin/layout.tsx:6-9` — `redirect()` has return type `never`, so TypeScript narrows `profile` to non-null for the rest of the function without a manual assertion.

- [ ] **Step 2: Type-check**

Run: `cd travel-app && npx tsc --noEmit`
Expected: no errors mentioning `requests/page.tsx`.

- [ ] **Step 3: Lint**

Run: `cd travel-app && npm run lint`
Expected: no new errors or warnings mentioning `requests/page.tsx`.

- [ ] **Step 4: Full regression test suite**

Run: `cd travel-app && npm test`
Expected: all existing tests still pass (185 tests as of this plan's writing) — this change touches no code any existing test exercises, so this is a regression check, not a new-coverage check.

- [ ] **Step 5: Commit**

```bash
git add "travel-app/src/app/(app)/requests/page.tsx"
git commit -m "fix: scope /requests to the logged-in user's own requests"
```

- [ ] **Step 6: Manual end-to-end verification**

This is the only step that exercises both Task 1 and Task 2 together, so it's last regardless of task order.

Run: `cd travel-app && npm run dev` (leave running; note the port it prints — 3000 unless already occupied).

In a browser:
1. Go to `http://localhost:<port>/login`, click the **Admin** demo-credentials card, sign in.
2. Confirm the sidebar shows, in order: Painel, Solicitações, Funcionários, Relatórios, Configurações, then a small "PESSOAL" label, then Nova viagem, Minhas solicitações.
3. Click "Minhas solicitações". Expected: empty state (the demo admin account has never created a request) — **not** a list of other employees' trips.
4. Click "Nova viagem", search a route (e.g. GRU → GIG, any future date), select an offer, fill in passenger info, submit a business justification of 10+ characters, and complete the request.
5. Click "Minhas solicitações" again. Expected: exactly the one request just created, belonging to the admin.
6. Go to `/admin/requests` (Solicitações, admin queue). Expected: the same request appears there too, since it's a real row in `requests` like any other and the admin queue is unfiltered by employee.
7. Sign out, sign back in with the **Employee** demo-credentials card. Confirm the sidebar still shows only Nova viagem and Minhas solicitações (no Painel/Solicitações/etc., no "Pessoal" label — unchanged from before this plan).
8. Click "Minhas solicitações". Expected: only this employee's own requests, same as before this plan (regression check — this employee's request list must not have changed).

No commit for this step — it's verification only, not a code change.
