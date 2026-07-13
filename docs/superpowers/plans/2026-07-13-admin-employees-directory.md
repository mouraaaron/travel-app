# Admin Employees Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "em construção" placeholder at `/admin/employees` with a real employee directory: a searchable/filterable roster, a per-employee profile page with a travel summary, and two admin actions (change role, activate/deactivate access) — while leaving the existing spend/violation analytics in `/admin/reports` untouched.

**Architecture:** Server Components fetch `profiles` (and, on the detail page, `requests`) via `createSupabaseServerClient()` (anon key + user session — RLS enforced for real, same pattern as every other admin page in this project). Client Components handle search/filter state and the two mutation actions, calling new Route Handlers that update `profiles` through the same anon-key client, authorized by a new RLS UPDATE policy. A deactivated profile is treated as logged-out by `getCurrentProfile()`, which every authenticated layout already redirects to `/login` when it returns `null` — no new enforcement code needed beyond that one function.

**Tech Stack:** Next.js 14 (App Router, Server Components), TypeScript strict, Supabase (Postgres + RLS, `@supabase/ssr`), Tailwind + shadcn/ui primitives (`Table`, `Select`, `Switch`, `Badge`, `Avatar`, `EmptyState` — all already in the repo), Vitest for pure-logic tests, `sonner` for toasts, npm.

## Global Constraints

- Package manager is **npm**. Route handlers use `createSupabaseServerClient()` (anon key + cookies) — **never** a service-role client; this project has no service-role client anywhere, and all admin mutations rely on RLS policies to authorize the write (see `supabase/migrations/0002_admin_request_updates.sql` for the established pattern).
- UI copy (labels, headings, toasts) is in **pt-BR**. Code identifiers (variables, types, files) are in **English**.
- This project has no React render-testing setup (no jsdom/RTL) — only pure-logic modules (`src/lib/*.ts`, no `.tsx`) get Vitest tests. Pages and components are verified via `npx tsc --noEmit`, `npm run build`, `npm run lint`, and a manual browser checklist. This matches the precedent in every prior spec/plan in `docs/superpowers/`.
- Every commit ends with the trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Supabase migrations in this project are plain `.sql` files with no automated runner — they're applied by pasting into the Supabase SQL Editor (see the header comment of `0002_admin_request_updates.sql` / `0003_profiles_admin_select.sql`). Task 1's migration must be applied that way before Task 2 onward can be manually verified end-to-end (the code changes can still be written and type-checked without it).
- Demo profile IDs (from `docs/SchemaGuide.md` section 6): Employee `39557140-a4c1-46cc-803e-021b433332ab` (`employee@demo.com`), Admin `b5c03efb-3a3e-42dd-96f7-45d398d3ac85` (`admin@demo.com`).

---

### Task 1: Migration — `profiles.email`, `profiles.status`, admin UPDATE policy

**Files:**
- Create: `supabase/migrations/0004_profiles_employee_management.sql`

