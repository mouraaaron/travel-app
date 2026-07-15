# Employee Sectors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text, per-request `cost_center` (chosen manually per trip, two inconsistent value lists) with a fixed, admin-editable sector on every employee — `product` | `marketing` | `engineering` | `founders` — surfaced on the Funcionários and Relatórios tabs, driving three new sector charts on the Painel, and backing a per-sector travel policy that admins edit from Configurações.

**Architecture:** `profiles.cost_center` (new column, NOT NULL, 4-value check constraint) becomes the single source of truth for "what sector is this person in right now." `requests.corporate.cost_center` (existing jsonb field) keeps its name but changes owner: instead of being picked by the employee from a dropdown, the server stamps it from `profiles.cost_center` at request-creation time, so historical requests freeze whatever sector the requester was in when they filed the trip — no join needed to read history, and no drift when someone changes sector later. A new `policy_rules` table (one row per sector) replaces the hardcoded `DUFFEL_POLICY_DEFAULTS`, with a new admin UI on the previously-empty `/admin/settings` page. `policy_rules` also has an org-scoped RLS pair mirroring `is_org_admin` from `0003_profiles_admin_select.sql`.

**Tech Stack:** Next.js 14 (App Router) + Supabase/Postgres (raw SQL migrations, no ORM) + Zod + react-hook-form + Vitest.

## Global Constraints

- Sector values are the literal English strings `product`, `marketing`, `engineering`, `founders` — never translate the *value*, only the PT-BR *label* shown in the UI.
- The DB/code identifier stays `cost_center` everywhere it already exists (column name on both `profiles` and inside `requests.corporate`) — do not rename it to `sector`, per explicit decision.
- One sector per employee: a single `text` column, not an array.
- `requests.corporate.cost_center` must never again be settable by client input — always stamped server-side from the requester's profile.
- Every new/changed lib function that has existing test coverage keeps that coverage green; every new lib function ships with its own Vitest tests (this repo does not unit-test React components — only `src/lib/**` gets `*.test.ts`).
- Follow existing patterns exactly: manually-authored row interfaces (no Supabase codegen), Route Handlers using `createSupabaseServerClient()` + `service_role`, migrations applied by hand via the Supabase SQL Editor (see comment header convention in every existing migration file).

---

## Task 1: Database migration — `profiles.cost_center` + `policy_rules` table

**Files:**
- Create: `travel-app/supabase/migrations/0005_employee_sectors.sql`
- Modify: `travel-app/docs/SchemaGuide.md`

**Interfaces:**
- Produces: `profiles.cost_center text not null check (cost_center in ('product','marketing','engineering','founders'))`
- Produces: `policy_rules` table — `id uuid pk`, `organization_id uuid`, `sector text` (same check constraint), `domestic_cap_brl numeric`, `international_cap_brl numeric`, `long_haul_cabin_hours numeric`, `cost_flag_brl numeric`, `updated_at timestamptz`. Unique on `(organization_id, sector)`.

- [ ] **Step 1: Write the migration file**

```sql
-- travel-app/supabase/migrations/0005_employee_sectors.sql
-- Substitui a antiga divisão livre por cost_center (texto solto, escolhido
-- por solicitação, com listas inconsistentes entre corporate-schema.ts e
-- scripts/seed-demo-data.ts) por um setor fixo por funcionário: product,
-- marketing, engineering, founders.
--
-- O nome da coluna continua "cost_center" (decisão explícita), mas o dono e
-- o significado mudam: antes era "centro de custo da viagem" (em
-- requests.corporate, jsonb, escolhido manualmente); agora é "setor do
-- funcionário" (em profiles, coluna própria, fixo). requests.corporate
-- continua tendo cost_center dentro do jsonb, mas passa a ser uma cópia
-- congelada gravada pelo servidor no momento da criação da solicitação, não
-- mais escolhida pelo Employee — por isso não há coluna nova em `requests`
-- aqui, só a policy_rules nova e a coluna nova em profiles.
--
-- Como rodar: copie o conteúdo deste arquivo, cole no SQL Editor do
-- Supabase (menu lateral -> SQL Editor -> New query) e clique em "Run".

-- ============================================================
-- 1. profiles.cost_center
--    Segue o mesmo padrão de 0004_profiles_employee_management.sql: cria a
--    coluna com um default temporário, faz o backfill explícito das 2
--    contas demo, e remove o default depois — para que todo profile criado
--    dali em diante (script de seed, futuro fluxo de admin) precise
--    informar o setor explicitamente, sem cair num valor silencioso.
-- ============================================================
alter table profiles add column if not exists cost_center text not null default 'engineering'
  check (cost_center in ('product', 'marketing', 'engineering', 'founders'));

update profiles set cost_center = 'engineering'
  where id = '39557140-a4c1-46cc-803e-021b433332ab'; -- employee@demo.com
update profiles set cost_center = 'founders'
  where id = 'b5c03efb-3a3e-42dd-96f7-45d398d3ac85'; -- admin@demo.com

alter table profiles alter column cost_center drop default;

-- ============================================================
-- 2. policy_rules
--    Uma linha por setor. Substitui o DUFFEL_POLICY_DEFAULTS hardcoded em
--    src/lib/policy.ts. As 4 linhas do único org do MVP já nascem seedadas
--    aqui, com os mesmos valores que eram hardcoded antes (para não mudar
--    o comportamento observável no dia 1) — o Travel Admin ajusta depois
--    pela tela /admin/settings.
-- ============================================================
create table if not exists policy_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  sector text not null check (sector in ('product', 'marketing', 'engineering', 'founders')),
  domestic_cap_brl numeric not null,
  international_cap_brl numeric not null,
  long_haul_cabin_hours numeric not null,
  cost_flag_brl numeric not null,
  updated_at timestamptz not null default now(),
  unique (organization_id, sector)
);

create index if not exists policy_rules_organization_id_idx on policy_rules (organization_id);

insert into policy_rules (organization_id, sector, domestic_cap_brl, international_cap_brl, long_haul_cabin_hours, cost_flag_brl)
select id, sector, 3500, 12000, 8, 8000
from organizations, unnest(array['product', 'marketing', 'engineering', 'founders']) as sector
where name = 'Paggo (Demo)'
on conflict (organization_id, sector) do nothing;

-- ============================================================
-- 3. RLS para policy_rules
--    Mesma forma de is_org_admin() já criada em
--    0003_profiles_admin_select.sql: qualquer membro da organização pode
--    ler (o Employee precisa ler a política do próprio setor antes de
--    enviar uma solicitação); só admin da organização pode atualizar.
-- ============================================================
alter table policy_rules enable row level security;

create policy "policy_rules_select_org_member"
  on policy_rules for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.organization_id = policy_rules.organization_id
    )
  );

create policy "policy_rules_update_org_admin"
  on policy_rules for update
  using (is_org_admin(policy_rules.organization_id))
  with check (is_org_admin(policy_rules.organization_id));
```

- [ ] **Step 2: Run it**

Copy the file contents into the Supabase SQL Editor and click Run. Verify with a quick sanity query in the same editor:

```sql
select id, full_name, cost_center from profiles;
select sector, domestic_cap_brl, international_cap_brl from policy_rules order by sector;
```

Expected: both demo profiles have a non-null `cost_center`; `policy_rules` has exactly 4 rows (`product`, `marketing`, `engineering`, `founders`), each with `domestic_cap_brl = 3500`, `international_cap_brl = 12000`.

- [ ] **Step 3: Update `SchemaGuide.md`**

In `travel-app/docs/SchemaGuide.md`, modify the `profiles` table at lines 81-88 to add a row:

```markdown
| `role` | `text` | sim | Só pode ser `"employee"` ou `"admin"` (o banco recusa qualquer outro valor). Define o que a pessoa pode fazer. |
| `cost_center` | `text` | sim | O setor do funcionário: `"product"`, `"marketing"`, `"engineering"` ou `"founders"` (o banco recusa qualquer outro valor). Apesar do nome da coluna, hoje representa o setor da pessoa, não um centro de custo financeiro — o nome foi mantido para não duplicar conceito com `requests.corporate.cost_center` (ver seção 3.3). |
| `full_name` | `text` | sim | Nome de exibição na UI. |
```

Modify the `corporate` row description at line 110 (still true — no schema change to `requests`, just add a clarifying note directly below the table, after line 112):

```markdown
> **Nota sobre `corporate.cost_center`**: até a versão anterior deste guia, era escolhido manualmente pelo Employee em cada solicitação, com uma lista de valores livre. Agora é preenchido automaticamente pelo servidor (Route Handler `/api/requests`) a partir do `profiles.cost_center` de quem está enviando, no momento da criação — funciona como uma "foto" congelada do setor da pessoa naquele instante, mesmo que ela troque de setor depois.
```

Add a new subsection after `### 3.3 requests` (after line 112, before `## 4. Por que jsonb...`):

