# Admin Analytics Dashboard — Design

**Goal:** substituir os dois placeholders "em construção" (`src/app/admin/page.tsx` e `src/app/admin/reports/page.tsx`) por um painel de analytics real: visão geral de gastos/compliance da empresa em `/admin`, e um drill-down por funcionário em `/admin/reports`. Inclui também um script de seed para popular dados de demonstração (4 novos employees + 6 meses de `requests` históricos), sem o que os gráficos ficariam vazios.

## Escopo

**Dentro do escopo:**
- `/admin` — KPIs da empresa inteira (gasto, compliance, volume por status, ranking de cost centers, trip purpose) + painel lateral com requests fora de política mais recentes.
- `/admin/reports` — ranking de funcionários por gasto e por desvio de política, com seletor de funcionário para ver o detalhe individual (linha do tempo de gasto + lista de requests fora de política daquela pessoa).
- Camada de agregação pura (`src/lib/admin-analytics.ts`), testável com Vitest.
- Componentes de UI novos: `ui/chart.tsx` e `ui/table.tsx` (ambos shadcn padrão, copiados verbatim — ver "Componentes de UI novos" abaixo), `admin/stat-cards.tsx`, `admin/spend-chart.tsx`, `admin/out-of-policy-panel.tsx`, `admin/employee-ranking-table.tsx`, `admin/employee-detail.tsx`.
- `scripts/seed-demo-data.ts` — cria 4 profiles `employee` novos + `requests` dos últimos 6 meses para os 5 employees (o demo + os 4 novos).
- Dependência nova: `recharts` (pin `2.15.4`, mesma versão usada em `paggo-university-prototypes`). Dev-dependência nova: `@faker-js/faker` (só usada no seed script).

**Fora de escopo (v2):**
- Budget/limite fixo por pessoa ou cost center (não existe hoje; usuário confirmou que não é o modelo do produto).
- Filtro de período customizável (date range picker) — período fixo em "últimos 6 meses" por enquanto.
- Nacional vs. internacional, ticket médio, taxa de aprovação/rejeição individual, cost center predominante por pessoa (KPIs "Tier 3", adiados).
- Exportação (CSV/PDF) dos relatórios.
- Qualquer mudança em `src/lib/policy.ts` (Policy Engine) ou no formato de `policy_evaluation` — o dashboard só lê o que já existe.

## Decisões confirmadas com o usuário

1. **Sem tabela de budget.** O controle de gasto é só o que já existe: `policy_evaluation.compliant` / `flags.cost_above_threshold` (a regra de "até X% acima da oferta mais barata"). KPIs de "gasto realizado + desvio de política", não "% de budget consumido".
2. **KPIs priorizados (Tier 1, entram nesta v1):** gasto total + variação vs. mês anterior; gasto mensal (6 meses); taxa de compliance; ranking de gasto por funcionário; ranking de desvios de política por funcionário; volume de solicitações por status.
3. **Tier 2 (também entram nesta v1):** ranking de cost centers por gasto; tabela de requests fora de política com `out_of_policy_justification`; tempo médio de aprovação (via `events[]`); distribuição por trip purpose.
4. **Seed:** 4 novos profiles `employee` + 6 meses de `requests` fake (mistura realista de status, compliance, cost center, trip purpose) para os 5 employees.
5. **Stack de gráfico:** Recharts via `@/components/ui/chart` (shadcn padrão) — confirmado como o mesmo padrão usado em `paggo-university-prototypes` (`stat-cards.tsx`, `volume-chart.tsx`, `recent-activity.tsx`), que por sua vez é o playground que vira `@paggo/ui` em produção.
6. **Sem migration nova.** `requests_select_own_or_admin` (0001) e `profiles_select_org_admin` (0003) já dão ao admin SELECT de todos os requests/profiles da organização — suficiente para toda leitura deste painel.

## Arquitetura

**Camada de dados — Server Components, sem Route Handler novo** (mesmo padrão de `src/app/admin/requests/page.tsx`):
- `admin/page.tsx` e `admin/reports/page.tsx` buscam via `createSupabaseServerClient()` (RLS real, não filtro manual): `select("*, profiles(full_name)")` na tabela `requests`, ordenado por `created_at`.
- As linhas viram `AdminQueueRequest[]` via `toAdminQueueRequest` (já existe em `requests-mapper.ts` — reaproveitado sem alteração).
- O resultado é passado para as funções puras de `src/lib/admin-analytics.ts`, e o output já agregado desce como props para Client Components de gráfico/tabela.

**`src/lib/admin-analytics.ts` — funções puras, uma por KPI, todas recebendo `AdminQueueRequest[]`:**
- `monthlySpend(requests, months = 6)` → `{ month: string; total: number }[]`
- `spendVsPreviousMonth(monthly)` → `{ current: number; deltaPct: number }` (deriva do array acima, não refaz a soma)
- `complianceRate(requests)` → `{ compliantCount: number; nonCompliantCount: number; ratePct: number }`
- `spendByEmployee(requests)` → `{ employeeId; name; total }[]`, desc
- `outOfPolicyByEmployee(requests)` → `{ employeeId; name; count }[]`, desc
- `spendByCostCenter(requests)` → `{ costCenter; total }[]`, desc
- `requestsByStatus(requests)` → `{ status: TravelRequestStatus; count }[]`
- `avgApprovalTimeHours(requests)` → `number`, calculado da diferença entre o evento `created` e o primeiro de `approved`/`rejected` em `events[]`, média só sobre requests que já têm os dois.
- `tripPurposeBreakdown(requests)` → `{ purpose: TripPurpose; count }[]`
- `recentOutOfPolicy(requests, limit = 5)` → as `limit` requests não-compliant mais recentes, já no formato que o painel lateral consome.