**Interfaces:**
- Produces: columns `profiles.email text not null`, `profiles.status text not null default 'active' check (status in ('active','inactive'))`; RLS policy `profiles_update_org_admin` (reuses the `is_org_admin(org_id)` function already created in `0003_profiles_admin_select.sql`) — consumed by every task from here on (Task 2 reads `status`; Task 5's Route Handlers rely on the UPDATE policy to authorize their writes).

- [ ] **Step 1: Write the migration file**

```sql
-- Adiciona email e status a profiles, e a policy de UPDATE que faltava para
-- o Travel Admin gerenciar papel/status de outros funcionários da mesma
-- organização (aba "Funcionários").
--
-- Duas colunas novas:
--   - email: copiado de auth.users no momento da criação do usuário. Hoje só
--     existem os 2 profiles demo — o backfill abaixo preenche os dois com o
--     e-mail já conhecido (seção 6 do SchemaGuide.md). Todo profile criado
--     depois (via script de seed ou fluxo manual) deve passar email
--     explicitamente.
--   - status: 'active' | 'inactive'. Um profile 'inactive' é tratado como
--     deslogado por getCurrentProfile() (src/lib/session.ts) — bloqueia
--     acesso sem apagar o histórico de requests da pessoa.
--
-- A policy de UPDATE segue o mesmo padrão de requests_update_admin
-- (0002_admin_request_updates.sql) e reaproveita a função is_org_admin já
-- criada em 0003_profiles_admin_select.sql — o backend usa a anon key +
-- sessão do usuário (não service role), então RLS é aplicado de verdade.
--
-- Como rodar: copie o conteúdo deste arquivo, cole no SQL Editor do Supabase
-- (menu lateral -> SQL Editor -> New query) e clique em "Run".

alter table profiles add column if not exists email text not null default '';

update profiles set email = 'employee@demo.com'
  where id = '39557140-a4c1-46cc-803e-021b433332ab';
update profiles set email = 'admin@demo.com'
  where id = 'b5c03efb-3a3e-42dd-96f7-45d398d3ac85';

alter table profiles alter column email drop default;

alter table profiles add column if not exists status text not null default 'active'
  check (status in ('active', 'inactive'));

create policy "profiles_update_org_admin"
  on profiles for update
  using (is_org_admin(profiles.organization_id))
  with check (is_org_admin(profiles.organization_id));
```

Save as `C:/Users/aaron/bootcamp/travel-app/supabase/migrations/0004_profiles_employee_management.sql`.

- [ ] **Step 2: Apply it in the Supabase SQL Editor**

Copy the file's contents, paste into the Supabase project's SQL Editor, click "Run".

Expected: no errors. `alter table ... add column if not exists` is safe to re-run if this step is ever repeated.

- [ ] **Step 3: Verify the columns and policy exist**

Run in the same SQL Editor:

```sql
select id, email, status from profiles;
```

Expected: 2 rows, `employee@demo.com` / `active` and `admin@demo.com` / `active`.

```sql
select policyname from pg_policies where tablename = 'profiles';
```

Expected: includes `profiles_select_own`, `profiles_select_org_admin`, and the new `profiles_update_org_admin`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0004_profiles_employee_management.sql
git commit -m "$(cat <<'EOF'
feat: add profiles.email/status columns and admin update policy

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Session enforcement — deactivated profiles are treated as logged out

**Files:**
- Modify: `src/lib/session.ts`
- Modify: `src/lib/session.test.ts`

**Interfaces:**
- Consumes: `profiles.status` column (Task 1).
- Produces: `getCurrentProfile()` returns `null` for an inactive profile — consumed automatically by `(app)/layout.tsx` and `admin/layout.tsx` (both already `redirect("/login")` when `getCurrentProfile()` is `null`; no changes needed to either layout).

- [ ] **Step 1: Write the failing tests**

Replace the third test's mock data (it's missing `status`, which is now required) and add a new test for the inactive case:

```ts
import { describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockSingle = vi.fn();

vi.mock("./supabase/server", () => ({
  createSupabaseServerClient: () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }),
  }),
}));

import { getCurrentProfile } from "./session";

describe("getCurrentProfile", () => {
  it("returns null when there is no authenticated user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getCurrentProfile();
    expect(result).toBeNull();
  });

  it("returns null when the user has no profile row", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockSingle.mockResolvedValueOnce({ data: null });
    const result = await getCurrentProfile();
    expect(result).toBeNull();
  });

  it("returns null when the profile is inactive", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockSingle.mockResolvedValueOnce({
      data: {
        id: "u1",
        organization_id: "org1",
        role: "employee",
        full_name: "Funcionário Demo",
        status: "inactive",
      },
    });
    const result = await getCurrentProfile();
    expect(result).toBeNull();
  });

  it("maps an active profile row into CurrentProfile", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockSingle.mockResolvedValueOnce({
      data: {
        id: "u1",
        organization_id: "org1",
        role: "admin",
        full_name: "Admin Demo",
        status: "active",
      },
    });
    const result = await getCurrentProfile();
    expect(result).toEqual({
      id: "u1",
      organizationId: "org1",
      role: "admin",
      fullName: "Admin Demo",
    });
  });
});
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/lib/session.test.ts`.