```markdown
### 3.4 `policy_rules`

Uma linha por setor, com os limites da política de viagem daquele setor.
Antes desta tabela existir, esses limites eram uma constante fixa no código
(`DUFFEL_POLICY_DEFAULTS` em `src/lib/policy.ts`) igual para todo mundo — a
tabela permite que o Travel Admin ajuste por setor, pela tela
`/admin/settings`.

| Coluna | Tipo | Obrigatório | Para que serve |
|---|---|---|---|
| `id` | `uuid` | sim (gerado sozinho) | Identificador único da linha. |
| `organization_id` | `uuid` | sim | A qual empresa essa regra pertence. |
| `sector` | `text` | sim | `"product"`, `"marketing"`, `"engineering"` ou `"founders"`. Único por organização junto com `organization_id`. |
| `domestic_cap_brl` | `numeric` | sim | Teto de preço (BRL) para voos domésticos. |
| `international_cap_brl` | `numeric` | sim | Teto de preço (BRL) para voos internacionais. |
| `long_haul_cabin_hours` | `numeric` | sim | Duração mínima do trecho (horas) para permitir classe executiva/primeira. |
| `cost_flag_brl` | `numeric` | sim | Acima deste valor, a solicitação é sinalizada como "custo elevado" (não bloqueia, só sinaliza). |
| `updated_at` | `timestamptz` | sim (automático) | Última edição pelo Travel Admin. |
```

Finally, in the section-2 ASCII overview (around line 57-60), remove the sentence that says `policy_rules` doesn't exist yet:

```markdown
Não existe hoje: tabela de aprovação, de `orders` da Duffel — porque esta
fase do projeto cobre só o fluxo do Employee até criar a solicitação (ver
decisão de escopo). `policy_rules` já existe (seção 3.4) e alimenta a
avaliação de política por setor. Essas ficam para quando o Admin Panel for
construído.
```

- [ ] **Step 4: Commit**

```bash
git add travel-app/supabase/migrations/0005_employee_sectors.sql travel-app/docs/SchemaGuide.md
git commit -m "docs+db: add profiles.cost_center sector and policy_rules table"
```

---

## Task 2: Sector type, labels, badges, and policy-rules mapper

**Files:**
- Modify: `travel-app/src/lib/badge-variants.ts`
- Create: `travel-app/src/lib/policy-rules.ts`
- Create: `travel-app/src/lib/policy-rules.test.ts`

**Interfaces:**
- Produces: `export type Sector = "product" | "marketing" | "engineering" | "founders"`
- Produces: `export const SECTORS: Sector[]`
- Produces: `export const SECTOR_LABELS: Record<Sector, string>`
- Produces: `export function getSectorBadge(sector: Sector): BadgeSpec`
- Produces (policy-rules.ts): `export interface PolicyRuleRow { id: string; organization_id: string; sector: Sector; domestic_cap_brl: number; international_cap_brl: number; long_haul_cabin_hours: number; cost_flag_brl: number; updated_at: string }`
- Produces: `export function toDuffelPolicyDefaults(row: PolicyRuleRow): DuffelPolicyDefaults`
- Consumes: `DuffelPolicyDefaults` from `./policy`

- [ ] **Step 1: Add `Sector` type, list, labels, and badge to `badge-variants.ts`**

Append at the end of `travel-app/src/lib/badge-variants.ts` (after the existing `getEmployeeStatusBadge`, currently ending at line 108-109):

```ts
export type Sector = "product" | "marketing" | "engineering" | "founders";

export const SECTORS: Sector[] = ["product", "marketing", "engineering", "founders"];

export const SECTOR_LABELS: Record<Sector, string> = {
  product: "Produto",
  marketing: "Marketing",
  engineering: "Engenharia",
  founders: "Founders",
};

const SECTOR_BADGES: Record<Sector, BadgeSpec> = {
  product: { label: "Produto", variant: "info" },
  marketing: { label: "Marketing", variant: "magic" },
  engineering: { label: "Engenharia", variant: "secondary" },
  founders: { label: "Founders", variant: "default" },
};

export function getSectorBadge(sector: Sector): BadgeSpec {
  return SECTOR_BADGES[sector];
}
```

- [ ] **Step 2: Write the failing test for the policy-rules mapper**

```ts
// travel-app/src/lib/policy-rules.test.ts
import { describe, expect, it } from "vitest";
import { toDuffelPolicyDefaults, type PolicyRuleRow } from "./policy-rules";

describe("toDuffelPolicyDefaults", () => {
  it("maps a policy_rules database row into the DuffelPolicyDefaults shape", () => {
    const row: PolicyRuleRow = {
      id: "rule_1",
      organization_id: "org_1",
      sector: "engineering",
      domestic_cap_brl: 3500,
      international_cap_brl: 12000,
      long_haul_cabin_hours: 8,
      cost_flag_brl: 8000,
      updated_at: "2026-07-13T00:00:00Z",
    };

    expect(toDuffelPolicyDefaults(row)).toEqual({
      domesticCapBRL: 3500,
      internationalCapBRL: 12000,
      longHaulCabinHours: 8,
      costFlagBRL: 8000,
    });
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd travel-app && npx vitest run src/lib/policy-rules.test.ts`
Expected: FAIL — `Cannot find module './policy-rules'`

- [ ] **Step 4: Implement `policy-rules.ts`**

```ts
// travel-app/src/lib/policy-rules.ts
import type { DuffelPolicyDefaults } from "./policy";
import type { Sector } from "./badge-variants";

export interface PolicyRuleRow {
  id: string;
  organization_id: string;
  sector: Sector;
  domestic_cap_brl: number;
  international_cap_brl: number;
  long_haul_cabin_hours: number;
  cost_flag_brl: number;
  updated_at: string;
}

export function toDuffelPolicyDefaults(row: PolicyRuleRow): DuffelPolicyDefaults {
  return {
    domesticCapBRL: row.domestic_cap_brl,
    internationalCapBRL: row.international_cap_brl,
    longHaulCabinHours: row.long_haul_cabin_hours,
    costFlagBRL: row.cost_flag_brl,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd travel-app && npx vitest run src/lib/policy-rules.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add travel-app/src/lib/badge-variants.ts travel-app/src/lib/policy-rules.ts travel-app/src/lib/policy-rules.test.ts
git commit -m "feat: add Sector type/labels/badges and policy_rules row mapper"
```

---

## Task 3: Employees tab — column, filter, badge, and admin edit

**Files:**
- Modify: `travel-app/src/lib/employees-mapper.ts`
- Modify: `travel-app/src/app/admin/employees/page.tsx`
- Modify: `travel-app/src/components/admin/employees-table.tsx`
- Modify: `travel-app/src/components/admin/employee-actions.tsx`
- Modify: `travel-app/src/app/admin/employees/[id]/page.tsx`
- Create: `travel-app/src/app/api/admin/employees/[id]/cost-center/route.ts`

**Interfaces:**
- Consumes: `Sector`, `SECTORS`, `SECTOR_LABELS`, `getSectorBadge` from `@/lib/badge-variants`
- Produces: `EmployeeRow.cost_center: Sector` (extends existing `EmployeeRow`)

- [ ] **Step 1: Extend `EmployeeRow`/`Employee` with `cost_center`**

```ts
// travel-app/src/lib/employees-mapper.ts
import type { EmployeeRole, EmployeeStatus, Sector } from "./badge-variants";

export interface EmployeeRow {
  id: string;
  full_name: string;
  email: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  cost_center: Sector;
  created_at: string;
}

export type Employee = EmployeeRow;

export function toEmployee(row: EmployeeRow): Employee {
  return { ...row };
}
```

- [ ] **Step 2: Select `cost_center` on the Funcionários list page**

```ts
// travel-app/src/app/admin/employees/page.tsx (line 10)
  const { data: rows } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, cost_center, created_at")
    .order("full_name", { ascending: true });
```

- [ ] **Step 3: Add a Setor column and filter to `EmployeesTable`**

Replace the full contents of `travel-app/src/components/admin/employees-table.tsx`:

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
  getSectorBadge,
  SECTOR_LABELS,
  SECTORS,
  type EmployeeRole,
  type EmployeeStatus,
  type Sector,
} from "@/lib/badge-variants";
import type { Employee } from "@/lib/employees-mapper";
import { initialsFromName } from "@/lib/utils";

type RoleFilter = "all" | EmployeeRole;
type StatusFilter = "all" | EmployeeStatus;
type SectorFilter = "all" | Sector;

