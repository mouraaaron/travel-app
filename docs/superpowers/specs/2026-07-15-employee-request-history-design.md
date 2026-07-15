# Histórico de Solicitações por Funcionário — Design

**Goal:** hoje, em Relatórios, ao clicar num funcionário no "Ranking de funcionários" só é possível ver o gasto mensal agregado e as solicitações **fora de política** dele — não existe nenhuma visão com o histórico completo (todos os status) das solicitações de viagem de um funcionário. Esta mudança adiciona essa visão, dentro do painel que já existe.

## Escopo

**Dentro do escopo:**
- `src/components/admin/employee-detail.tsx`: passa a renderizar `Tabs`/`TabsList`/`TabsTrigger` (mesmo componente já usado em `src/components/admin/requests-queue.tsx`) com três abas — **Todas** (nova, selecionada por padrão), **Gasto mensal**, **Desvios de política** (as duas últimas com o conteúdo exatamente como já existe hoje, só realocado para dentro de uma aba).
- Novo componente `src/components/admin/employee-requests-table.tsx`: recebe `requests: AdminQueueRequest[]` (a mesma lista `employeeRequests` já filtrada por `employee_id` que `EmployeeDetail` já calcula hoje) e renderiza uma `Table` com colunas Rota / Valor / Status / Data, ordenada por `created_at` desc, uma linha por solicitação, sem filtro de status.
- Cada linha da nova tabela navega para `/admin/requests/[id]` (rota já existente) via `router.push` no `onClick` da `TableRow`, mesmo padrão já usado em `src/components/admin/employees-table.tsx` — não via `<Link>` envolvendo a linha.

**Fora de escopo:**
- Qualquer mudança em `src/app/admin/reports/page.tsx` — a query que já busca todas as requests de todos os funcionários não muda.
- Qualquer mudança em `src/components/admin/requests-queue.tsx` ou na fila de Solicitações (`/admin/requests`) — nenhuma refatoração de compartilhamento de componente entre a fila e este painel.
- Filtro por status, busca, paginação ou qualquer controle adicional na aba "Todas" — fica só a lista completa ordenada por data.
- Infraestrutura de teste de componente React (jsdom / Testing Library) — o projeto não tem isso hoje (`vitest.config.ts` roda com `environment: "node"`) e nenhum outro componente de `src/components/admin` tem teste; esta mudança não introduz essa infraestrutura.

## Decisões confirmadas com o usuário

1. A visão fica dentro do painel do funcionário em Relatórios (não uma página nova, não dentro da fila de Solicitações).
2. Layout em abas: "Todas" / "Gasto mensal" / "Desvios de política", com "Todas" como aba padrão.
3. Sem filtro de status na aba "Todas" — lista completa, ordenada por data (mais recente primeiro).
4. Cada linha é clicável e leva ao detalhe da solicitação (`/admin/requests/[id]`).
5. Sem novos testes automatizados — segue o padrão atual do projeto, onde nenhum componente de admin tem teste; não vale adicionar infraestrutura de teste de componente só para esta mudança.

## Arquitetura

### `src/components/admin/employee-requests-table.tsx` (novo)

- Props: `{ requests: AdminQueueRequest[] }`.
- Ordena `requests` por `created_at` desc (mesmo critério já usado para "Desvios de política" em `employee-detail.tsx`).
- Renderiza `Card` > `Table` com `TableHeader` (Rota, Valor, Status, Data) e uma `TableRow` por solicitação, reaproveitando sem alteração: `RequestStatusBadge` (`src/components/trip/request-status-badge.tsx`), `getRouteLabel`, `formatCurrency`, `formatDate` (`src/lib/offer-format.ts`).
- Lista vazia: `EmptyState` (mesmo componente já usado em "Desvios de política" e na página de Relatórios).
- Cada `TableRow` recebe `cursor-pointer` e `onClick={() => router.push(\`/admin/requests/${request.id}\`)}`, mesmo padrão já usado em `src/components/admin/employees-table.tsx:122-126` — não uma `<Link>` envolvendo a linha.

### `src/components/admin/employee-detail.tsx` (modificado)

- Import de `Tabs`, `TabsList`, `TabsTrigger` (`@/components/ui/tabs`) e do novo `EmployeeRequestsTable`.
- O grid `xl:grid-cols-2` atual deixa de existir: cada aba mostra um único bloco de conteúdo por vez. `TabsContent` de "Gasto mensal" renderiza só `<SpendChart .../>`; `TabsContent` de "Desvios de política" renderiza só o `Card` com a tabela de desvios (JSX de ambos inalterado, só removidos do grid e movidos para dentro da respectiva `TabsContent`).
- Nova aba "Todas": `<EmployeeRequestsTable requests={employeeRequests} />`.
- `employeeRequests` (o filtro por `employee_id`) continua calculado uma vez no topo do componente, como hoje — as três abas consomem a mesma variável.

## Fluxo de dados

Sem mudanças de backend. `AdminReportsPage` já busca todas as requests de todos os funcionários numa única query (`src/app/admin/reports/page.tsx`); `EmployeeDetail` já filtra esse array por `employee_id` no client. A aba "Todas" reaproveita exatamente esse array filtrado — mesma fonte de dados que já alimenta o gráfico de gasto e a tabela de desvios, então as três abas nunca ficam dessincronizadas entre si.

## Interações e estados

- Aba padrão ao abrir o painel de um funcionário: "Todas".
- Funcionário sem nenhuma solicitação: cenário não alcançável hoje, já que `EmployeeDetail` só é renderizado a partir de uma linha do Ranking, que só lista funcionários com pelo menos uma solicitação. Mesmo assim, `EmployeeRequestsTable` trata lista vazia com `EmptyState`, por segurança.
- Status desconhecido ou novo status adicionado ao sistema no futuro: `RequestStatusBadge` já centraliza esse mapeamento: nenhuma mudança necessária aqui.

## Testes

- Sem teste automatizado novo — ver "Fora de escopo". A única lógica não-trivial (ordenar por `created_at` desc) é um one-liner idêntico ao já usado hoje para "Desvios de política" em `employee-detail.tsx`, que também não tem teste dedicado.
- Verificação manual: em `/admin/reports`, clicar num funcionário com solicitações em mais de um status (ex.: uma aprovada e uma pendente), confirmar que a aba "Todas" lista todas elas ordenadas por data, que clicar numa linha abre `/admin/requests/[id]` correto, e que trocar para as abas "Gasto mensal" e "Desvios de política" ainda mostra o mesmo conteúdo de hoje.