- [ ] **Step 2: Run it and confirm the new/renamed tests fail**

```bash
npx vitest run src/lib/session.test.ts
```

Expected: FAIL — "returns null when the profile is inactive" fails because `getCurrentProfile()` doesn't check `status` yet.

- [ ] **Step 3: Update `getCurrentProfile()`**

```ts
import { createSupabaseServerClient } from "./supabase/server";

export interface CurrentProfile {
  id: string;
  organizationId: string;
  role: "employee" | "admin";
  fullName: string;
}

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, role, full_name, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") return null;

  return {
    id: profile.id,
    organizationId: profile.organization_id,
    role: profile.role as "employee" | "admin",
    fullName: profile.full_name,
  };
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/lib/session.ts`.

- [ ] **Step 4: Run the tests again and confirm they pass**

```bash
npx vitest run src/lib/session.test.ts
```

Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.ts src/lib/session.test.ts
git commit -m "$(cat <<'EOF'
feat: treat inactive profiles as logged out in getCurrentProfile

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Badge helpers — role and employee-status badges (TDD)

**Files:**
- Modify: `src/lib/badge-variants.ts`
- Modify: `src/lib/badge-variants.test.ts`

**Interfaces:**
- Produces: `EmployeeRole` (`"employee" | "admin"`), `EmployeeStatus` (`"active" | "inactive"`), `getRoleBadge(role: EmployeeRole): BadgeSpec`, `getEmployeeStatusBadge(status: EmployeeStatus): BadgeSpec` — consumed by Task 4 (`employees-mapper.ts`), Task 5 (Route Handlers), Task 6 (`employees-table.tsx`), Task 7 (detail page, `employee-actions.tsx`).

- [ ] **Step 1: Write the failing tests**

Append to the end of the existing file:

```ts
describe("getRoleBadge", () => {
  it.each([
    ["employee", "Funcionário", "secondary"],
    ["admin", "Admin", "default"],
  ] as const)("maps %s to { %s, %s }", (role, label, variant) => {
    expect(getRoleBadge(role)).toEqual({ label, variant });
  });
});

describe("getEmployeeStatusBadge", () => {
  it.each([
    ["active", "Ativo", "success"],
    ["inactive", "Inativo", "destructive"],
  ] as const)("maps %s to { %s, %s }", (status, label, variant) => {
    expect(getEmployeeStatusBadge(status)).toEqual({ label, variant });
  });
});
```

Add `getEmployeeStatusBadge` and `getRoleBadge` to the existing import from `./badge-variants` at the top of the file.

Save as `C:/Users/aaron/bootcamp/travel-app/src/lib/badge-variants.test.ts`.

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run src/lib/badge-variants.test.ts
```

Expected: FAIL — `getRoleBadge`/`getEmployeeStatusBadge` are not exported yet.

- [ ] **Step 3: Add the types and functions**

Append to the end of `src/lib/badge-variants.ts`:

```ts
export type EmployeeRole = "employee" | "admin";
export type EmployeeStatus = "active" | "inactive";

const ROLE_BADGES: Record<EmployeeRole, BadgeSpec> = {
  employee: { label: "Funcionário", variant: "secondary" },
  admin: { label: "Admin", variant: "default" },
};

export function getRoleBadge(role: EmployeeRole): BadgeSpec {
  return ROLE_BADGES[role];
}

const EMPLOYEE_STATUS_BADGES: Record<EmployeeStatus, BadgeSpec> = {
  active: { label: "Ativo", variant: "success" },
  inactive: { label: "Inativo", variant: "destructive" },
};