Cada função é pura (entrada/saída sem I/O), com teste Vitest co-localizado (`admin-analytics.test.ts`) usando fixtures pequenas — não depende de mock de banco.

**`src/components/ui/chart.tsx`** — cópia verbatim do `chart.tsx` do shadcn/ui (confirmado idêntico ao usado em `paggo-university-prototypes/src/components/ui/chart.tsx`): `ChartContainer`, `ChartConfig`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`. Cores via `--chart-1`..`--chart-5` (já existem em `paggo-shadcn-vars.css`, hoje sem nenhum consumidor).

**`src/components/ui/table.tsx`** — cópia verbatim do `table.tsx` do shadcn/ui (mesmo componente usado em `recent-activity.tsx` do repo de referência).

## Seed script — `scripts/seed-demo-data.ts`

Estende o que `docs/SchemaGuide.md` (seção 8) já previa e nunca foi escrito. Roda com `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` do ambiente (mesmo par de credenciais que os Route Handlers admin já usam implicitamente via Supabase Admin API — igual ao processo manual descrito na seção 6 do guia).

Passos:
1. Cria 4 `auth.users` (Admin API, `email_confirm: true`) + 4 linhas em `profiles` (`role: "employee"`, `organization_id` da org seed), com nomes gerados por `@faker-js/faker` (locale `pt_BR`).
2. Para os 5 employees (4 novos + o demo `employee@demo.com`), gera `requests` distribuídas nos últimos 6 meses: mistura de `status` (maioria `confirmed`/`approved`, alguns `pending_admin`/`rejected`/`cancelled`), `corporate.cost_center` variado (3–4 valores fixos, ex. "Engenharia", "Vendas", "Marketing"), `corporate.trip_purpose` variado, e `policy_evaluation.compliant` com ~20–30% `false` (com `flags.cost_above_threshold: true` e `violations` preenchido) para dar dado real aos KPIs de compliance.
3. Script é idempotente o suficiente para rodar uma vez em ambiente de demo — não precisa suportar re-run incremental (é seed, não migration).

## Componentes por página

**`/admin` (visão geral):**
- `admin/stat-cards.tsx` — 4 cards (gasto total + variação, compliance rate, tempo médio de aprovação, volume total de requests), modelado em `stat-cards.tsx` do repo de referência: `Card`/`CardHeader`/`CardContent`/`CardTitle`/`CardDescription` + `Badge` de variação.
- `admin/spend-chart.tsx` — gráfico de área (gasto mensal, 6 meses), modelado em `volume-chart.tsx`: `ChartContainer` + `AreaChart` do Recharts.
- `admin/out-of-policy-panel.tsx` — painel lateral (`Table` dentro de `Card`), modelado em `recent-activity.tsx`: últimos requests fora de política, com `Badge` de status reaproveitando `getDuffelPolicyBadge`/`getDuffelFlagBadges` de `lib/badge-variants.ts`.
- Duas seções adicionais abaixo do grid principal: gráfico de barra (volume por status) e gráfico de barra horizontal (ranking cost centers) + pizza/barra (trip purpose) — mesmos primitivos de `ui/chart.tsx`.
- Layout: header simples (`h1`) → `stat-cards` → grid `xl:grid-cols-3` (gráfico de gasto ocupa 2 colunas + painel lateral na 3ª) → seções de barra abaixo, seguindo a composição de `inicio-page.tsx`.

**`/admin/reports` (por funcionário):**
- `admin/employee-ranking-table.tsx` — tabela (`ui/table.tsx`) com `Avatar`+nome (reaproveitando `initialsFromName`, já usado em `requests-queue.tsx`), gasto total, nº de desvios de política; ordenável por qualquer uma das duas colunas via clique no header.
- Seleção de funcionário: clique na linha da tabela seleciona (estado local, sem rota nova) e renderiza `admin/employee-detail.tsx` abaixo — linha do tempo de gasto individual (reaproveita `spend-chart` com dado filtrado) + lista de requests fora de política daquela pessoa (`PolicyBadges`, já existe, sem alteração).

## Interações e estados

- Nenhum filtro de data nesta v1 (período fixo 6 meses, decisão confirmada) — evita introduzir um `PaggoFilter`/date-range picker que a v1 não precisa.
- `/admin/reports`: nenhum funcionário selecionado por padrão → `employee-detail` não renderiza (estado vazio simples, sem placeholder de erro).
- Sem dado nenhum (organização nova, sem requests) → `EmptyState` já existente no lugar dos gráficos, mesmo padrão de `RequestsQueue`.
- Nenhuma mutação nesta feature — tudo é leitura, então não há toasts de erro de API a tratar (diferente do painel de aprovação).

## Testes

Mesmo precedente do spec anterior (`2026-07-10-travel-admin-approval-panel-design.md`): sem setup de teste de renderização React neste projeto. `src/lib/admin-analytics.ts` (lógica pura) ganha teste Vitest co-localizado cobrindo cada função com fixtures pequenas (incluindo casos de borda: nenhum request, request sem par `approved`/`rejected` em `events` para `avgApprovalTimeHours`, mês sem nenhum request em `monthlySpend`). Páginas/componentes verificados via `npm run build`, `npm run lint` e checklist manual (rodar o seed script localmente, abrir `/admin` e `/admin/reports`, conferir que os números batem com os dados gerados).
