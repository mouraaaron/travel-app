# Histórico de Solicitações por Funcionário — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** adicionar uma aba "Todas" ao painel de funcionário em Relatórios, mostrando o histórico completo (todos os status) das solicitações de viagem daquele funcionário, com link pra cada detalhe.

**Architecture:** um componente novo (`EmployeeRequestsTable`) renderiza a lista completa, reaproveitando dados/formatação já existentes. `EmployeeDetail` passa a organizar seu conteúdo (gráfico de gasto, desvios de política, e a nova lista completa) em três `Tabs`, com "Todas" como padrão. Nenhuma mudança de backend, query ou rota.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Radix UI (`@/components/ui/tabs`, `@/components/ui/table`), Tailwind.

## Global Constraints

- Não mudar `src/app/admin/reports/page.tsx`, `src/components/admin/requests-queue.tsx`, nem qualquer rota/API.
- Sem filtro de status, busca ou paginação na aba "Todas" — lista completa ordenada por `created_at` desc.
- Sem teste automatizado de componente — o projeto não tem `jsdom`/Testing Library (`vitest.config.ts` roda com `environment: "node"`), e nenhum componente em `src/components/admin` tem teste hoje. Verificação é manual (dev server + navegador), não `pytest`/`vitest` de componente.
- Linha da tabela navega para `/admin/requests/[id]` via `router.push` no `onClick` da `TableRow` (padrão já usado em `src/components/admin/employees-table.tsx:122-126`), não via `<Link>` envolvendo a linha.
- Referência da spec: `docs/superpowers/specs/2026-07-15-employee-request-history-design.md`.

---

### Task 1: Criar `EmployeeRequestsTable`

**Files:**
- Create: `src/components/admin/employee-requests-table.tsx`

**Interfaces:**
- Consumes: `AdminQueueRequest` (tipo existente, `src/lib/requests-mapper.ts:43-46` — tem `id`, `status: TravelRequestStatus`, `created_at: string`, `employee_id: string`, `selected_offer_snapshot: { total_amount: string; total_currency: string; slices: Array<{ origin: string; destination: string }> }`); `RequestStatusBadge` (`src/components/trip/request-status-badge.tsx`); `getRouteLabel`, `formatCurrency`, `formatDate` (`src/lib/offer-format.ts`); `EmptyState` (`src/components/ui/empty-state.tsx`); `Card`/`CardContent`/`CardHeader`/`CardTitle` (`src/components/ui/card.tsx`); `Table`/`TableBody`/`TableCell`/`TableHead`/`TableHeader`/`TableRow` (`src/components/ui/table.tsx`).
- Produces: `export function EmployeeRequestsTable({ requests }: { requests: AdminQueueRequest[] }): JSX.Element` — usado pelo Task 2.

- [ ] **Step 1: Criar o arquivo do componente**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RequestStatusBadge } from "@/components/trip/request-status-badge";
import { formatCurrency, formatDate, getRouteLabel } from "@/lib/offer-format";
import type { AdminQueueRequest } from "@/lib/requests-mapper";