export function getEmployeeStatusBadge(status: EmployeeStatus): BadgeSpec {
  return EMPLOYEE_STATUS_BADGES[status];
}
```

- [ ] **Step 4: Run the tests again and confirm they pass**

```bash
npx vitest run src/lib/badge-variants.test.ts
```

Expected: all tests pass (previous ones + 4 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/badge-variants.ts src/lib/badge-variants.test.ts
git commit -m "$(cat <<'EOF'
feat: add role and employee-status badge helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Employees mapper

**Files:**
- Create: `src/lib/employees-mapper.ts`

**Interfaces:**
- Consumes: `EmployeeRole`, `EmployeeStatus` from `./badge-variants` (Task 3).
- Produces: `EmployeeRow`, `Employee`, `toEmployee(row: EmployeeRow): Employee` — consumed by Task 5 (Route Handlers), Task 6 (`admin/employees/page.tsx`, `employees-table.tsx`), Task 7 (`admin/employees/[id]/page.tsx`).

- [ ] **Step 1: Write the mapper**

```ts
import type { EmployeeRole, EmployeeStatus } from "./badge-variants";

export interface EmployeeRow {
  id: string;
  full_name: string;
  email: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  created_at: string;
}

export type Employee = EmployeeRow;

export function toEmployee(row: EmployeeRow): Employee {
  return { ...row };
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/lib/employees-mapper.ts`.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/employees-mapper.ts
git commit -m "$(cat <<'EOF'
feat: add employees mapper (profiles row -> Employee)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Route Handlers — change role, activate/deactivate

**Files:**
- Create: `src/app/api/admin/employees/[id]/role/route.ts`
- Create: `src/app/api/admin/employees/[id]/status/route.ts`

**Interfaces:**
- Consumes: `EmployeeRole`, `EmployeeStatus` from `@/lib/badge-variants` (Task 3); `createSupabaseServerClient` from `@/lib/supabase/server`; the `profiles_update_org_admin` RLS policy (Task 1) to authorize the actual `update` call.
- Produces: `PATCH /api/admin/employees/[id]/role` (body `{ role: EmployeeRole }`) and `PATCH /api/admin/employees/[id]/status` (body `{ status: EmployeeStatus }`), both returning `{ employee: EmployeeRow }` on success — consumed by Task 7's `employee-actions.tsx`.

Both handlers follow the exact auth/authorization shape already used by `src/app/api/admin/requests/[id]/approve/route.ts`: anon-key client + manual role check (for a clean 403 message) + self-action guard (new in this feature) + RLS-backed update.

- [ ] **Step 1: Write the role Route Handler**

```ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EmployeeRole } from "@/lib/badge-variants";

const VALID_ROLES: EmployeeRole[] = ["employee", "admin"];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!adminProfile || adminProfile.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem alterar o papel de um funcionário." },
      { status: 403 }
    );
  }

  if (params.id === user.id) {
    return NextResponse.json(
      { error: "Você não pode alterar seu próprio papel." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const role = body?.role;
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Papel inválido." }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", params.id)
    .select("id, full_name, email, role, status, created_at")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Não foi possível alterar o papel." }, { status: 500 });
  }

  return NextResponse.json({ employee: updated });
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/app/api/admin/employees/[id]/role/route.ts`.

- [ ] **Step 2: Write the status Route Handler**

```ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EmployeeStatus } from "@/lib/badge-variants";