export function EmployeesTable({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sectorFilter, setSectorFilter] = useState<SectorFilter>("all");

  const filtered = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesQuery =
        loweredQuery.length === 0 ||
        employee.full_name.toLowerCase().includes(loweredQuery) ||
        employee.email.toLowerCase().includes(loweredQuery);
      const matchesRole = roleFilter === "all" || employee.role === roleFilter;
      const matchesStatus = statusFilter === "all" || employee.status === statusFilter;
      const matchesSector = sectorFilter === "all" || employee.cost_center === sectorFilter;
      return matchesQuery && matchesRole && matchesStatus && matchesSector;
    });
  }, [employees, query, roleFilter, statusFilter, sectorFilter]);

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
        <Select value={sectorFilter} onValueChange={(value) => setSectorFilter(value as SectorFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {SECTORS.map((sector) => (
              <SelectItem key={sector} value={sector}>
                {SECTOR_LABELS[sector]}
              </SelectItem>
            ))}
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
              <TableHead>Setor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((employee) => {
              const roleBadge = getRoleBadge(employee.role);
              const statusBadge = getEmployeeStatusBadge(employee.status);
              const sectorBadge = getSectorBadge(employee.cost_center);
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
                    <Badge variant={sectorBadge.variant}>{sectorBadge.label}</Badge>
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

- [ ] **Step 4: New PATCH route for sector, mirroring `/role` and `/status`**

```ts
// travel-app/src/app/api/admin/employees/[id]/cost-center/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SECTORS, type Sector } from "@/lib/badge-variants";

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
      { error: "Apenas administradores podem alterar o setor de um funcionário." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const costCenter = body?.cost_center as Sector | undefined;
  if (!costCenter || !SECTORS.includes(costCenter)) {
    return NextResponse.json({ error: "Setor inválido." }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ cost_center: costCenter })
    .eq("id", params.id)
    .select("id, full_name, email, role, status, cost_center, created_at")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Não foi possível alterar o setor." }, { status: 500 });
  }

  return NextResponse.json({ employee: updated });
}
```

Note: unlike `/role` and `/status`, this route does not block `params.id === user.id` — an admin changing their own sector is harmless (it doesn't affect their own permissions), so no self-edit guard is needed here.

- [ ] **Step 5: Add sector Select to `EmployeeActions`**

Replace the full contents of `travel-app/src/components/admin/employee-actions.tsx`:

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
import { SECTOR_LABELS, SECTORS, type EmployeeRole, type EmployeeStatus, type Sector } from "@/lib/badge-variants";

interface EmployeeActionsProps {
  employeeId: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  costCenter: Sector;
  isSelf: boolean;
}

export function EmployeeActions({ employeeId, role, status, costCenter, isSelf }: EmployeeActionsProps) {
  const router = useRouter();
  const [savingRole, setSavingRole] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingSector, setSavingSector] = useState(false);

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

  async function handleSectorChange(nextSector: Sector) {
    setSavingSector(true);
    try {
      const response = await fetch(`/api/admin/employees/${employeeId}/cost-center`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cost_center: nextSector }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error ?? "Não foi possível alterar o setor.");
        return;
      }
      toast.success("Setor atualizado.");
      router.refresh();
    } catch {
      toast.error("Não foi possível alterar o setor.");
    } finally {
      setSavingSector(false);
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

      <div className="flex flex-col gap-1.5">
        <Label>Setor</Label>
        <Select
          value={costCenter}
          disabled={savingSector}
          onValueChange={(value) => handleSectorChange(value as Sector)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SECTORS.map((sector) => (
              <SelectItem key={sector} value={sector}>
                {SECTOR_LABELS[sector]}
              </SelectItem>
            ))}
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

- [ ] **Step 6: Wire the detail page**

In `travel-app/src/app/admin/employees/[id]/page.tsx`:

Line 23, extend the select:

```ts
  const { data: employeeRow } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, cost_center, created_at")
    .eq("id", params.id)
    .single();
```

Line 8, extend the import to also pull `getSectorBadge`:

```ts
import { getEmployeeStatusBadge, getRoleBadge, getSectorBadge } from "@/lib/badge-variants";
```

After line 50 (`const statusBadge = ...`), add:

```ts
  const sectorBadge = getSectorBadge(employee.cost_center);
```

In the badges row (lines 71-74), add the sector badge:

```tsx
        <div className="flex gap-2">
          <Badge variant={roleBadge.variant}>{roleBadge.label}</Badge>
          <Badge variant={sectorBadge.variant}>{sectorBadge.label}</Badge>
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </div>
```

In the `<EmployeeActions>` call (lines 87-92), pass the new prop:

```tsx
      <EmployeeActions
        employeeId={employee.id}
        role={employee.role}
        status={employee.status}
        costCenter={employee.cost_center}
        isSelf={currentProfile?.id === employee.id}
      />
```

- [ ] **Step 7: Manual verification**

Run: `cd travel-app && npm run dev`, log in as `admin@demo.com`, open `/admin/employees`. Confirm: a "Setor" column and filter appear; opening any employee shows a Setor badge and a working Setor dropdown that persists after `router.refresh()`.

- [ ] **Step 8: Commit**

```bash
git add travel-app/src/lib/employees-mapper.ts travel-app/src/app/admin/employees/page.tsx travel-app/src/components/admin/employees-table.tsx travel-app/src/components/admin/employee-actions.tsx travel-app/src/app/admin/employees/[id]/page.tsx travel-app/src/app/api/admin/employees/[id]/cost-center/route.ts
git commit -m "feat: show and edit employee sector on the Funcionários tab"
```

---

## Task 4: Request creation — server-side freeze, drop the manual dropdown, per-sector policy evaluation

**Files:**
- Modify: `travel-app/src/lib/corporate-schema.ts`
- Modify: `travel-app/src/lib/corporate-schema.test.ts`
- Modify: `travel-app/src/app/api/requests/route.ts`
- Create: `travel-app/src/app/api/policy/me/route.ts`
- Modify: `travel-app/src/app/(app)/request/review/page.tsx`
- Modify: `travel-app/src/components/trip/request-detail-view.tsx`

**Interfaces:**
- Consumes: `toDuffelPolicyDefaults` from `@/lib/policy-rules`, `evaluateDuffelOffer` from `@/lib/policy`
- Produces: `GET /api/policy/me` → `{ defaults: DuffelPolicyDefaults }`

- [ ] **Step 1: Remove `cost_center` from the corporate context form schema**

```ts
// travel-app/src/lib/corporate-schema.ts
import { z } from "zod";
import type { TripPurpose } from "./types";

export const corporateContextSchema = z
  .object({
    trip_purpose: z.enum(["client_meeting", "conference", "internal_meeting", "training", "other"], {
      error: "Selecione o motivo da viagem",
    }),
    project_code: z.string().optional(),
    business_justification: z.string().trim().min(20, "Mínimo 20 caracteres"),
    isOutOfPolicy: z.boolean(),
    out_of_policy_justification: z.string().optional(),
  })
  .refine((d) => !d.isOutOfPolicy || (d.out_of_policy_justification?.trim().length ?? 0) >= 50, {
    message: "Mínimo 50 caracteres explicando por que a oferta fora da política é necessária",
    path: ["out_of_policy_justification"],
  });

export type CorporateContextFormValues = z.infer<typeof corporateContextSchema>;

export const TRIP_PURPOSE_LABELS: Record<TripPurpose, string> = {
  client_meeting: "Reunião com cliente",
  conference: "Conferência",
  internal_meeting: "Reunião interna",
  training: "Treinamento",
  other: "Outro",
};
```

- [ ] **Step 2: Update the schema test to drop `cost_center`**

```ts
// travel-app/src/lib/corporate-schema.test.ts
import { describe, expect, it } from "vitest";
import { corporateContextSchema } from "./corporate-schema";

const valid = {
  trip_purpose: "conference" as const,
  project_code: "",
  business_justification: "Conferência anual do setor de pagamentos.",
  isOutOfPolicy: false,
  out_of_policy_justification: "",
};

describe("corporateContextSchema", () => {
  it("accepts a valid compliant submission with no out-of-policy justification", () => {
    expect(corporateContextSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a business_justification shorter than 20 characters", () => {
    const result = corporateContextSchema.safeParse({ ...valid, business_justification: "Muito curto" });
    expect(result.success).toBe(false);
  });

  it("requires an out_of_policy_justification of at least 50 characters when isOutOfPolicy is true", () => {
    const result = corporateContextSchema.safeParse({
      ...valid,
      isOutOfPolicy: true,
      out_of_policy_justification: "Muito curto",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a 50+ character out_of_policy_justification when isOutOfPolicy is true", () => {
    const result = corporateContextSchema.safeParse({
      ...valid,
      isOutOfPolicy: true,
      out_of_policy_justification:
        "Preciso deste voo específico porque é o único com conexão compatível com a agenda do cliente.",
    });
    expect(result.success).toBe(true);
  });
});
```

Run: `cd travel-app && npx vitest run src/lib/corporate-schema.test.ts`
Expected: PASS (4 tests, the old "rejects an empty cost_center" test is gone because there's nothing left to validate there)

- [ ] **Step 3: New `GET /api/policy/me` route**

```ts
// travel-app/src/app/api/policy/me/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toDuffelPolicyDefaults, type PolicyRuleRow } from "@/lib/policy-rules";
import { DUFFEL_POLICY_DEFAULTS } from "@/lib/policy";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, cost_center")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  }

  const { data: rule } = await supabase
    .from("policy_rules")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .eq("sector", profile.cost_center)
    .single();

  const defaults = rule ? toDuffelPolicyDefaults(rule as PolicyRuleRow) : DUFFEL_POLICY_DEFAULTS;

  return NextResponse.json({ defaults });
}
```

`DUFFEL_POLICY_DEFAULTS` is kept as a last-resort fallback for the edge case where a `policy_rules` row is somehow missing (it should never happen after Task 1's seed insert, but the route shouldn't 500 if it does).

- [ ] **Step 4: Stamp `cost_center` server-side in `POST /api/requests`, stop trusting the client's value**

In `travel-app/src/app/api/requests/route.ts`:

Line 36-42, drop `cost_center` from the Zod schema (client no longer sends it):

```ts
  corporate: z.object({
    trip_purpose: z.enum(["client_meeting", "conference", "internal_meeting", "training", "other"]),
    project_code: z.string().optional(),
    business_justification: z.string(),
    out_of_policy_justification: z.string().optional(),
  }),
```

Line 62-66, select `cost_center` alongside `organization_id`:

```ts
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, cost_center")
    .eq("id", user.id)
    .single();
```

Line 79-93, stamp `corporate.cost_center` from the profile instead of the payload:

```ts
  const { data: inserted, error } = await supabase
    .from("requests")
    .insert({
      organization_id: profile.organization_id,
      employee_id: user.id,
      status: "pending_admin",
      total_amount: totalAmount,
      total_currency: parsed.data.selected_offer_snapshot.total_currency,
      search_criteria: parsed.data.search_criteria,
      selected_offer_snapshot: parsed.data.selected_offer_snapshot,
      passengers: parsed.data.passengers,
      corporate: { ...parsed.data.corporate, cost_center: profile.cost_center },
      policy_evaluation: parsed.data.policy_evaluation,
      events: parsed.data.events,
    })
    .select()
    .single();
```

- [ ] **Step 5: Remove the manual dropdown from the review page, fetch sector-specific policy defaults**

In `travel-app/src/app/(app)/request/review/page.tsx`:

Line 16-24, drop `COST_CENTERS` from the import and add the new fetch dependencies:

```ts
import {
  TRIP_PURPOSE_LABELS,
  corporateContextSchema,
  type CorporateContextFormValues,
} from "@/lib/corporate-schema";
import { formatCurrency, formatDate } from "@/lib/offer-format";
import { evaluateDuffelOffer, DUFFEL_POLICY_DEFAULTS, type DuffelPolicyDefaults } from "@/lib/policy";
import { useTripFlow } from "@/lib/trip-flow-store";
```

Replace lines 26-42 (component body up to `form` declaration) with:

```tsx
export default function ReviewPage() {
  const router = useRouter();
  const { criteria, selectedOffer: offer, passengers, corporate, reset } = useTripFlow();
  const [policyDefaults, setPolicyDefaults] = useState<DuffelPolicyDefaults>(DUFFEL_POLICY_DEFAULTS);
  const [policyLoaded, setPolicyLoaded] = useState(false);
  const evaluation = offer ? evaluateDuffelOffer(offer, policyDefaults) : null;
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/policy/me")
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled && body?.defaults) setPolicyDefaults(body.defaults);
      })
      .finally(() => {
        if (!cancelled) setPolicyLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const form = useForm<CorporateContextFormValues>({
    resolver: zodResolver(corporateContextSchema),
    defaultValues: {
      trip_purpose: corporate?.trip_purpose ?? "client_meeting",
      project_code: corporate?.project_code ?? "",
      business_justification: corporate?.business_justification ?? "",
      isOutOfPolicy: evaluation ? !evaluation.compliant : false,
      out_of_policy_justification: corporate?.out_of_policy_justification ?? "",
    },
  });
```

Add `useEffect` to the React import at the top of the file (line 3):

```ts
import { useEffect, useState } from "react";
```

Remove `cost_center` from the submit payload (line 89-95 becomes):

```ts
      corporate: {
        trip_purpose: values.trip_purpose,
        project_code: values.project_code || undefined,
        business_justification: values.business_justification,
        out_of_policy_justification: values.isOutOfPolicy ? values.out_of_policy_justification : undefined,
      },
```

Delete the entire "Centro de custo" `FormField` block (the second `FormField` inside the `grid grid-cols-1 gap-4 sm:grid-cols-3` at lines 210-233), and widen the remaining grid from 3 columns to 2 since only "Motivo da viagem" and "Código do projeto" are left:

```tsx
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="trip_purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motivo da viagem</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(TRIP_PURPOSE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="project_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código do projeto (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: WEBSUMMIT" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
```

Finally, disable the submit button while the policy hasn't loaded yet (so the compliance evaluation shown to the user reflects the real sector policy, not the fallback default) — change the submit `Button` (around line 299-306):

```tsx
            <Button
              type="submit"
              size="lg"
              disabled={submitting || !policyLoaded}
              className="bg-brand-gradient hover:bg-brand-gradient-hover"
            >
              {submitting ? "Enviando..." : !policyLoaded ? "Carregando política..." : "Enviar solicitação"}
            </Button>
```

- [ ] **Step 6: Relabel the request detail view**

In `travel-app/src/components/trip/request-detail-view.tsx`, line 132:

```tsx
              <p>Setor: {SECTOR_LABELS[request.corporate.cost_center as Sector]}</p>
```

Add the import near the top of the file (alongside the existing `TRIP_PURPOSE_LABELS` import — check the current import block and add):

```ts
import { SECTOR_LABELS, type Sector } from "@/lib/badge-variants";
```

- [ ] **Step 7: Manual verification**

Run: `cd travel-app && npm run dev`, log in as `employee@demo.com`, search a flight, get to `/request/review`. Confirm: no "Centro de custo" field is shown, the submit button briefly reads "Carregando política..." then becomes enabled, and after submitting, the request detail page shows "Setor: Engenharia" (since `employee@demo.com` was backfilled to `engineering` in Task 1).

- [ ] **Step 8: Commit**

```bash
git add travel-app/src/lib/corporate-schema.ts travel-app/src/lib/corporate-schema.test.ts travel-app/src/app/api/requests/route.ts travel-app/src/app/api/policy/me/route.ts "travel-app/src/app/(app)/request/review/page.tsx" travel-app/src/components/trip/request-detail-view.tsx
git commit -m "feat: freeze employee sector into requests server-side, drop manual dropdown, evaluate policy per sector"
```

---

## Task 5: Analytics functions — sector spend, volume, headcount

**Files:**
- Modify: `travel-app/src/lib/admin-analytics.ts`
- Modify: `travel-app/src/lib/admin-analytics.test.ts`
- Modify: `travel-app/src/lib/requests-mapper.ts`
- Modify: `travel-app/src/lib/requests-mapper.test.ts`

**Interfaces:**
- Consumes: `Sector`, `SECTORS` from `./badge-variants`, `Employee` from `./employees-mapper`
- Produces: `spendBySector(requests): { sector: Sector; total: number }[]`
- Produces: `requestVolumeBySector(requests): { sector: Sector; count: number }[]`
- Produces: `headcountBySector(employees: Employee[]): { sector: Sector; count: number }[]`
- Produces (requests-mapper.ts): `RequestRowWithEmployee.profiles: { full_name: string; cost_center: Sector } | null`, `AdminQueueRequest.employeeSector: Sector`

- [ ] **Step 1: Update `requests-mapper.ts` to carry the joined sector**

```ts
// travel-app/src/lib/requests-mapper.ts
import type { Sector } from "./badge-variants";
import type { TravelRequest } from "./types";

export interface RequestRow {
  id: string;
  organization_id: string;
  employee_id: string;
  status: TravelRequest["status"];
  total_amount: number;
  total_currency: string;
  created_at: string;
  search_criteria: TravelRequest["search_criteria"];
  selected_offer_snapshot: TravelRequest["selected_offer_snapshot"];
  passengers: TravelRequest["passengers"];
  corporate: TravelRequest["corporate"];
  policy_evaluation: TravelRequest["policy_evaluation"];
  events: TravelRequest["events"];
}

export function toTravelRequest(row: RequestRow): TravelRequest {
  return {
    id: row.id,
    organization_id: row.organization_id,
    employee_id: row.employee_id,
    created_at: row.created_at,
    status: row.status,
    search_criteria: row.search_criteria,
    selected_offer_snapshot: row.selected_offer_snapshot,
    passengers: row.passengers,
    corporate: row.corporate,
    policy_evaluation: row.policy_evaluation,
    events: row.events,
  };
}

export interface RequestRowWithEmployee extends RequestRow {
  profiles: { full_name: string; cost_center: Sector } | null;
}

export interface AdminQueueRequest extends TravelRequest {
  employeeName: string;
  employeeSector: Sector;
}

export function toAdminQueueRequest(row: RequestRowWithEmployee): AdminQueueRequest {
  return {
    ...toTravelRequest(row),
    employeeName: row.profiles?.full_name ?? "Funcionário",
    employeeSector: row.profiles?.cost_center ?? "engineering",
  };
}
```

`"engineering"` is used as the fallback only for the (currently impossible, since `cost_center` is `not null`) case where the join returns no profile — mirrors the existing `"Funcionário"` fallback pattern one line above it.

- [ ] **Step 2: Update `requests-mapper.test.ts`**

```ts
// travel-app/src/lib/requests-mapper.test.ts
import { describe, expect, it } from "vitest";
import { toAdminQueueRequest, toTravelRequest, type RequestRow } from "./requests-mapper";

const ROW: RequestRow = {
  id: "req_1",
  organization_id: "org_1",
  employee_id: "emp_1",
  status: "pending_admin",
  total_amount: 2850,
  total_currency: "BRL",
  created_at: "2026-07-10T14:00:00Z",
  search_criteria: {
    slices: [{ origin: "GRU", destination: "JFK", departure_date: "2026-08-10" }],
    passengers: [{ type: "adult" }],
    cabin_class: "economy",
  },
  selected_offer_snapshot: {
    offer_id: "off_1",
    total_amount: "2850.00",
    total_currency: "BRL",
    owner: { iata_code: "LA", name: "LATAM", logo_symbol_url: "" },
    slices: [],
    conditions: {
      refund_before_departure: { allowed: false },
      change_before_departure: { allowed: false },
    },
    passenger_identity_documents_required: false,
    expires_at: "2026-08-01T00:00:00Z",
  },
  passengers: [],
  corporate: {
    trip_purpose: "client_meeting",
    cost_center: "engineering",
    business_justification: "Reunião com cliente estratégico.",
  },
  policy_evaluation: {
    compliant: true,
    violations: [],
    flags: { international_travel: true, cost_above_threshold: false },
  },
  events: [{ at: "2026-07-10T14:00:00Z", kind: "created" }],
};

describe("toTravelRequest", () => {
  it("maps a database row into the TravelRequest shape the UI expects", () => {
    const result = toTravelRequest(ROW);
    expect(result.id).toBe("req_1");
    expect(result.status).toBe("pending_admin");
    expect(result.corporate.cost_center).toBe("engineering");
    expect(result.events).toHaveLength(1);
    expect(result.selected_offer_snapshot.owner.name).toBe("LATAM");
  });
});

describe("toAdminQueueRequest", () => {
  it("adds the employee's name and sector from the joined profiles row", () => {
    const result = toAdminQueueRequest({ ...ROW, profiles: { full_name: "Fernanda Lima", cost_center: "product" } });
    expect(result.employeeName).toBe("Fernanda Lima");
    expect(result.employeeSector).toBe("product");
    expect(result.status).toBe("pending_admin");
  });

  it("falls back to a generic label and engineering when there is no joined profile", () => {
    const result = toAdminQueueRequest({ ...ROW, profiles: null });
    expect(result.employeeName).toBe("Funcionário");
    expect(result.employeeSector).toBe("engineering");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd travel-app && npx vitest run src/lib/requests-mapper.test.ts`
Expected: FAIL — `employeeSector` is `undefined`, not `"product"`/`"engineering"` (mapper not yet updated in this test run order — actually Step 1 already implemented it, so this should PASS; the "write test first" ordering here is inverted because the mapper change is trivial and mechanical. Skip ahead to Step 4 to confirm.)

- [ ] **Step 4: Run it to verify it passes**

Run: `cd travel-app && npx vitest run src/lib/requests-mapper.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write failing tests for the three new analytics functions**

In `travel-app/src/lib/admin-analytics.test.ts`, update the fixture's `cost_center` at line 47 from `"Vendas"` to `"engineering"`:

```ts
    corporate: {
      trip_purpose: "client_meeting",
      cost_center: "engineering",
      business_justification: "Visita a cliente.",
    },
```

Add `employeeSector: "engineering"` to the `makeRequest` return object (right after `employeeName: "Carlos Medeiros",` at line 14):

```ts
    employeeName: "Carlos Medeiros",
    employeeSector: "engineering",
```

Replace the `describe("spendByCostCenter", ...)` block (lines 172-185) with:

```ts
describe("spendBySector", () => {
  it("sums realized spend per sector, sorted descending", () => {
    const snapshot = makeRequest().selected_offer_snapshot;
    const requests = [
      makeRequest({ id: "a", status: "approved", corporate: { ...makeRequest().corporate, cost_center: "marketing" }, selected_offer_snapshot: { ...snapshot, total_amount: "1000.00" } }),
      makeRequest({ id: "b", status: "confirmed", corporate: { ...makeRequest().corporate, cost_center: "marketing" }, selected_offer_snapshot: { ...snapshot, total_amount: "500.00" } }),
      makeRequest({ id: "c", status: "approved", corporate: { ...makeRequest().corporate, cost_center: "engineering" }, selected_offer_snapshot: { ...snapshot, total_amount: "800.00" } }),
    ];
    expect(spendBySector(requests)).toEqual([
      { sector: "marketing", total: 1500 },
      { sector: "engineering", total: 800 },
      { sector: "product", total: 0 },
      { sector: "founders", total: 0 },
    ]);
  });
});

describe("requestVolumeBySector", () => {
  it("returns all 4 sectors in enum order, counting matches and zero-filling the rest", () => {
    const requests = [
      makeRequest({ id: "a", corporate: { ...makeRequest().corporate, cost_center: "product" } }),
      makeRequest({ id: "b", corporate: { ...makeRequest().corporate, cost_center: "product" } }),
      makeRequest({ id: "c", corporate: { ...makeRequest().corporate, cost_center: "founders" } }),
    ];
    expect(requestVolumeBySector(requests)).toEqual([
      { sector: "product", count: 2 },
      { sector: "marketing", count: 0 },
      { sector: "engineering", count: 0 },
      { sector: "founders", count: 1 },
    ]);
  });
});

describe("headcountBySector", () => {
  it("counts employees per sector, in enum order, zero-filling sectors with no one in them", () => {
    const employees = [
      { id: "1", full_name: "A", email: "a@x.com", role: "employee" as const, status: "active" as const, cost_center: "engineering" as const, created_at: "2026-01-01T00:00:00Z" },
      { id: "2", full_name: "B", email: "b@x.com", role: "employee" as const, status: "active" as const, cost_center: "engineering" as const, created_at: "2026-01-01T00:00:00Z" },
      { id: "3", full_name: "C", email: "c@x.com", role: "admin" as const, status: "active" as const, cost_center: "founders" as const, created_at: "2026-01-01T00:00:00Z" },
    ];
    expect(headcountBySector(employees)).toEqual([
      { sector: "product", count: 0 },
      { sector: "marketing", count: 0 },
      { sector: "engineering", count: 2 },
      { sector: "founders", count: 1 },
    ]);
  });
});
```

Update the imports at the top of the file (lines 1-7) to pull in the new functions and the `Employee` type:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { monthlySpend, spendVsPreviousMonth } from "./admin-analytics";
import { complianceRate, outOfPolicyByEmployee, spendBySector, spendByEmployee } from "./admin-analytics";
import { requestsByStatus, tripPurposeBreakdown, requestVolumeBySector, headcountBySector } from "./admin-analytics";
import { avgApprovalTimeHours } from "./admin-analytics";
import { recentOutOfPolicy } from "./admin-analytics";
import type { AdminQueueRequest } from "./requests-mapper";
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd travel-app && npx vitest run src/lib/admin-analytics.test.ts`
Expected: FAIL — `spendBySector`, `requestVolumeBySector`, `headcountBySector` are not exported yet.

- [ ] **Step 7: Implement the three functions**

In `travel-app/src/lib/admin-analytics.ts`, add the import (line 1-2):

```ts
import type { Employee } from "./employees-mapper";
import { SECTORS, type Sector } from "./badge-variants";
import type { AdminQueueRequest } from "./requests-mapper";
import type { TravelRequestStatus, TripPurpose } from "./types";
```

Replace `spendByCostCenter` (lines 100-112) with:

```ts
export function spendBySector(
  requests: AdminQueueRequest[]
): { sector: Sector; total: number }[] {
  const totals = new Map<Sector, number>(SECTORS.map((sector) => [sector, 0]));
  for (const request of requests) {
    if (!isRealizedSpend(request)) continue;
    const key = request.corporate.cost_center as Sector;
    totals.set(key, (totals.get(key) ?? 0) + requestSpend(request));
  }
  return Array.from(totals.entries())
    .map(([sector, total]) => ({ sector, total }))
    .sort((a, b) => b.total - a.total);
}

export function requestVolumeBySector(
  requests: AdminQueueRequest[]
): { sector: Sector; count: number }[] {
  return SECTORS.map((sector) => ({
    sector,
    count: requests.filter((r) => r.corporate.cost_center === sector).length,
  }));
}

export function headcountBySector(employees: Employee[]): { sector: Sector; count: number }[] {
  return SECTORS.map((sector) => ({
    sector,
    count: employees.filter((e) => e.cost_center === sector).length,
  }));
}
```

Note `spendBySector` zero-fills every sector (matches the new test expectation `{ sector: "product", total: 0 }`) whereas the old `spendByCostCenter` only emitted sectors that appeared in the data — this is a deliberate behavior change so the ranking chart always shows all 4 sectors, consistent with how `requestVolumeBySector`/`tripPurposeBreakdown`/`requestsByStatus` already zero-fill.

- [ ] **Step 8: Run it to verify it passes**

Run: `cd travel-app && npx vitest run src/lib/admin-analytics.test.ts`
Expected: PASS (all tests, including the 3 new describe blocks)

- [ ] **Step 9: Commit**

```bash
git add travel-app/src/lib/admin-analytics.ts travel-app/src/lib/admin-analytics.test.ts travel-app/src/lib/requests-mapper.ts travel-app/src/lib/requests-mapper.test.ts
git commit -m "feat: add spendBySector, requestVolumeBySector, headcountBySector analytics"
```

---

## Task 6: Painel — three sector charts

**Files:**
- Modify: `travel-app/src/components/admin/spend-breakdown-charts.tsx`
- Modify: `travel-app/src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `spendBySector`, `requestVolumeBySector`, `headcountBySector` from `@/lib/admin-analytics`
- Produces: `SectorSpendChart`, `SectorVolumeChart`, `SectorHeadcountChart` components

- [ ] **Step 1: Replace `CostCenterRankingChart` and add the two new chart components**

In `travel-app/src/components/admin/spend-breakdown-charts.tsx`, add the import (line 13-15):

```ts
import { getTravelRequestStatusBadge, SECTOR_LABELS, type Sector } from "@/lib/badge-variants";
import { formatCurrency } from "@/lib/offer-format";
import type { TravelRequestStatus, TripPurpose } from "@/lib/types";
```

Replace the `COST_CENTER_CONFIG` constant and `CostCenterRankingChart` function (lines 47-78) with:

```ts
const SECTOR_SPEND_CONFIG: ChartConfig = {
  total: { label: "Gasto", color: "hsl(var(--chart-2))" },
};

export function SectorSpendChart({ data }: { data: { sector: Sector; total: number }[] }) {
  const chartData = data.map((entry) => ({ label: SECTOR_LABELS[entry.sector], total: entry.total }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gasto por setor</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={SECTOR_SPEND_CONFIG} className="h-64 w-full">
          <BarChart data={chartData} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatCurrency(Number(value), "BRL")}
            />
            <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={100} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value), "BRL")} />}
            />
            <Bar dataKey="total" fill="var(--color-total)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

const SECTOR_VOLUME_CONFIG: ChartConfig = {
  count: { label: "Solicitações", color: "hsl(var(--chart-3))" },
};

export function SectorVolumeChart({ data }: { data: { sector: Sector; count: number }[] }) {
  const chartData = data.map((entry) => ({ label: SECTOR_LABELS[entry.sector], count: entry.count }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Volume de solicitações por setor</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={SECTOR_VOLUME_CONFIG} className="h-64 w-full">
          <BarChart data={chartData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={32} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

const SECTOR_HEADCOUNT_CONFIG: ChartConfig = {
  count: { label: "Funcionários", color: "hsl(var(--chart-4))" },
};

export function SectorHeadcountChart({ data }: { data: { sector: Sector; count: number }[] }) {
  const chartData = data.map((entry) => ({ label: SECTOR_LABELS[entry.sector], count: entry.count }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funcionários por setor</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={SECTOR_HEADCOUNT_CONFIG} className="h-64 w-full">
          <BarChart data={chartData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={32} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Wire the Painel page**

Replace the full contents of `travel-app/src/app/admin/page.tsx`:

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toAdminQueueRequest, type RequestRowWithEmployee } from "@/lib/requests-mapper";
import { toEmployee, type EmployeeRow } from "@/lib/employees-mapper";
import {
  avgApprovalTimeHours,
  complianceRate,
  headcountBySector,
  monthlySpend,
  recentOutOfPolicy,
  requestsByStatus,
  requestVolumeBySector,
  spendBySector,
  spendVsPreviousMonth,
  tripPurposeBreakdown,
} from "@/lib/admin-analytics";
import { StatCards } from "@/components/admin/stat-cards";
import { SpendChart } from "@/components/admin/spend-chart";
import { OutOfPolicyPanel } from "@/components/admin/out-of-policy-panel";
import {
  SectorHeadcountChart,
  SectorSpendChart,
  SectorVolumeChart,
  StatusVolumeChart,
  TripPurposeChart,
} from "@/components/admin/spend-breakdown-charts";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminDashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("requests")
    .select("*, profiles(full_name, cost_center)")
    .order("created_at", { ascending: true });

  const { data: employeeRows } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, cost_center, created_at");

  const requests = ((rows ?? []) as RequestRowWithEmployee[]).map(toAdminQueueRequest);
  const employees = ((employeeRows ?? []) as EmployeeRow[]).map(toEmployee);
  const headcount = headcountBySector(employees);

  if (requests.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-xl font-semibold text-foreground">Painel</h1>
        <EmptyState title="Nenhuma solicitação registrada ainda" />
      </div>
    );
  }

  const monthly = monthlySpend(requests);
  const spendDelta = spendVsPreviousMonth(monthly);
  const compliance = complianceRate(requests);
  const avgApproval = avgApprovalTimeHours(requests);
  const statusVolume = requestsByStatus(requests);
  const sectorSpend = spendBySector(requests);
  const sectorVolume = requestVolumeBySector(requests);
  const tripPurpose = tripPurposeBreakdown(requests);
  const outOfPolicy = recentOutOfPolicy(requests);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Painel</h1>

      <StatCards
        totalSpend={spendDelta.current}
        spendDeltaPct={spendDelta.deltaPct}
        complianceRatePct={compliance.ratePct}
        avgApprovalTimeHours={avgApproval}
        totalRequests={requests.length}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SpendChart data={monthly} />
        </div>
        <OutOfPolicyPanel requests={outOfPolicy} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <StatusVolumeChart data={statusVolume} />
        <SectorSpendChart data={sectorSpend} />
        <TripPurposeChart data={tripPurpose} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectorVolumeChart data={sectorVolume} />
        <SectorHeadcountChart data={headcount} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

Run: `cd travel-app && npm run dev`, log in as `admin@demo.com`, open `/admin`. Confirm: "Gasto por setor", "Volume de solicitações por setor", and "Funcionários por setor" all render with 4 bars each (Produto/Marketing/Engenharia/Founders), no console errors.

- [ ] **Step 4: Commit**

```bash
git add travel-app/src/components/admin/spend-breakdown-charts.tsx travel-app/src/app/admin/page.tsx
git commit -m "feat: replace cost-center chart with spend/volume/headcount-by-sector charts on Painel"
```

---

## Task 7: Relatórios — Setor column on the employee ranking table

**Files:**
- Modify: `travel-app/src/app/admin/reports/page.tsx`
- Modify: `travel-app/src/components/admin/employee-ranking-table.tsx`

**Interfaces:**
- Consumes: `getSectorBadge` from `@/lib/badge-variants`

- [ ] **Step 1: Select `cost_center` in the join on the Relatórios page**

```ts
// travel-app/src/app/admin/reports/page.tsx (line 10)
  const { data: rows } = await supabase
    .from("requests")
    .select("*, profiles(full_name, cost_center)")
    .order("created_at", { ascending: true });
```

- [ ] **Step 2: Carry `sector` through the ranking row and render a Setor column**

Replace the full contents of `travel-app/src/components/admin/employee-ranking-table.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmployeeDetail } from "@/components/admin/employee-detail";
import { outOfPolicyByEmployee, spendByEmployee } from "@/lib/admin-analytics";
import { getSectorBadge, type Sector } from "@/lib/badge-variants";
import { formatCurrency } from "@/lib/offer-format";
import { initialsFromName } from "@/lib/utils";
import type { AdminQueueRequest } from "@/lib/requests-mapper";

type SortColumn = "spend" | "violations";

interface EmployeeRankingRow {
  employeeId: string;
  name: string;
  sector: Sector;
  totalSpend: number;
  violationCount: number;
}

export function EmployeeRankingTable({ requests }: { requests: AdminQueueRequest[] }) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const sectorByEmployee = useMemo(() => {
    const map = new Map<string, Sector>();
    for (const request of requests) {
      if (!map.has(request.employee_id)) map.set(request.employee_id, request.employeeSector);
    }
    return map;
  }, [requests]);

  const rows = useMemo<EmployeeRankingRow[]>(() => {
    const spend = spendByEmployee(requests);
    const violations = outOfPolicyByEmployee(requests);
    const byEmployee = new Map<string, EmployeeRankingRow>();

    for (const entry of spend) {
      byEmployee.set(entry.employeeId, {
        employeeId: entry.employeeId,
        name: entry.name,
        sector: sectorByEmployee.get(entry.employeeId) ?? "engineering",
        totalSpend: entry.total,
        violationCount: 0,
      });
    }
    for (const entry of violations) {
      const existing = byEmployee.get(entry.employeeId);
      if (existing) {
        existing.violationCount = entry.count;
      } else {
        byEmployee.set(entry.employeeId, {
          employeeId: entry.employeeId,
          name: entry.name,
          sector: sectorByEmployee.get(entry.employeeId) ?? "engineering",
          totalSpend: 0,
          violationCount: entry.count,
        });
      }
    }
    return Array.from(byEmployee.values());
  }, [requests, sectorByEmployee]);

  const sortedRows = useMemo(() => {
    const factor = sortDir === "desc" ? -1 : 1;
    const key: keyof EmployeeRankingRow = sortColumn === "spend" ? "totalSpend" : "violationCount";
    return [...rows].sort((a, b) => (Number(a[key]) - Number(b[key])) * factor);
  }, [rows, sortColumn, sortDir]);

  function handleSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDir((dir) => (dir === "desc" ? "asc" : "desc"));
    } else {
      setSortColumn(column);
      setSortDir("desc");
    }
  }

  const selectedEmployee = sortedRows.find((row) => row.employeeId === selectedEmployeeId);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Ranking de funcionários</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>
                  <button type="button" onClick={() => handleSort("spend")} className="flex items-center gap-1 font-medium">
                    Gasto total <ArrowUpDown className="size-3.5" />
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => handleSort("violations")} className="flex items-center gap-1 font-medium">
                    Desvios de política <ArrowUpDown className="size-3.5" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => {
                const sectorBadge = getSectorBadge(row.sector);
                return (
                  <TableRow
                    key={row.employeeId}
                    data-state={row.employeeId === selectedEmployeeId ? "selected" : undefined}
                    onClick={() => setSelectedEmployeeId(row.employeeId)}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback>{initialsFromName(row.name)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-foreground">{row.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={sectorBadge.variant}>{sectorBadge.label}</Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(row.totalSpend, "BRL")}</TableCell>
                    <TableCell>{row.violationCount}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedEmployee ? (
        <EmployeeDetail
          employeeId={selectedEmployee.employeeId}
          employeeName={selectedEmployee.name}
          requests={requests}
        />
      ) : null}
    </div>
  );
}
```

Note: `sectorByEmployee` derives sector from the employee's *most recently created* request (`toAdminQueueRequest`'s frozen `employeeSector`), not a live join to `profiles`. That's consistent with Task 4's design (sector is a per-request-time snapshot) and is good enough here since it's a fallback lookup for display — the authoritative "current sector" view for a person lives on the Funcionários tab (Task 3), which reads `profiles.cost_center` directly.

- [ ] **Step 3: Manual verification**

Run: `cd travel-app && npm run dev`, log in as `admin@demo.com`, open `/admin/reports`. Confirm a "Setor" column with badges appears between "Funcionário" and "Gasto total".

- [ ] **Step 4: Commit**

```bash
git add travel-app/src/app/admin/reports/page.tsx travel-app/src/components/admin/employee-ranking-table.tsx
git commit -m "feat: show employee sector on the Relatórios ranking table"
```

---

## Task 8: Admin settings — per-sector policy editor

**Files:**
- Create: `travel-app/src/app/api/admin/policy-rules/[sector]/route.ts`
- Create: `travel-app/src/components/admin/policy-rules-form.tsx`
- Modify: `travel-app/src/app/admin/settings/page.tsx`

**Interfaces:**
- Consumes: `PolicyRuleRow` from `@/lib/policy-rules`, `SECTOR_LABELS` from `@/lib/badge-variants`

- [ ] **Step 1: PATCH route for one sector's policy row**

```ts
// travel-app/src/app/api/admin/policy-rules/[sector]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SECTORS } from "@/lib/badge-variants";

export async function PATCH(request: Request, { params }: { params: { sector: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();
  if (!adminProfile || adminProfile.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem alterar a política de viagem." },
      { status: 403 }
    );
  }

  if (!SECTORS.includes(params.sector as (typeof SECTORS)[number])) {
    return NextResponse.json({ error: "Setor inválido." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const domesticCapBRL = Number(body?.domesticCapBRL);
  const internationalCapBRL = Number(body?.internationalCapBRL);
  const longHaulCabinHours = Number(body?.longHaulCabinHours);
  const costFlagBRL = Number(body?.costFlagBRL);

  if (
    [domesticCapBRL, internationalCapBRL, longHaulCabinHours, costFlagBRL].some(
      (n) => !Number.isFinite(n) || n < 0
    )
  ) {
    return NextResponse.json({ error: "Valores de política inválidos." }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("policy_rules")
    .update({
      domestic_cap_brl: domesticCapBRL,
      international_cap_brl: internationalCapBRL,
      long_haul_cabin_hours: longHaulCabinHours,
      cost_flag_brl: costFlagBRL,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", adminProfile.organization_id)
    .eq("sector", params.sector)
    .select("*")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Não foi possível salvar a política." }, { status: 500 });
  }

  return NextResponse.json({ rule: updated });
}
```

- [ ] **Step 2: Client form component, one card per sector**

```tsx
// travel-app/src/components/admin/policy-rules-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SECTOR_LABELS } from "@/lib/badge-variants";
import type { PolicyRuleRow } from "@/lib/policy-rules";

function SectorPolicyCard({ rule }: { rule: PolicyRuleRow }) {
  const router = useRouter();
  const [values, setValues] = useState({
    domesticCapBRL: rule.domestic_cap_brl,
    internationalCapBRL: rule.international_cap_brl,
    longHaulCabinHours: rule.long_haul_cabin_hours,
    costFlagBRL: rule.cost_flag_brl,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/policy-rules/${rule.sector}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error ?? "Não foi possível salvar a política.");
        return;
      }
      toast.success("Política atualizada.");
      router.refresh();
    } catch {
      toast.error("Não foi possível salvar a política.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{SECTOR_LABELS[rule.sector]}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Teto doméstico (R$)</Label>
            <Input
              type="number"
              min={0}
              value={values.domesticCapBRL}
              onChange={(e) => setValues((v) => ({ ...v, domesticCapBRL: Number(e.target.value) }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Teto internacional (R$)</Label>
            <Input
              type="number"
              min={0}
              value={values.internationalCapBRL}
              onChange={(e) => setValues((v) => ({ ...v, internationalCapBRL: Number(e.target.value) }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Horas mín. p/ classe executiva</Label>
            <Input
              type="number"
              min={0}
              value={values.longHaulCabinHours}
              onChange={(e) => setValues((v) => ({ ...v, longHaulCabinHours: Number(e.target.value) }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Sinalizar custo elevado acima de (R$)</Label>
            <Input
              type="number"
              min={0}
              value={values.costFlagBRL}
              onChange={(e) => setValues((v) => ({ ...v, costFlagBRL: Number(e.target.value) }))}
            />
          </div>
        </div>
        <Button size="sm" className="w-fit" disabled={saving} onClick={handleSave}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function PolicyRulesForm({ rules }: { rules: PolicyRuleRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {rules.map((rule) => (
        <SectorPolicyCard key={rule.sector} rule={rule} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Replace the settings page placeholder**

```tsx
// travel-app/src/app/admin/settings/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PolicyRulesForm } from "@/components/admin/policy-rules-form";
import { EmptyState } from "@/components/ui/empty-state";
import type { PolicyRuleRow } from "@/lib/policy-rules";

export default async function AdminSettingsPage() {
  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase.from("policy_rules").select("*").order("sector", { ascending: true });
  const rules = (rows ?? []) as PolicyRuleRow[];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-foreground">Configurações</h1>
      <div>
        <h2 className="text-base font-semibold text-foreground">Política de viagem por setor</h2>
        <p className="text-sm text-muted-foreground">
          Cada setor tem seus próprios tetos de gasto e regras de classe executiva. Alterações valem para novas
          solicitações a partir de agora.
        </p>
      </div>
      {rules.length === 0 ? (
        <EmptyState title="Nenhuma política de viagem cadastrada ainda" />
      ) : (
        <PolicyRulesForm rules={rules} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

Run: `cd travel-app && npm run dev`, log in as `admin@demo.com`, open `/admin/settings`. Confirm: 4 cards (Produto/Marketing/Engenharia/Founders), each pre-filled with `3500`/`12000`/`8`/`8000`; edit one field on one card, click Salvar, confirm the toast succeeds and the value persists after a page reload.

- [ ] **Step 5: Commit**

```bash
git add travel-app/src/app/api/admin/policy-rules/[sector]/route.ts travel-app/src/components/admin/policy-rules-form.tsx travel-app/src/app/admin/settings/page.tsx
git commit -m "feat: add per-sector travel policy editor to Configurações"
```

---

## Task 9: Seed script — assign a sector per employee, freeze it into requests

**Files:**
- Modify: `travel-app/scripts/seed-demo-data.ts`

- [ ] **Step 1: Replace `COST_CENTERS` with the fixed sector list, assign one sector per employee, and freeze it into every request they generate**

```ts
// travel-app/scripts/seed-demo-data.ts
import { createClient } from "@supabase/supabase-js";
import { fakerPT_BR as faker } from "@faker-js/faker";
import type { TravelRequestStatus, TripPurpose } from "../src/lib/types";
import type { Sector } from "../src/lib/badge-variants";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (.env.local) antes de rodar o seed."
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ORG_NAME = "Paggo (Demo)";
const DEMO_EMPLOYEE_ID = "39557140-a4c1-46cc-803e-021b433332ab";
const REQUESTS_PER_EMPLOYEE = 12;

const SECTORS: Sector[] = ["product", "marketing", "engineering", "founders"];
const TRIP_PURPOSES: TripPurpose[] = ["client_meeting", "conference", "internal_meeting", "training", "other"];
const CARRIERS = [
  { iata_code: "LA", name: "LATAM" },
  { iata_code: "G3", name: "Gol" },
  { iata_code: "AD", name: "Azul" },
];
const ROUTES: Array<{ origin: string; destination: string; international: boolean }> = [
  { origin: "GRU", destination: "GIG", international: false },
  { origin: "GRU", destination: "BSB", international: false },
  { origin: "GRU", destination: "CNF", international: false },
  { origin: "GRU", destination: "SSA", international: false },
  { origin: "GRU", destination: "JFK", international: true },
  { origin: "GRU", destination: "MIA", international: true },
];

// Maioria confirmed/approved, com alguns pending_admin/rejected/cancelled — mistura realista.
const STATUS_POOL: TravelRequestStatus[] = [
  "confirmed", "confirmed", "confirmed",
  "approved", "approved", "approved",
  "pending_admin", "pending_admin",
  "rejected",
  "cancelled",
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomDateWithinLastMonths(months: number): Date {
  const now = Date.now();
  const past = now - months * 30 * 24 * 60 * 60 * 1000;
  return new Date(past + Math.random() * (now - past));
}

async function createEmployee(organizationId: string): Promise<{ id: string; fullName: string; sector: Sector }> {
  const fullName = faker.person.fullName();
  const email = faker.internet
    .email({ firstName: fullName.split(" ")[0], provider: "demo-paggo.com" })
    .toLowerCase();
  const sector = pick(SECTORS);

  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email,
    password: "Employee#Demo2026",
    email_confirm: true,
  });
  if (userError || !userData.user) {
    throw new Error(`Falha ao criar usuário ${email}: ${userError?.message}`);
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: userData.user.id,
    organization_id: organizationId,
    role: "employee",
    full_name: fullName,
    cost_center: sector,
  });
  if (profileError) {
    throw new Error(`Falha ao criar profile para ${email}: ${profileError.message}`);
  }

  console.log(`Criado employee: ${fullName} <${email}> (${sector})`);
  return { id: userData.user.id, fullName, sector };
}

function buildRequest(employeeId: string, organizationId: string, sector: Sector) {
  const status = pick(STATUS_POOL);
  const route = pick(ROUTES);
  const carrier = pick(CARRIERS);
  const compliant = Math.random() > 0.25; // ~25% fora de política
  const basePrice = route.international ? 4500 + Math.random() * 6000 : 400 + Math.random() * 3200;
  const totalAmount = Number((compliant ? basePrice : basePrice + 3000 + Math.random() * 4000).toFixed(2));
  const createdAt = randomDateWithinLastMonths(6);
  const purpose = pick(TRIP_PURPOSES);
  const cap = route.international ? 12000 : 3500;

  const events: Array<{ at: string; kind: string }> = [{ at: createdAt.toISOString(), kind: "created" }];
  if (status !== "pending_admin") {
    const resolvedAt = new Date(createdAt.getTime() + (2 + Math.random() * 46) * 60 * 60 * 1000);
    const kind = status === "rejected" ? "rejected" : status === "cancelled" ? "cancelled" : "approved";
    events.push({ at: resolvedAt.toISOString(), kind });
    if (status === "confirmed") {
      events.push({ at: new Date(resolvedAt.getTime() + 60 * 60 * 1000).toISOString(), kind: "confirmed" });
    }
  }

  return {
    organization_id: organizationId,
    employee_id: employeeId,
    status,
    total_amount: totalAmount,
    total_currency: "BRL",
    created_at: createdAt.toISOString(),
    search_criteria: {
      slices: [{ origin: route.origin, destination: route.destination, departure_date: createdAt.toISOString().slice(0, 10) }],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
    },
    selected_offer_snapshot: {
      offer_id: `off_seed_${faker.string.alphanumeric(10)}`,
      total_amount: totalAmount.toFixed(2),
      total_currency: "BRL",
      owner: { iata_code: carrier.iata_code, name: carrier.name, logo_symbol_url: "" },
      slices: [
        {
          origin: route.origin,
          destination: route.destination,
          departure_datetime: createdAt.toISOString(),
          arrival_datetime: new Date(createdAt.getTime() + 3 * 60 * 60 * 1000).toISOString(),
          duration: "PT3H00M",
          segments_count: 1,
        },
      ],
      conditions: {
        refund_before_departure: { allowed: false },
        change_before_departure: { allowed: true, penalty_amount: "150.00", penalty_currency: "BRL" },
      },
      passenger_identity_documents_required: route.international,
      expires_at: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    },
    passengers: [],
    corporate: {
      trip_purpose: purpose,
      cost_center: sector,
      business_justification: faker.lorem.sentence(),
      ...(compliant ? {} : { out_of_policy_justification: faker.lorem.sentence() }),
    },
    policy_evaluation: {
      compliant,
      violations: compliant
        ? []
        : [
            {
              rule_id: "cost-cap",
              message: `Preço R$ ${totalAmount.toFixed(2)} excede o teto de R$ ${cap.toFixed(2)} para voos ${
                route.international ? "internacionais" : "domésticos"
              }.`,
              field: "totalAmount",
              expected: `<= ${cap}`,
              actual: String(totalAmount),
            },
          ],
      flags: {
        international_travel: route.international,
        cost_above_threshold: !compliant,
      },
    },
    events,
  };
}

async function main() {
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", ORG_NAME)
    .single();
  if (orgError || !org) {
    throw new Error(`Organização seed "${ORG_NAME}" não encontrada — rode a migração 0001_init.sql primeiro.`);
  }

  const { data: demoProfile, error: demoProfileError } = await supabase
    .from("profiles")
    .select("cost_center")
    .eq("id", DEMO_EMPLOYEE_ID)
    .single();
  if (demoProfileError || !demoProfile) {
    throw new Error(
      `Profile demo ${DEMO_EMPLOYEE_ID} não encontrado — rode 0005_employee_sectors.sql antes do seed.`
    );
  }

  const newEmployees = await Promise.all([
    createEmployee(org.id),
    createEmployee(org.id),
    createEmployee(org.id),
    createEmployee(org.id),
  ]);
  const employees: Array<{ id: string; sector: Sector }> = [
    { id: DEMO_EMPLOYEE_ID, sector: demoProfile.cost_center as Sector },
    ...newEmployees.map((e) => ({ id: e.id, sector: e.sector })),
  ];

  const requests = employees.flatMap(({ id, sector }) =>
    Array.from({ length: REQUESTS_PER_EMPLOYEE }, () => buildRequest(id, org.id, sector))
  );

  const { error: insertError } = await supabase.from("requests").insert(requests);
  if (insertError) {
    throw new Error(`Falha ao inserir requests: ${insertError.message}`);
  }

  console.log(`Seed concluído: ${newEmployees.length} employees novos, ${requests.length} requests criadas.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Manual verification**

Run: `cd travel-app && npm run seed` against a dev Supabase project that already has migration `0005_employee_sectors.sql` applied. Confirm the script logs each new employee with a sector in parentheses, and completes without error.

- [ ] **Step 3: Commit**

```bash
git add travel-app/scripts/seed-demo-data.ts
git commit -m "feat: assign and freeze employee sector in demo seed data"
```

---

## Task 10: Full-repo sweep and final verification

**Files:** none new — verification only.

- [ ] **Step 1: Grep for stale references to the old free-text values**

Run: `cd travel-app && grep -rn "Engenharia\|Vendas\|Produto\|Operações\|Diretoria\|COST_CENTERS" src/ scripts/ --include="*.ts" --include="*.tsx"`

Expected: no matches (every occurrence should have been removed in Tasks 4 and 9). If any remain, fix them following the pattern established in this plan (English `Sector` value + `SECTOR_LABELS` for display).

- [ ] **Step 2: Run the full test suite**

Run: `cd travel-app && npm test`
Expected: all tests pass, including the new `policy-rules.test.ts` and the updated `admin-analytics.test.ts`, `corporate-schema.test.ts`, `requests-mapper.test.ts`.

- [ ] **Step 3: Run the type checker**

Run: `cd travel-app && npx tsc --noEmit`
Expected: no errors. Pay particular attention to any remaining `costCenter: string` typed usages that should now be narrowed to `Sector`.

- [ ] **Step 4: Full manual walkthrough**

Run: `cd travel-app && npm run dev`. As `employee@demo.com`: create one new trip request end-to-end and confirm no "Centro de custo" field appears and the request detail page shows "Setor: Engenharia". As `admin@demo.com`: visit `/admin` (3 sector charts render), `/admin/employees` (Setor column + filter + editable badge), `/admin/reports` (Setor column on ranking table), `/admin/settings` (4 editable policy cards).

- [ ] **Step 5: Final commit (only if Step 1 found and fixed stragglers)**

```bash
git add -A
git commit -m "chore: sweep remaining free-text cost-center references"
```
