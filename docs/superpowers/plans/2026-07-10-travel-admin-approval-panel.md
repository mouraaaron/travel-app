# Travel Admin — Fila de Aprovação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder `src/app/admin/page.tsx` ("Admin Panel em construção") with a working Travel Admin section: an approval queue (`/admin/requests`), a request detail view with approve/reject actions and a reject-reason dialog (`/admin/requests/[id]`), and a role-aware sidebar — wired to the real `requests` table in Supabase (same table the Employee side already uses), not mock data.

**Architecture:** Server Components fetch through the existing cookie-scoped Supabase client (`src/lib/supabase/server.ts`, anon key + session — RLS is enforced for real, not a decorative filter). Two new Route Handlers (`approve`, `reject`) follow the exact pattern of the existing `src/app/api/requests/[id]/cancel/route.ts`. A new `src/app/admin/layout.tsx` mirrors `src/app/(app)/layout.tsx` (role-gated, renders the sidebar), and `AppSidebar` becomes role-aware (employee vs admin nav). New admin-only UI lives in `src/components/admin/`, reusing existing building blocks (`Badge`, `Card`, `Dialog`, `Tabs`, `Textarea`, `PolicyBadges`, `RequestStatusBadge`, badge/format helpers) rather than duplicating them.

**Tech Stack:** Next.js 14 App Router, TypeScript, `@supabase/ssr`, Radix UI + Tailwind (shadcn/ui), zod, sonner, vitest.

**Design spec:** `docs/superpowers/specs/2026-07-10-travel-admin-approval-panel-design.md` (read this first — it has the full visual spec from the design handoff plus every implementation decision below). Original handoff: `HANDOFF TRAVEL-ADMIN-PANNEL.zip` at the repo root (`bootcamp/`), folder `design_handoff_travel_approval_queue/` (README.md + interactive `.dc.html` prototype + screenshots) — open the `.dc.html` in a browser or look at the screenshots for pixel reference, but **do not copy its HTML/CSS** — it uses a design-tool-only templating runtime.

## Global Constraints

- **RLS is real, not decorative:** `src/lib/supabase/server.ts` uses the anon key + user session, so every Postgres policy in `supabase/migrations/*.sql` actually applies. `supabase/migrations/0001_init.sql` is already applied to the live Supabase project — **never edit it**. Add a new file (`0002_...`) for schema/policy changes, and after creating it, the file's content must be manually pasted into the Supabase SQL Editor and run (same process the comment at the top of `0001_init.sql` describes) — there is no automated migration runner in this project.
- **Demo accounts already exist:** `admin@demo.com` / `Admin#Demo2026` (role `admin`) and `employee@demo.com` / `Employee#Demo2026` (role `employee`), same organization. Use the admin account for manual QA in this plan.
- **Testing convention (existing repo precedent — do not deviate):** `vitest.config.ts` runs with `environment: "node"`, and there is no `@testing-library/react` setup. Pure-logic files in `src/lib/**/*.ts` get real vitest unit tests in a co-located `*.test.ts`. React components, pages, and Route Handlers get **no automated test** — verify those with `npm run build`, `npm run lint`, and the manual QA checklist in the final task.
- **Commands to run after every task** (from `travel-app/`): `npm test` and `npm run lint`. Additionally run `npm run build` after every task from Phase 2 onward (routing, layouts, and API routes are easy to silently break).
- **Money/date formatting:** always reuse `formatCurrency` / `formatDate` / `formatDateTime` / `getRouteLabel` from `src/lib/offer-format.ts` — never inline a new `Intl` call.
- **Icons:** `lucide-react` only, matching the icon names the design spec calls out (`ClipboardCheck`, `LayoutDashboard`, `Users`, `FileText`, `Settings`, `Search`, `Inbox`, `TriangleAlert`).
- **Reuse the existing Badge/Button/Card/Dialog/Tabs/Textarea components as-is.** Do not introduce new colors, radii, or a second badge shape to chase pixel-fidelity with the design handoff — the handoff's own README explicitly asks for this (see the design spec's "Fora de escopo" section).
- **Copy/labels:** reuse existing shared copy where a label already exists for the same concept (e.g. `pending_admin` is labeled "Aguardando aprovação" everywhere in this app via `getTravelRequestStatusBadge` — do **not** introduce a second label "Pendente" just for the admin screens).
- **Protected — byte-for-byte untouched unless a task explicitly says otherwise:** `tailwind.config.ts`, `components.json`, `src/styles/paggo-shadcn-vars.css`, `src/lib/policy.ts`, `supabase/migrations/0001_init.sql`.

---

## Phase 0 — Design-system additions

### Task 1: Add the Avatar primitive

**Files:**
- Modify: `package.json`
- Create: `src/components/ui/avatar.tsx`

**Interfaces:**
- Produces: `Avatar`, `AvatarImage`, `AvatarFallback` components, importable from `@/components/ui/avatar` — consumed by Task 12 (`RequestsQueue`).

- [ ] **Step 1: Add the dependency**

In `travel-app/package.json`, add this line to `"dependencies"`, keeping alphabetical order (it goes right after `"@radix-ui/react-accordion"` and before `"@radix-ui/react-checkbox"`):

```json
    "@radix-ui/react-avatar": "^1.2.2",
```

- [ ] **Step 2: Install**

Run (from `travel-app/`): `npm install`
Expected: installs cleanly, `package-lock.json` updates, no peer-dependency errors.