const VALID_STATUSES: EmployeeStatus[] = ["active", "inactive"];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!adminProfile || adminProfile.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem ativar ou desativar um funcionário." },
      { status: 403 }
    );
  }

  if (params.id === user.id) {
    return NextResponse.json(
      { error: "Você não pode desativar sua própria conta." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", params.id)
    .select("id, full_name, email, role, status, created_at")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Não foi possível alterar o status." }, { status: 500 });
  }

  return NextResponse.json({ employee: updated });
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/app/api/admin/employees/[id]/status/route.ts`.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual verification (requires Task 1's migration already applied)**

```bash
npm run dev
```

Log in as `admin@demo.com`. In the browser devtools console (while on any page of the app, so the session cookie is sent):

```js
fetch("/api/admin/employees/39557140-a4c1-46cc-803e-021b433332ab/status", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ status: "inactive" }),
}).then((r) => r.json()).then(console.log);
```

Expected: `{ employee: { ..., status: "inactive" } }`. Then flip it back with `{ status: "active" }` before moving on (Task 7's manual checklist re-tests this through the UI). Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/employees
git commit -m "$(cat <<'EOF'
feat: add role/status Route Handlers for employee management

Both reject a change targeting the caller's own profile, in addition
to the UI-level disabled state added in a later task — belt and
suspenders against an admin locking themselves out.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Employees list page

**Files:**
- Modify: `src/app/admin/employees/page.tsx`
- Create: `src/components/admin/employees-table.tsx`

**Interfaces:**
- Consumes: `EmployeeRow`, `Employee`, `toEmployee` from `@/lib/employees-mapper` (Task 4); `getRoleBadge`, `getEmployeeStatusBadge`, `EmployeeRole`, `EmployeeStatus` from `@/lib/badge-variants` (Task 3); `initialsFromName` from `@/lib/utils`; `createSupabaseServerClient` from `@/lib/supabase/server`.
- Produces: `<EmployeesTable employees={Employee[]} />` — self-contained, no later task consumes it directly (the page is the leaf).

- [ ] **Step 1: Write `EmployeesTable`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getEmployeeStatusBadge,
  getRoleBadge,
  type EmployeeRole,
  type EmployeeStatus,
} from "@/lib/badge-variants";
import type { Employee } from "@/lib/employees-mapper";
import { initialsFromName } from "@/lib/utils";

type RoleFilter = "all" | EmployeeRole;
type StatusFilter = "all" | EmployeeStatus;

export function EmployeesTable({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesQuery =
        loweredQuery.length === 0 ||
        employee.full_name.toLowerCase().includes(loweredQuery) ||
        employee.email.toLowerCase().includes(loweredQuery);
      const matchesRole = roleFilter === "all" || employee.role === roleFilter;
      const matchesStatus = statusFilter === "all" || employee.status === statusFilter;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [employees, query, roleFilter, statusFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-[280px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className="pl-8"
          />
        </div>
        <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Papel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os papéis</SelectItem>
            <SelectItem value="employee">Funcionário</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum funcionário encontrado" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funcionário</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((employee) => {
              const roleBadge = getRoleBadge(employee.role);
              const statusBadge = getEmployeeStatusBadge(employee.status);
              return (
                <TableRow
                  key={employee.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/employees/${employee.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback>{initialsFromName(employee.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{employee.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{employee.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleBadge.variant}>{roleBadge.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/components/admin/employees-table.tsx`.