export function EmployeeRequestsTable({ requests }: { requests: AdminQueueRequest[] }) {
  const router = useRouter();
  const sorted = [...requests].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Todas as solicitações</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <EmptyState icon={Inbox} title="Nenhuma solicitação registrada" size="tiny" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rota</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((request) => {
                const snapshot = request.selected_offer_snapshot;
                const { origin, destination } = getRouteLabel(snapshot.slices);
                return (
                  <TableRow
                    key={request.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/requests/${request.id}`)}
                  >
                    <TableCell>
                      {origin} → {destination}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(Number(snapshot.total_amount), snapshot.total_currency)}
                    </TableCell>
                    <TableCell>
                      <RequestStatusBadge status={request.status} />
                    </TableCell>
                    <TableCell>{formatDate(request.created_at)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verificar que o TypeScript compila**

Run: `npx tsc --noEmit`
Expected: sem erros relacionados a `employee-requests-table.tsx` (o projeto pode já ter avisos preexistentes em outros arquivos não relacionados — ignore-os; se `employee-requests-table.tsx` aparecer na saída, corrija antes de prosseguir).

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/employee-requests-table.tsx
git commit -m "feat: add EmployeeRequestsTable component"
```

---

### Task 2: Reorganizar `EmployeeDetail` em abas e integrar a nova tabela

**Files:**
- Modify: `src/components/admin/employee-detail.tsx` (arquivo inteiro — 83 linhas hoje)

**Interfaces:**
- Consumes: `EmployeeRequestsTable` do Task 1 (`src/components/admin/employee-requests-table.tsx`, prop `requests: AdminQueueRequest[]`); `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` (`src/components/ui/tabs.tsx` — `TabsList` aceita prop `indicator?: boolean`, default `true`; usar `indicator={false}` para o estilo de abas segmentadas, igual ao já usado em `src/components/admin/requests-queue.tsx:55`).
- Produces: nenhuma interface nova exportada — `EmployeeDetail` continua com a mesma assinatura de props (`employeeId`, `employeeName`, `requests`) já usada por `src/components/admin/employee-ranking-table.tsx:143-147`.

- [ ] **Step 1: Substituir o conteúdo de `employee-detail.tsx`**

```tsx
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeRequestsTable } from "@/components/admin/employee-requests-table";
import { SpendChart } from "@/components/admin/spend-chart";
import { monthlySpend } from "@/lib/admin-analytics";
import { getDuffelFlagBadges } from "@/lib/badge-variants";
import { formatCurrency, formatDate, getRouteLabel } from "@/lib/offer-format";
import type { AdminQueueRequest } from "@/lib/requests-mapper";

interface EmployeeDetailProps {
  employeeId: string;
  employeeName: string;
  requests: AdminQueueRequest[];
}

export function EmployeeDetail({ employeeId, employeeName, requests }: EmployeeDetailProps) {
  const employeeRequests = requests.filter((request) => request.employee_id === employeeId);
  const monthly = monthlySpend(employeeRequests);
  const outOfPolicy = [...employeeRequests]
    .filter((request) => !request.policy_evaluation.compliant)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <Tabs defaultValue="all">
      <TabsList indicator={false}>
        <TabsTrigger value="all">Todas</TabsTrigger>
        <TabsTrigger value="spend">Gasto mensal</TabsTrigger>
        <TabsTrigger value="violations">Desvios de política</TabsTrigger>
      </TabsList>

      <TabsContent value="all">
        <EmployeeRequestsTable requests={employeeRequests} />
      </TabsContent>

      <TabsContent value="spend">
        <SpendChart data={monthly} title="Gasto mensal" description={employeeName} />
      </TabsContent>

      <TabsContent value="violations">
        <Card>
          <CardHeader>
            <CardTitle>Desvios de política — {employeeName}</CardTitle>
          </CardHeader>
          <CardContent>
            {outOfPolicy.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="Nenhum desvio de política" size="tiny" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rota</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outOfPolicy.map((request) => {
                    const snapshot = request.selected_offer_snapshot;
                    const { origin, destination } = getRouteLabel(snapshot.slices);
                    const flagBadges = getDuffelFlagBadges(request.policy_evaluation);
                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span>
                              {origin} → {destination}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {flagBadges.map((badge) => (
                                <Badge key={badge.label} variant={badge.variant}>
                                  {badge.label}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatCurrency(Number(snapshot.total_amount), snapshot.total_currency)}
                        </TableCell>
                        <TableCell className="max-w-[220px] text-muted-foreground">
                          {request.corporate.out_of_policy_justification ?? "—"}
                        </TableCell>
                        <TableCell>{formatDate(request.created_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 2: Verificar que o TypeScript compila**

Run: `npx tsc --noEmit`
Expected: sem erros relacionados a `employee-detail.tsx` ou `employee-requests-table.tsx`.

- [ ] **Step 3: Verificação manual no navegador**

Run: `npm run dev` (deixar rodando; se a porta 3000 já estiver ocupada por outra instância, anotar a porta real que o Next reportar)

No navegador, autenticado como admin:
1. Acessar `/admin/reports`.
2. Clicar num funcionário do "Ranking de funcionários" que tenha pelo menos duas solicitações em status diferentes (ex.: uma aprovada e uma pendente — conferir em `/admin/requests` com filtro "Todas" + busca pelo nome, se precisar identificar um funcionário assim).
3. Confirmar que a aba **"Todas"** abre selecionada por padrão e lista todas as solicitações desse funcionário (não só as fora de política), ordenadas da mais recente para a mais antiga, cada uma com badge de status correto.
4. Clicar numa linha da lista e confirmar que navega para `/admin/requests/<id>` correto.
5. Voltar, clicar na aba **"Gasto mensal"** e confirmar que o gráfico aparece igual a antes da mudança.
6. Clicar na aba **"Desvios de política"** e confirmar que a tabela de desvios aparece igual a antes da mudança (mesmas colunas: Rota, Valor, Motivo, Data).
7. Parar o `npm run dev` (Ctrl+C) ao final.

Expected: os três passos acima passam sem erro no console do navegador nem no terminal do `npm run dev`.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/employee-detail.tsx
git commit -m "feat: add all-requests tab to employee report panel"
```