- [ ] **Step 3: Verify it resolves**

Run: `node -e "require('@radix-ui/react-avatar'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Create the component**

`src/components/ui/avatar.tsx`:

```tsx
"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted text-xs font-semibold",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
```

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/ui/avatar.tsx
git commit -m "feat: add Avatar primitive"
```

### Task 2: Add a `success` Button variant

**Files:**
- Modify: `src/components/ui/button.tsx`

**Interfaces:**
- Produces: `<Button variant="success">` — consumed by Task 12 (`RequestsQueue`'s row-level "Aprovar" action).

- [ ] **Step 1: Add the variant**

In `src/components/ui/button.tsx`, inside `buttonVariants`'s `variants.variant` object, add a `success` key right after `secondary`:

```ts
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        success:
          "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600",
        ghost: "hover:bg-accent hover:text-accent-foreground",
```

(This only adds the `success:` line — `secondary` and `ghost` already exist and are unchanged.)

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat: add success button variant"
```

### Task 3: Share `initialsFromName` via `lib/utils.ts`

**Files:**
- Modify: `src/lib/utils.ts`
- Modify: `src/components/layout/app-sidebar.tsx`
- Test: `src/lib/utils.test.ts` (create)

**Interfaces:**
- Produces: `initialsFromName(fullName: string): string`, exported from `@/lib/utils` — consumed by `app-sidebar.tsx` (this task) and by Task 12 (`RequestsQueue` row avatars).

- [ ] **Step 1: Write the failing test**

`src/lib/utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { initialsFromName } from "./utils";

describe("initialsFromName", () => {
  it("returns first+last initials for a full name", () => {
    expect(initialsFromName("Marina Castro")).toBe("MC");
  });

  it("returns a single initial when there's only one name", () => {
    expect(initialsFromName("Marina")).toBe("M");
  });

  it("uses only the first and the last part for names with a middle name", () => {
    expect(initialsFromName("Marina Souza Castro")).toBe("MC");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/utils.test.ts`
Expected: FAIL — `initialsFromName` is not exported from `./utils`.

- [ ] **Step 3: Add the function to `lib/utils.ts`**

`src/lib/utils.ts` (full file):

```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initialsFromName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/utils.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Remove the duplicate from `app-sidebar.tsx` and import the shared one**

In `src/components/layout/app-sidebar.tsx`, delete the local `initialsFromName` function (lines 14-19 in the current file):

```ts
function initialsFromName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
```

Change the import line:

```ts
import { cn } from "@/lib/utils";
```

to:

```ts
import { cn, initialsFromName } from "@/lib/utils";
```

Everything else in the file (the `initials` variable, its two usages) stays exactly as-is — it now resolves to the imported function instead of the local one.

- [ ] **Step 6: Run the full test suite and lint**

Run: `npm test && npm run lint`
Expected: all tests pass, no lint errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/utils.ts src/lib/utils.test.ts src/components/layout/app-sidebar.tsx
git commit -m "refactor: share initialsFromName via lib/utils"
```

---

## Phase 1 — Data layer: RLS, mappers, mutations

### Task 4: RLS policy so admins can update requests

**Files:**
- Create: `supabase/migrations/0002_admin_request_updates.sql`

**Interfaces:**
- Produces: an `UPDATE` RLS policy on `requests` for admin users — required by Task 7 and Task 8 (the approve/reject Route Handlers use the cookie-scoped client, so without this policy every mutation fails with a silent 0-rows-affected update).

- [ ] **Step 1: Write the migration**

`supabase/migrations/0002_admin_request_updates.sql`:

```sql
-- Adiciona a policy de UPDATE que faltava para o Travel Admin aprovar/rejeitar
-- solicitações de outras pessoas da mesma organização.
--
-- `0001_init.sql` já tem `requests_update_own` (o próprio funcionário pode
-- atualizar a solicitação que ele mesmo criou) e `requests_select_own_or_admin`
-- (admin pode LER solicitações da própria organização) — mas nunca existiu uma
-- policy de UPDATE para admin. Sem ela, aprovar/rejeitar falha silenciosamente:
-- o backend usa a anon key + sessão do usuário (não a service role key), então
-- RLS é aplicado de verdade.
--
-- Como rodar: copie o conteúdo deste arquivo, cole no SQL Editor do Supabase
-- (menu lateral -> SQL Editor -> New query) e clique em "Run".

create policy "requests_update_admin"
  on requests for update
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.organization_id = requests.organization_id
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.organization_id = requests.organization_id
    )
  );
```

- [ ] **Step 2: Apply it**

Paste the file's content into the Supabase project's SQL Editor and run it.
Expected: `CREATE POLICY` success message, no errors.

- [ ] **Step 3: Verify the policy exists**

In the same SQL Editor, run:

```sql
select policyname, cmd from pg_policies where tablename = 'requests';
```

Expected: 4 rows now — `requests_select_own_or_admin` (SELECT), `requests_insert_own` (INSERT), `requests_update_own` (UPDATE), `requests_update_admin` (UPDATE).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_admin_request_updates.sql
git commit -m "feat: add admin update RLS policy for requests"
```

### Task 5: `AdminQueueRequest` mapper (joins the employee's name)

**Files:**
- Modify: `src/lib/requests-mapper.ts`
- Test: `src/lib/requests-mapper.test.ts` (modify)

**Interfaces:**
- Consumes: `toTravelRequest` (existing, same file), `TravelRequest` (from `./types`).
- Produces: `RequestRowWithEmployee` (type), `AdminQueueRequest` (type, extends `TravelRequest` with `employeeName: string`), `toAdminQueueRequest(row: RequestRowWithEmployee): AdminQueueRequest` — consumed by Task 6, Task 12, and Task 13.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/requests-mapper.test.ts` (after the existing `describe("toTravelRequest", ...)` block, keep the existing `ROW` fixture untouched):

```ts
describe("toAdminQueueRequest", () => {
  it("adds the employee's name from the joined profiles row", () => {
    const result = toAdminQueueRequest({ ...ROW, profiles: { full_name: "Fernanda Lima" } });
    expect(result.employeeName).toBe("Fernanda Lima");
    expect(result.status).toBe("pending_admin");
  });

  it("falls back to a generic label when there is no joined profile", () => {
    const result = toAdminQueueRequest({ ...ROW, profiles: null });
    expect(result.employeeName).toBe("Funcionário");
  });
});
```

And update the top import line from:

```ts
import { toTravelRequest, type RequestRow } from "./requests-mapper";
```

to:

```ts
import { toAdminQueueRequest, toTravelRequest, type RequestRow } from "./requests-mapper";
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/requests-mapper.test.ts`
Expected: FAIL — `toAdminQueueRequest` is not exported from `./requests-mapper`.

- [ ] **Step 3: Add the type and mapper**

In `src/lib/requests-mapper.ts`, append after the existing `toTravelRequest` function:

```ts
export interface RequestRowWithEmployee extends RequestRow {
  profiles: { full_name: string } | null;
}

export interface AdminQueueRequest extends TravelRequest {
  employeeName: string;
}

export function toAdminQueueRequest(row: RequestRowWithEmployee): AdminQueueRequest {
  return {
    ...toTravelRequest(row),
    employeeName: row.profiles?.full_name ?? "Funcionário",
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/requests-mapper.test.ts`
Expected: PASS (3 tests total: the existing one + the 2 new ones).

- [ ] **Step 5: Full test + lint**

Run: `npm test && npm run lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/requests-mapper.ts src/lib/requests-mapper.test.ts
git commit -m "feat: add AdminQueueRequest mapper with joined employee name"
```

### Task 6: Pure queue filter/sort helper

**Files:**
- Create: `src/lib/admin-requests.ts`
- Test: `src/lib/admin-requests.test.ts` (create)

**Interfaces:**
- Consumes: `AdminQueueRequest` (from `./requests-mapper`, Task 5), `getRouteLabel` (from `./offer-format`, existing).
- Produces: `AdminQueueTab = "pending" | "all"` (type), `AdminQueueFilter` (type: `{ tab: AdminQueueTab; query: string }`), `filterRequestsForQueue(requests: AdminQueueRequest[], filter: AdminQueueFilter): AdminQueueRequest[]` — consumed by Task 12 (`RequestsQueue`).

- [ ] **Step 1: Write the failing test**

`src/lib/admin-requests.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filterRequestsForQueue } from "./admin-requests";
import type { AdminQueueRequest } from "./requests-mapper";

function makeRequest(overrides: Partial<AdminQueueRequest> = {}): AdminQueueRequest {
  return {
    id: "req_1",
    organization_id: "org_1",
    employee_id: "emp_1",
    employeeName: "Carlos Medeiros",
    created_at: "2026-07-06T09:14:00Z",
    status: "pending_admin",
    search_criteria: {
      slices: [{ origin: "CNF", destination: "GRU", departure_date: "2026-07-20" }],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
    },
    selected_offer_snapshot: {
      offer_id: "off_1",
      total_amount: "890.00",
      total_currency: "BRL",
      owner: { iata_code: "LA", name: "LATAM", logo_symbol_url: "" },
      slices: [
        {
          origin: "CNF",
          destination: "GRU",
          departure_datetime: "2026-07-20T08:00:00Z",
          arrival_datetime: "2026-07-20T09:30:00Z",
          duration: "PT1H30M",
          segments_count: 1,
        },
      ],
      conditions: {
        refund_before_departure: { allowed: false },
        change_before_departure: { allowed: false },
      },
      passenger_identity_documents_required: false,
      expires_at: "2026-07-15T00:00:00Z",
    },
    passengers: [],
    corporate: {
      trip_purpose: "client_meeting",
      cost_center: "Vendas",
      business_justification: "Visita a cliente.",
    },
    policy_evaluation: {
      compliant: true,
      violations: [],
      flags: { international_travel: false, cost_above_threshold: false },
    },
    events: [{ at: "2026-07-06T09:14:00Z", kind: "created" }],
    ...overrides,
  };
}

describe("filterRequestsForQueue", () => {
  it("keeps only pending_admin requests on the pending tab, oldest first", () => {
    const requests = [
      makeRequest({ id: "a", status: "approved", created_at: "2026-07-01T00:00:00Z" }),
      makeRequest({ id: "b", status: "pending_admin", created_at: "2026-07-07T11:02:00Z" }),
      makeRequest({ id: "c", status: "pending_admin", created_at: "2026-07-06T09:14:00Z" }),
    ];

    const result = filterRequestsForQueue(requests, { tab: "pending", query: "" });

    expect(result.map((r) => r.id)).toEqual(["c", "b"]);
  });

  it("on the all tab, filters by employee name case-insensitively", () => {
    const requests = [
      makeRequest({ id: "a", employeeName: "Fernanda Lima" }),
      makeRequest({ id: "b", employeeName: "Carlos Medeiros" }),
    ];

    const result = filterRequestsForQueue(requests, { tab: "all", query: "fernanda" });

    expect(result.map((r) => r.id)).toEqual(["a"]);
  });

  it("on the all tab, filters by origin or destination", () => {
    const base = makeRequest({ id: "a" });
    const other = makeRequest({
      id: "b",
      selected_offer_snapshot: {
        ...base.selected_offer_snapshot,
        slices: [
          {
            origin: "GRU",
            destination: "LIS",
            departure_datetime: "2026-07-25T10:00:00Z",
            arrival_datetime: "2026-07-25T22:00:00Z",
            duration: "PT10H",
            segments_count: 1,
          },
        ],
      },
    });

    const result = filterRequestsForQueue([base, other], { tab: "all", query: "lis" });

    expect(result.map((r) => r.id)).toEqual(["b"]);
  });

  it("ignores the search query on the pending tab", () => {
    const requests = [makeRequest({ id: "a", employeeName: "Fernanda Lima" })];

    const result = filterRequestsForQueue(requests, { tab: "pending", query: "no-match" });

    expect(result.map((r) => r.id)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/admin-requests.test.ts`
Expected: FAIL — cannot find module `./admin-requests`.

- [ ] **Step 3: Implement**

`src/lib/admin-requests.ts`:

```ts
import { getRouteLabel } from "./offer-format";
import type { AdminQueueRequest } from "./requests-mapper";

export type AdminQueueTab = "pending" | "all";

export interface AdminQueueFilter {
  tab: AdminQueueTab;
  query: string;
}

function matchesQuery(request: AdminQueueRequest, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const { origin, destination } = getRouteLabel(request.selected_offer_snapshot.slices);
  return (
    request.employeeName.toLowerCase().includes(needle) ||
    origin.toLowerCase().includes(needle) ||
    destination.toLowerCase().includes(needle)
  );
}

export function filterRequestsForQueue(
  requests: AdminQueueRequest[],
  filter: AdminQueueFilter
): AdminQueueRequest[] {
  const scoped =
    filter.tab === "pending" ? requests.filter((r) => r.status === "pending_admin") : requests;
  const searched = filter.tab === "all" ? scoped.filter((r) => matchesQuery(r, filter.query)) : scoped;
  return [...searched].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/admin-requests.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Full test + lint**

Run: `npm test && npm run lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin-requests.ts src/lib/admin-requests.test.ts
git commit -m "feat: add pure filter/sort helper for the admin approval queue"
```

### Task 7: `POST /api/admin/requests/[id]/approve`

**Files:**
- Create: `src/app/api/admin/requests/[id]/approve/route.ts`

**Interfaces:**
- Consumes: `createSupabaseServerClient` (`@/lib/supabase/server`), `toTravelRequest` (`@/lib/requests-mapper`), `TravelRequestEvent` (`@/lib/types`), the `requests_update_admin` RLS policy (Task 4).
- Produces: `POST /api/admin/requests/:id/approve` → `{ request: TravelRequest }` on success — consumed by Task 12 and Task 13's client-side `fetch` calls.

- [ ] **Step 1: Implement the route**

`src/app/api/admin/requests/[id]/approve/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toTravelRequest } from "@/lib/requests-mapper";
import type { TravelRequestEvent } from "@/lib/types";

const APPROVABLE_STATUSES = ["pending_admin", "needs_review"] as const;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem aprovar solicitações." },
      { status: 403 }
    );
  }

  const { data: existing } = await supabase
    .from("requests")
    .select("id, status, events")
    .eq("id", params.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  }
  if (!APPROVABLE_STATUSES.includes(existing.status as (typeof APPROVABLE_STATUSES)[number])) {
    return NextResponse.json(
      { error: "Só é possível aprovar solicitações pendentes ou que precisam de revisão." },
      { status: 409 }
    );
  }

  const approveEvent: TravelRequestEvent = {
    at: new Date().toISOString(),
    kind: "approved",
    actor_id: user.id,
  };
  const events = [...(existing.events as TravelRequestEvent[]), approveEvent];

  const { data: updated, error } = await supabase
    .from("requests")
    .update({ status: "approved", events })
    .eq("id", params.id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Não foi possível aprovar a solicitação." }, { status: 500 });
  }

  return NextResponse.json({ request: toTravelRequest(updated) });
}
```

- [ ] **Step 2: Build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, no lint errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/requests/[id]/approve/route.ts"
git commit -m "feat: add admin approve request endpoint"
```

### Task 8: `POST /api/admin/requests/[id]/reject`

**Files:**
- Create: `src/app/api/admin/requests/[id]/reject/route.ts`

**Interfaces:**
- Consumes: same as Task 7, plus `z` (zod, already a project dependency).
- Produces: `POST /api/admin/requests/:id/reject` with body `{ reason: string }` → `{ request: TravelRequest }` on success — consumed by Task 13's reject dialog.

- [ ] **Step 1: Implement the route**

`src/app/api/admin/requests/[id]/reject/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toTravelRequest } from "@/lib/requests-mapper";
import type { TravelRequestEvent } from "@/lib/types";

const REJECTABLE_STATUSES = ["pending_admin", "needs_review"] as const;

const rejectSchema = z.object({
  reason: z.string().trim().min(1, "Informe o motivo da rejeição."),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem rejeitar solicitações." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = rejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe o motivo da rejeição." }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("requests")
    .select("id, status, events")
    .eq("id", params.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  }
  if (!REJECTABLE_STATUSES.includes(existing.status as (typeof REJECTABLE_STATUSES)[number])) {
    return NextResponse.json(
      { error: "Só é possível rejeitar solicitações pendentes ou que precisam de revisão." },
      { status: 409 }
    );
  }

  const rejectEvent: TravelRequestEvent = {
    at: new Date().toISOString(),
    kind: "rejected",
    actor_id: user.id,
    note: parsed.data.reason,
  };
  const events = [...(existing.events as TravelRequestEvent[]), rejectEvent];

  const { data: updated, error } = await supabase
    .from("requests")
    .update({ status: "rejected", events })
    .eq("id", params.id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Não foi possível rejeitar a solicitação." }, { status: 500 });
  }

  return NextResponse.json({ request: toTravelRequest(updated) });
}
```

- [ ] **Step 2: Build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, no lint errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/requests/[id]/reject/route.ts"
git commit -m "feat: add admin reject request endpoint"
```

---

## Phase 2 — Admin shell: sidebar, layout, stub pages

### Task 9: Role-aware `AppSidebar`

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx`
- Modify: `src/app/(app)/layout.tsx`

**Interfaces:**
- Produces: `AppSidebar({ fullName, role }: { fullName: string; role: "employee" | "admin" })` — the `role` prop is new and required. Consumed by `(app)/layout.tsx` (this task) and Task 10 (`admin/layout.tsx`).

- [ ] **Step 1: Rewrite `app-sidebar.tsx` with role-aware nav**

Full replacement of `src/components/layout/app-sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Plane,
  Settings,
  Users,
} from "lucide-react";
import { cn, initialsFromName } from "@/lib/utils";
import { SignOutButton } from "./sign-out-button";

const EMPLOYEE_NAV_ITEMS = [
  { href: "/", label: "Nova viagem", icon: Plane },
  { href: "/requests", label: "Minhas solicitações", icon: ClipboardList },
] as const;

const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Painel", icon: LayoutDashboard },
  { href: "/admin/requests", label: "Solicitações", icon: ClipboardCheck },
  { href: "/admin/employees", label: "Funcionários", icon: Users },
  { href: "/admin/reports", label: "Relatórios", icon: FileText },
  { href: "/admin/settings", label: "Configurações", icon: Settings },
] as const;

export function AppSidebar({ fullName, role }: { fullName: string; role: "employee" | "admin" }) {
  const pathname = usePathname();
  const initials = initialsFromName(fullName);
  const navItems = role === "admin" ? ADMIN_NAV_ITEMS : EMPLOYEE_NAV_ITEMS;

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-14 items-center px-6">
          <img src="/paggo-logo-light.svg" alt="Paggo" className="h-6 w-auto" />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
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
          {navItems.map((item) => (
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

- [ ] **Step 2: Pass `role` from `(app)/layout.tsx`**

In `src/app/(app)/layout.tsx`, change:

```tsx
      <AppSidebar fullName={profile.fullName} />
```

to:

```tsx
      <AppSidebar fullName={profile.fullName} role={profile.role} />
```

(`profile.role` already exists on `CurrentProfile` from `getCurrentProfile()` — no other change needed in this file.)

- [ ] **Step 3: Build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds (this is the first task where a missing `role` prop would be a type error), no lint errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/app-sidebar.tsx "src/app/(app)/layout.tsx"
git commit -m "feat: make AppSidebar role-aware (employee vs admin nav)"
```

### Task 10: Admin layout + stub pages

**Files:**
- Create: `src/app/admin/layout.tsx`
- Modify: `src/app/admin/page.tsx`
- Create: `src/app/admin/employees/page.tsx`
- Create: `src/app/admin/reports/page.tsx`
- Create: `src/app/admin/settings/page.tsx`

**Interfaces:**
- Consumes: `getCurrentProfile` (`@/lib/session`), `AppSidebar` (Task 9).
- Produces: role-guarded `/admin/*` shell — every page under it assumes the layout already redirected non-admins.

- [ ] **Step 1: Create the admin layout**

`src/app/admin/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
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
    <>
      <AppSidebar fullName={profile.fullName} role="admin" />
      <main className="min-h-screen lg:pl-[248px]">
        <div className="px-6 pb-16 pt-8">{children}</div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Replace the placeholder `admin/page.tsx` with the "Painel" stub**

Full replacement of `src/app/admin/page.tsx` (the role guard and `SignOutButton` move to the layout — this page is now just the stub content):

```tsx
export default function AdminDashboardPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-xl font-semibold text-foreground">Painel em construção</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Visão geral de solicitações e gastos ainda não foi implementada nesta fase do projeto.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create the three remaining stub pages**

`src/app/admin/employees/page.tsx`:

```tsx
export default function AdminEmployeesPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-xl font-semibold text-foreground">Funcionários em construção</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Gestão de funcionários ainda não foi implementada nesta fase do projeto.
      </p>
    </div>
  );
}
```

`src/app/admin/reports/page.tsx`:

```tsx
export default function AdminReportsPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-xl font-semibold text-foreground">Relatórios em construção</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Relatórios de gastos e viagens ainda não foram implementados nesta fase do projeto.
      </p>
    </div>
  );
}
```

`src/app/admin/settings/page.tsx`:

```tsx
export default function AdminSettingsPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-xl font-semibold text-foreground">Configurações em construção</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Configurações da organização ainda não foram implementadas nesta fase do projeto.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, no lint errors.

- [ ] **Step 5: Manual check**

Run `npm run dev`, log in as `admin@demo.com`, and confirm: the sidebar shows Painel/Solicitações/Funcionários/Relatórios/Configurações, each nav link loads its stub page, and visiting any `/admin/*` URL as `employee@demo.com` redirects to `/`.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/page.tsx src/app/admin/employees/page.tsx src/app/admin/reports/page.tsx src/app/admin/settings/page.tsx
git commit -m "feat: add admin layout and stub pages for Painel/Funcionários/Relatórios/Configurações"
```

### Task 11: Generalize `RequestNotFound`

**Files:**
- Modify: `src/components/trip/request-not-found.tsx`

**Interfaces:**
- Produces: `RequestNotFound({ backHref = "/requests", backLabel = "Minhas solicitações" }: { backHref?: string; backLabel?: string })` — consumed by the existing employee detail route (unchanged behavior, defaults preserved) and Task 13's admin detail route.

- [ ] **Step 1: Add the optional props**

Full replacement of `src/components/trip/request-not-found.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";

export function RequestNotFound({
  backHref = "/requests",
  backLabel = "Minhas solicitações",
}: {
  backHref?: string;
  backLabel?: string;
}) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-[1080px]">
      <EmptyState
        title="Solicitação não encontrada"
        description="Ela pode ter sido removida, ou você não tem acesso a ela."
        button={{ label: backLabel, onClick: () => router.push(backHref) }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds (the existing usage in `src/app/(app)/requests/[id]/page.tsx` passes no props, so it keeps using the defaults — unchanged behavior), no lint errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/trip/request-not-found.tsx
git commit -m "refactor: make RequestNotFound's back link configurable"
```

---

## Phase 3 — Approval queue & detail UI

### Task 12: Approval queue (`RequestsQueue` + `/admin/requests`)

**Files:**
- Create: `src/components/admin/requests-queue.tsx`
- Create: `src/app/admin/requests/page.tsx`

**Interfaces:**
- Consumes: `Avatar`/`AvatarFallback` (Task 1), `Button` with `variant="success"` (Task 2), `initialsFromName` (Task 3), `filterRequestsForQueue`/`AdminQueueTab` (Task 6), `POST /api/admin/requests/:id/approve` (Task 7), `AdminQueueRequest`/`toAdminQueueRequest`/`RequestRowWithEmployee` (Task 5), `RequestStatusBadge`, `PolicyBadges`'s badge helpers (`getDuffelPolicyBadge`, `getDuffelFlagBadges` from `@/lib/badge-variants`), `formatCurrency`/`formatDate`/`getRouteLabel` (`@/lib/offer-format`).
- Produces: `<RequestsQueue requests={AdminQueueRequest[]} />`, rendered by `/admin/requests`.

- [ ] **Step 1: Create the queue component**

`src/components/admin/requests-queue.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inbox, Search } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequestStatusBadge } from "@/components/trip/request-status-badge";
import { getDuffelFlagBadges, getDuffelPolicyBadge } from "@/lib/badge-variants";
import { filterRequestsForQueue, type AdminQueueTab } from "@/lib/admin-requests";
import { formatCurrency, formatDate, getRouteLabel } from "@/lib/offer-format";
import { cn, initialsFromName } from "@/lib/utils";
import type { AdminQueueRequest } from "@/lib/requests-mapper";

export function RequestsQueue({ requests }: { requests: AdminQueueRequest[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<AdminQueueTab>("pending");
  const [query, setQuery] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterRequestsForQueue(requests, { tab, query }),
    [requests, tab, query]
  );

  async function handleQuickApprove(id: string) {
    setApprovingId(id);
    const response = await fetch(`/api/admin/requests/${id}/approve`, { method: "POST" });
    const body = await response.json().catch(() => null);
    setApprovingId(null);
    if (!response.ok) {
      toast.error(body?.error ?? "Não foi possível aprovar a solicitação.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-foreground">Solicitações</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(value) => setTab(value as AdminQueueTab)}>
          <TabsList indicator={false}>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === "all" ? (
          <div className="relative w-[280px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por funcionário ou rota"
              className="pl-8"
            />
          </div>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={tab === "pending" ? "Nenhuma solicitação pendente" : "Nenhuma solicitação encontrada"}
        />
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-md border border-border bg-card">
          {filtered.map((request) => {
            const snapshot = request.selected_offer_snapshot;
            const { origin, destination } = getRouteLabel(snapshot.slices);
            const outOfPolicy = !request.policy_evaluation.compliant;
            const policyBadge = getDuffelPolicyBadge(request.policy_evaluation);
            const flagBadges = getDuffelFlagBadges(request.policy_evaluation);

            return (
              <div
                key={request.id}
                className={cn(
                  "flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between",
                  outOfPolicy && "border-l-[3px] border-l-amber-500 bg-amber-50/40"
                )}
              >
                <div className="flex gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{initialsFromName(request.employeeName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{request.employeeName}</span>
                      <RequestStatusBadge status={request.status} />
                    </div>
                    <p className="text-[13px] text-muted-foreground">
                      {origin} → {destination} · {request.passengers.length} passageiro
                      {request.passengers.length > 1 ? "s" : ""} ·{" "}
                      <span className="font-semibold text-foreground">
                        {formatCurrency(Number(snapshot.total_amount), snapshot.total_currency)}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={policyBadge.variant}>{policyBadge.label}</Badge>
                      {flagBadges.map((badge) => (
                        <Badge key={badge.label} variant={badge.variant}>
                          {badge.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-xs text-muted-foreground">{formatDate(request.created_at)}</span>
                  <div className="flex gap-2">
                    {request.status === "pending_admin" ? (
                      <Button
                        variant="success"
                        size="sm"
                        disabled={approvingId === request.id}
                        onClick={() => handleQuickApprove(request.id)}
                      >
                        {approvingId === request.id ? "Aprovando..." : "Aprovar"}
                      </Button>
                    ) : null}
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={`/admin/requests/${request.id}`}>Ver detalhes</Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the page**

`src/app/admin/requests/page.tsx`:

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toAdminQueueRequest, type RequestRowWithEmployee } from "@/lib/requests-mapper";
import { RequestsQueue } from "@/components/admin/requests-queue";

export default async function AdminRequestsPage() {
  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("requests")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: true });

  const requests = ((rows ?? []) as RequestRowWithEmployee[]).map(toAdminQueueRequest);

  return <RequestsQueue requests={requests} />;
}
```

- [ ] **Step 3: Build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, no lint errors.

- [ ] **Step 4: Manual check**

Log in as `admin@demo.com`, go to Solicitações. Confirm: Pendentes tab shows only `pending_admin` rows oldest-first; switching to Todas reveals the search box and all statuses; typing in the search filters by name/route; clicking "Aprovar" on a pending row flips its status without navigating away; clicking "Ver detalhes" navigates to `/admin/requests/[id]`.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/requests-queue.tsx src/app/admin/requests/page.tsx
git commit -m "feat: add admin approval queue"
```

### Task 13: Request detail (`AdminRequestDetailView` + `/admin/requests/[id]`)

**Files:**
- Create: `src/components/admin/request-detail-view.tsx`
- Create: `src/app/admin/requests/[id]/page.tsx`

**Interfaces:**
- Consumes: `Card`/`CardContent`, `Dialog*`, `Textarea`, `Button` (existing), `PolicyBadges`, `RequestStatusBadge`, `getTravelRequestTimelineLabel` (`@/lib/badge-variants`), `formatCurrency`/`formatDate`/`formatDateTime`/`getRouteLabel` (`@/lib/offer-format`), `AdminQueueRequest`/`toAdminQueueRequest`/`RequestRowWithEmployee` (Task 5), `RequestNotFound` with `backHref`/`backLabel` (Task 11), `POST /api/admin/requests/:id/approve` (Task 7) and `.../reject` (Task 8).
- Produces: `<AdminRequestDetailView request={AdminQueueRequest} />`, rendered by `/admin/requests/[id]`.

- [ ] **Step 1: Create the detail component**

`src/components/admin/request-detail-view.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PolicyBadges } from "@/components/trip/policy-badges";
import { RequestStatusBadge } from "@/components/trip/request-status-badge";
import { getTravelRequestTimelineLabel } from "@/lib/badge-variants";
import { formatCurrency, formatDate, formatDateTime, getRouteLabel } from "@/lib/offer-format";
import type { AdminQueueRequest } from "@/lib/requests-mapper";

const ACTIONABLE_STATUSES = ["pending_admin", "needs_review"] as const;

export function AdminRequestDetailView({ request }: { request: AdminQueueRequest }) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const snapshot = request.selected_offer_snapshot;
  const { origin, destination } = getRouteLabel(snapshot.slices);
  const isRoundTrip = snapshot.slices.length > 1;
  const datesLabel = isRoundTrip
    ? `${formatDate(snapshot.slices[0].departure_datetime)} – ${formatDate(
        snapshot.slices[snapshot.slices.length - 1].departure_datetime
      )}`
    : formatDate(snapshot.slices[0].departure_datetime);
  const canAct = ACTIONABLE_STATUSES.includes(request.status as (typeof ACTIONABLE_STATUSES)[number]);

  async function handleApprove() {
    setApproving(true);
    const response = await fetch(`/api/admin/requests/${request.id}/approve`, { method: "POST" });
    const body = await response.json().catch(() => null);
    setApproving(false);
    if (!response.ok) {
      toast.error(body?.error ?? "Não foi possível aprovar a solicitação.");
      return;
    }
    router.refresh();
  }

  async function handleRejectConfirm() {
    setRejecting(true);
    const response = await fetch(`/api/admin/requests/${request.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason }),
    });
    const body = await response.json().catch(() => null);
    setRejecting(false);
    if (!response.ok) {
      toast.error(body?.error ?? "Não foi possível rejeitar a solicitação.");
      return;
    }
    setRejectOpen(false);
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6">
      <button
        type="button"
        onClick={() => router.push("/admin/requests")}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        ← Voltar para solicitações
      </button>

      <div>
        <h1 className="text-xl font-semibold text-foreground">{request.employeeName}</h1>
        <p className="text-sm text-muted-foreground">
          Solicitação criada em {formatDateTime(request.created_at)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 p-6">
              <div>
                <p className="text-xs text-muted-foreground">Rota</p>
                <p className="text-sm font-medium text-foreground">
                  {origin} → {destination}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Datas</p>
                <p className="text-sm font-medium text-foreground">{datesLabel}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Passageiros</p>
                <p className="text-sm font-medium text-foreground">
                  {request.passengers.length} passageiro{request.passengers.length > 1 ? "s" : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor total</p>
                <p className="text-sm font-semibold text-foreground">
                  {formatCurrency(Number(snapshot.total_amount), snapshot.total_currency)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-2 p-6">
              <h2 className="text-base font-semibold text-foreground">Contexto da viagem</h2>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {request.corporate.business_justification}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <h2 className="text-base font-semibold text-foreground">Avaliação de política</h2>
              <PolicyBadges evaluation={request.policy_evaluation} />
              {!request.policy_evaluation.compliant ? (
                <div className="flex flex-col gap-2">
                  {request.policy_evaluation.violations.map((violation) => (
                    <div
                      key={violation.rule_id}
                      className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 p-2.5 text-[13px] text-amber-800"
                    >
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{violation.message}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
              <RequestStatusBadge status={request.status} />
              {canAct ? (
                <div className="flex flex-col gap-2">
                  <Button
                    className="bg-brand-gradient hover:bg-brand-gradient-hover"
                    disabled={approving}
                    onClick={handleApprove}
                  >
                    {approving ? "Aprovando..." : "Aprovar"}
                  </Button>
                  <Button variant="secondary" className="text-destructive" onClick={() => setRejectOpen(true)}>
                    Rejeitar
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <h2 className="text-base font-semibold text-foreground">Linha do tempo</h2>
              <div className="flex flex-col gap-3 border-l-2 border-border pl-4">
                {request.events.map((event, index) => (
                  <div key={index} className="text-xs">
                    <p className="text-muted-foreground">{formatDateTime(event.at)}</p>
                    <p className="font-medium text-foreground">{getTravelRequestTimelineLabel(event.kind)}</p>
                    {event.note ? <p className="text-muted-foreground">{event.note}</p> : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar solicitação</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição. O funcionário será notificado com esta justificativa.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Descreva o motivo da rejeição..."
            className="min-h-[96px]"
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={rejecting || rejectReason.trim().length === 0}
              onClick={handleRejectConfirm}
            >
              {rejecting ? "Rejeitando..." : "Confirmar rejeição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Create the page**

`src/app/admin/requests/[id]/page.tsx`:

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toAdminQueueRequest, type RequestRowWithEmployee } from "@/lib/requests-mapper";
import { AdminRequestDetailView } from "@/components/admin/request-detail-view";
import { RequestNotFound } from "@/components/trip/request-not-found";

export default async function AdminRequestDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: row } = await supabase
    .from("requests")
    .select("*, profiles(full_name)")
    .eq("id", params.id)
    .single();

  if (!row) {
    return <RequestNotFound backHref="/admin/requests" backLabel="Solicitações" />;
  }

  return <AdminRequestDetailView request={toAdminQueueRequest(row as RequestRowWithEmployee)} />;
}
```

- [ ] **Step 3: Build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, no lint errors.

- [ ] **Step 4: Manual check**

From the queue, click "Ver detalhes" on an out-of-policy pending row. Confirm: the violation callouts render with the amber box + triangle-alert icon; "Aprovar" and "Rejeitar" are visible; clicking "Rejeitar" opens the dialog with "Confirmar rejeição" disabled until you type something; confirming closes the dialog, flips the status to Rejeitada, and adds a timeline entry with the typed reason. Then log in as `employee@demo.com`, open that same request under "Minhas solicitações", and confirm the rejection reason is visible there too.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/request-detail-view.tsx "src/app/admin/requests/[id]/page.tsx"
git commit -m "feat: add admin request detail view with approve/reject actions"
```

---

## Phase 4 — Final verification

### Task 14: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full automated check**

Run: `npm test && npm run lint && npm run build`
Expected: all pass with zero errors/warnings.

- [ ] **Step 2: End-to-end manual QA as admin**

Using `admin@demo.com` / `Admin#Demo2026`:
1. Sidebar shows all 5 admin nav items; Painel/Funcionários/Relatórios/Configurações each show their "em construção" stub.
2. `/admin/requests`, Pendentes tab: rows sorted oldest-first, out-of-policy rows have the amber left border + tint, "Aprovar" is visible on every pending row (including out-of-policy ones, per the confirmed behavior).
3. Click "Aprovar" on an in-policy pending row → status flips to "Aprovada" immediately, no dialog.
4. Switch to Todas tab → search box appears; type an employee's first name → list narrows to matching rows; clear it → full list returns.
5. Open an out-of-policy pending request's detail page → violation callouts show with the warning icon; click "Rejeitar" → dialog opens, confirm button stays disabled with empty text, type a reason, confirm → dialog closes, status becomes "Rejeitada", timeline shows the new entry.
6. Log out, log in as `employee@demo.com` / `Employee#Demo2026`, open the same (now-rejected) request under "Minhas solicitações" → the rejection reason is visible.
7. While still logged in as the employee, manually navigate to `/admin` and to `/admin/requests` → both redirect to `/`.

- [ ] **Step 3: Fix any issues found, then re-run Step 1**

If anything in Step 2 fails, fix it in the relevant task's files, re-run `npm test && npm run lint && npm run build`, and re-check the specific failing item from Step 2 before continuing.

No commit for this task — it's verification of work already committed in Tasks 1-13. If fixes were needed, commit them with a message describing the fix (e.g. `fix: ...`).