- [ ] **Step 2: Replace the placeholder page**

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toEmployee, type EmployeeRow } from "@/lib/employees-mapper";
import { EmployeesTable } from "@/components/admin/employees-table";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminEmployeesPage() {
  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, created_at")
    .order("full_name", { ascending: true });

  const employees = ((rows ?? []) as EmployeeRow[]).map(toEmployee);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-foreground">Funcionários</h1>
      {employees.length === 0 ? (
        <EmptyState title="Nenhum funcionário cadastrado ainda" />
      ) : (
        <EmployeesTable employees={employees} />
      )}
    </div>
  );
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/app/admin/employees/page.tsx` (overwriting the placeholder).

- [ ] **Step 3: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed with no errors.

- [ ] **Step 4: Manual verification (requires Task 1's migration applied)**

```bash
npm run dev
```

Log in as `admin@demo.com`, go to `/admin/employees`. Expected: table shows both demo profiles (Funcionário/Admin badges, both "Ativo"). Type into the search box to filter by name/email; use both `Select` filters; confirm clicking a row navigates to `/admin/employees/[id]` (404 for now — built in Task 7). Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/employees/page.tsx src/components/admin/employees-table.tsx
git commit -m "$(cat <<'EOF'
feat: build the employees directory list page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Employee detail page (summary + actions)

**Files:**
- Create: `src/app/admin/employees/[id]/page.tsx`
- Create: `src/components/admin/employee-summary-cards.tsx`
- Create: `src/components/admin/employee-actions.tsx`
- Create: `src/components/layout/not-found-state.tsx`
- Delete: `src/components/trip/request-not-found.tsx`
- Modify: `src/app/(app)/requests/[id]/page.tsx`
- Modify: `src/app/admin/requests/[id]/page.tsx`

**Interfaces:**
- Consumes: `getCurrentProfile` from `@/lib/session` (Task 2); `toEmployee`, `EmployeeRow`, `Employee` from `@/lib/employees-mapper` (Task 4); `getRoleBadge`, `getEmployeeStatusBadge`, `EmployeeRole`, `EmployeeStatus` from `@/lib/badge-variants` (Task 3); `toAdminQueueRequest`, `RequestRowWithEmployee` from `@/lib/requests-mapper`; `spendByEmployee`, `outOfPolicyByEmployee` from `@/lib/admin-analytics`; the two Route Handlers from Task 5.
- Produces: the fully working `/admin/employees/[id]` page — leaf of this feature. Also produces `<NotFoundState />` from `@/components/layout/not-found-state`, a generalized replacement for `RequestNotFound` (which was a near-duplicate: same `EmptyState` + "go back" button, hardcoded title/description) — reused by the two existing request-detail pages that used to import `RequestNotFound`, so this feature doesn't introduce a third copy of that pattern.

- [ ] **Step 1: Write `EmployeeSummaryCards`**

```tsx
import { ListChecks, ShieldAlert, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/offer-format";

interface EmployeeSummaryCardsProps {
  totalSpend: number;
  requestCount: number;
  violationCount: number;
}

export function EmployeeSummaryCards({
  totalSpend,
  requestCount,
  violationCount,
}: EmployeeSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardDescription>Gasto total</CardDescription>
          <Wallet className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <CardTitle className="text-2xl">{formatCurrency(totalSpend, "BRL")}</CardTitle>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardDescription>Solicitações</CardDescription>
          <ListChecks className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <CardTitle className="text-2xl">{requestCount}</CardTitle>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardDescription>Desvios de política</CardDescription>
          <ShieldAlert className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <CardTitle className="text-2xl">{violationCount}</CardTitle>
        </CardContent>
      </Card>
    </div>
  );
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/components/admin/employee-summary-cards.tsx`.

- [ ] **Step 2: Generalize `RequestNotFound` into a shared `NotFoundState`**

`src/components/trip/request-not-found.tsx` is a hardcoded "solicitação não encontrada" empty state. This feature needs the identical pattern for "funcionário não encontrado" — instead of adding a third near-copy, parameterize `title`/`description` and move it somewhere both `trip/` and `admin/` pages can import from without an awkward name.

Write the generalized component:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";

interface NotFoundStateProps {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
}

export function NotFoundState({ title, description, backHref, backLabel }: NotFoundStateProps) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-[1080px]">
      <EmptyState
        title={title}
        description={description}
        button={{ label: backLabel, onClick: () => router.push(backHref) }}
      />
    </div>
  );
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/components/layout/not-found-state.tsx`.

Delete `src/components/trip/request-not-found.tsx`:

```bash
rm C:/Users/aaron/bootcamp/travel-app/src/components/trip/request-not-found.tsx
```

Update its two existing callers to use `NotFoundState` with the same title/description text `RequestNotFound` used to hardcode:

`src/app/(app)/requests/[id]/page.tsx` — replace the import and the `<RequestNotFound />` line:

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toTravelRequest } from "@/lib/requests-mapper";
import { RequestDetailView } from "@/components/trip/request-detail-view";
import { NotFoundState } from "@/components/layout/not-found-state";

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: row } = await supabase.from("requests").select("*").eq("id", params.id).single();

  if (!row) {
    return (
      <NotFoundState
        title="Solicitação não encontrada"
        description="Ela pode ter sido removida, ou você não tem acesso a ela."
        backHref="/requests"
        backLabel="Minhas solicitações"
      />
    );
  }

  return <RequestDetailView request={toTravelRequest(row)} />;
}
```

`src/app/admin/requests/[id]/page.tsx` — replace the import and the `<RequestNotFound ... />` line:

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toAdminQueueRequest, type RequestRowWithEmployee } from "@/lib/requests-mapper";
import { AdminRequestDetailView } from "@/components/admin/request-detail-view";
import { NotFoundState } from "@/components/layout/not-found-state";

export default async function AdminRequestDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: row } = await supabase
    .from("requests")
    .select("*, profiles(full_name)")
    .eq("id", params.id)
    .single();

  if (!row) {
    return (
      <NotFoundState
        title="Solicitação não encontrada"
        description="Ela pode ter sido removida, ou você não tem acesso a ela."
        backHref="/admin/requests"
        backLabel="Solicitações"
      />
    );
  }

  return <AdminRequestDetailView request={toAdminQueueRequest(row as RequestRowWithEmployee)} />;
}
```

Type-check before moving on:

```bash
npx tsc --noEmit
```

Expected: no errors (confirms no other file still imports the deleted `request-not-found.tsx`).

- [ ] **Step 3: Write `EmployeeActions`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { EmployeeRole, EmployeeStatus } from "@/lib/badge-variants";

interface EmployeeActionsProps {
  employeeId: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  isSelf: boolean;
}

export function EmployeeActions({ employeeId, role, status, isSelf }: EmployeeActionsProps) {
  const router = useRouter();
  const [savingRole, setSavingRole] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  async function handleRoleChange(nextRole: EmployeeRole) {
    setSavingRole(true);
    try {
      const response = await fetch(`/api/admin/employees/${employeeId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error ?? "Não foi possível alterar o papel.");
        return;
      }
      toast.success("Papel atualizado.");
      router.refresh();
    } catch {
      toast.error("Não foi possível alterar o papel.");
    } finally {
      setSavingRole(false);
    }
  }

  async function handleStatusToggle(checked: boolean) {
    const nextStatus: EmployeeStatus = checked ? "active" : "inactive";
    setSavingStatus(true);
    try {
      const response = await fetch(`/api/admin/employees/${employeeId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error ?? "Não foi possível alterar o status.");
        return;
      }
      toast.success(nextStatus === "active" ? "Acesso ativado." : "Acesso desativado.");
      router.refresh();
    } catch {
      toast.error("Não foi possível alterar o status.");
    } finally {
      setSavingStatus(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-5">
      <div className="flex flex-col gap-1.5">
        <Label>Papel</Label>
        <Select
          value={role}
          disabled={isSelf || savingRole}
          onValueChange={(value) => handleRoleChange(value as EmployeeRole)}
        >
          <SelectTrigger
            className="w-[200px]"
            title={isSelf ? "Você não pode alterar seu próprio papel" : undefined}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="employee">Funcionário</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={status === "active"}
          disabled={isSelf || savingStatus}
          onCheckedChange={handleStatusToggle}
          title={isSelf ? "Você não pode desativar sua própria conta" : undefined}
        />
        <Label>{status === "active" ? "Acesso ativo" : "Acesso desativado"}</Label>
      </div>
    </div>
  );
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/components/admin/employee-actions.tsx`.

- [ ] **Step 4: Write the detail page**

```tsx
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmployeeActions } from "@/components/admin/employee-actions";
import { EmployeeSummaryCards } from "@/components/admin/employee-summary-cards";
import { NotFoundState } from "@/components/layout/not-found-state";
import { getEmployeeStatusBadge, getRoleBadge } from "@/lib/badge-variants";
import { outOfPolicyByEmployee, spendByEmployee } from "@/lib/admin-analytics";
import { toEmployee, type EmployeeRow } from "@/lib/employees-mapper";
import { formatDate } from "@/lib/offer-format";
import { toAdminQueueRequest, type RequestRowWithEmployee } from "@/lib/requests-mapper";
import { getCurrentProfile } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { initialsFromName } from "@/lib/utils";

export default async function AdminEmployeeDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const currentProfile = await getCurrentProfile();

  const { data: employeeRow } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, created_at")
    .eq("id", params.id)
    .single();

  if (!employeeRow) {
    return (
      <NotFoundState
        title="Funcionário não encontrado"
        description="Ele pode ter sido removido, ou você não tem acesso a ele."
        backHref="/admin/employees"
        backLabel="Funcionários"
      />
    );
  }

  const employee = toEmployee(employeeRow as EmployeeRow);

  const { data: requestRows } = await supabase
    .from("requests")
    .select("*, profiles(full_name)")
    .eq("employee_id", params.id);

  const employeeRequests = ((requestRows ?? []) as RequestRowWithEmployee[]).map(toAdminQueueRequest);
  const totalSpend = spendByEmployee(employeeRequests)[0]?.total ?? 0;
  const violationCount = outOfPolicyByEmployee(employeeRequests)[0]?.count ?? 0;

  const roleBadge = getRoleBadge(employee.role);
  const statusBadge = getEmployeeStatusBadge(employee.status);

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/admin/employees">← Funcionários</Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback>{initialsFromName(employee.full_name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold text-foreground">{employee.full_name}</span>
            <span className="text-sm text-muted-foreground">{employee.email}</span>
            <span className="text-xs text-muted-foreground">
              Desde {formatDate(employee.created_at)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant={roleBadge.variant}>{roleBadge.label}</Badge>
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </div>
      </div>

      <EmployeeSummaryCards
        totalSpend={totalSpend}
        requestCount={employeeRequests.length}
        violationCount={violationCount}
      />

      <Button variant="secondary" size="sm" asChild className="w-fit">
        <Link href="/admin/reports">Ver relatório completo</Link>
      </Button>

      <EmployeeActions
        employeeId={employee.id}
        role={employee.role}
        status={employee.status}
        isSelf={currentProfile?.id === employee.id}
      />
    </div>
  );
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/app/admin/employees/[id]/page.tsx`.

- [ ] **Step 5: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed with no errors.

- [ ] **Step 6: Manual verification (requires Task 1's migration applied)**

```bash
npm run dev
```

Logged in as `admin@demo.com`, from `/admin/employees`:
1. Click the **Admin Demo** row (yourself). Expected: the "Papel" select and the active/inactive switch are both disabled (hover shows the `title` tooltip explaining why).
2. Go back, click the **Funcionário Demo** row. Expected: summary cards show real numbers matching that employee's requests (cross-check against `/admin/reports`). Both controls are enabled.
3. Toggle the switch off. Expected: toast "Acesso desativado.", badge in the header updates to "Inativo" after `router.refresh()`.
4. Open an incognito window, try to log in as `employee@demo.com`. Expected: login fails to reach any authenticated page — `getCurrentProfile()` returns `null` for the inactive profile, so the layout redirects to `/login`.
5. Back in the admin tab, toggle the switch back on ("Acesso ativo"). Confirm the employee can log in again in the incognito window.
6. Change that employee's role to "Admin", confirm the toast and badge update, then change it back to "Funcionário".
7. Visit `/admin/employees/00000000-0000-0000-0000-000000000000` (a nonexistent id). Expected: the "Funcionário não encontrado" empty state, with a working button back to `/admin/employees`.
8. Regression check on the two pages touched by the `NotFoundState` generalization: visit `/admin/requests/00000000-0000-0000-0000-000000000000` (expected: "Solicitação não encontrada", button back to "Solicitações") and, logged in as `employee@demo.com`, visit `/requests/00000000-0000-0000-0000-000000000000` (expected: same message, button back to "Minhas solicitações").

Stop the dev server.

- [ ] **Step 7: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/employees/[id] src/components/admin/employee-summary-cards.tsx src/components/admin/employee-actions.tsx src/components/layout/not-found-state.tsx src/app/\(app\)/requests/[id]/page.tsx src/app/admin/requests/[id]/page.tsx
git rm src/components/trip/request-not-found.tsx
git commit -m "$(cat <<'EOF'
feat: build the employee detail page (summary + role/status actions)

Generalized the existing RequestNotFound (hardcoded "solicitação não
encontrada" text) into a reusable NotFoundState(title, description,
backHref, backLabel), reused here for "funcionário não encontrado"
instead of adding a third near-identical empty state.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
