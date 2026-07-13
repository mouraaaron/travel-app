# Admin Employees Directory — Design

**Goal:** substituir o placeholder "em construção" (`src/app/admin/employees/page.tsx`) por um diretório/cadastro real de funcionários: lista com busca e filtros, perfil individual por pessoa, e duas ações administrativas (mudar papel, ativar/desativar acesso). A análise de gasto/desvio de política por funcionário continua em `/admin/reports` (`EmployeeRankingTable`/`EmployeeDetail`, já existentes) — esta feature não duplica aquilo, apenas linka para lá.

## Escopo

**Dentro do escopo:**
- `/admin/employees` — tabela com todos os funcionários da organização: avatar+nome, e-mail, badge de papel, badge de status, busca por nome/e-mail, filtro por papel e por status.
- `/admin/employees/[id]` — perfil individual: dados cadastrais + resumo de viagem (gasto total, nº de solicitações, nº de desvios — números-chave, sem gráfico) + link "Ver relatório completo" para `/admin/reports` + ações de mudar papel e ativar/desativar.
- Migration nova: colunas `email` e `status` em `profiles`, + policy de RLS de `update` para admin.
- Enforcement de "desativado": `getCurrentProfile()` passa a checar `status`; perfil inativo é tratado como deslogado em qualquer rota autenticada.
- Guarda de auto-ação: admin não pode mudar o próprio papel nem se autodesativar (bloqueado na UI e na API).

**Fora de escopo (v2):**
- Fluxo de convite/criação de novo funcionário pela UI (Supabase Auth Admin API + e-mail transacional) — cadastro de novos usuários continua manual, como hoje (seção 6 do `SchemaGuide.md`).
- Departamento/gestor/centro de custo fixo por pessoa — `cost_center` continua sendo escolhido por solicitação, não é atributo do perfil.
- Edição de nome (não pedido; pode entrar depois se necessário).
- Qualquer mudança em `admin-analytics.ts`, `EmployeeRankingTable` ou `EmployeeDetail` (continuam existindo, inalterados, em `/admin/reports`).
- Paginação (lista roda sem paginação nesta v1 — volume de funcionários é pequeno em todo o histórico do projeto).

## Decisões confirmadas com o usuário

1. **Foco = diretório/cadastro**, não analytics (isso já existe em Relatórios).
2. **Sem fluxo de criação/convite** — só gestão de quem já existe.
3. **Ações permitidas:** mudar papel (employee ↔ admin) e ativar/desativar acesso. Nenhuma outra mutação.
4. **Perfil individual mostra resumo de viagem** (números-chave via `admin-analytics.ts`), não só dados cadastrais.
5. **E-mail é copiado para `profiles`** (coluna nova), não buscado via Admin API a cada listagem.
6. **Admin não pode agir sobre si mesmo** (nem papel, nem status) — trava na UI e na API.

## Arquitetura

### Migration — `supabase/migrations/0004_profiles_employee_management.sql`

- `alter table profiles add column email text not null default ''` seguido de um `update` para preencher os dois perfis demo existentes com o e-mail conhecido (`employee@demo.com` / `admin@demo.com`), depois `alter column email drop default` (a coluna fica `not null` sem default permanente — todo profile novo deve vir com e-mail explícito).
- `alter table profiles add column status text not null default 'active' check (status in ('active', 'inactive'))`.
- Nova policy `profiles_update_org_admin`, reaproveitando a função `is_org_admin(org_id)` já criada em `0003_profiles_admin_select.sql`: `using (is_org_admin(profiles.organization_id)) with check (is_org_admin(profiles.organization_id))`. Autorização fina (não pode alterar o próprio registro, não pode alterar `full_name`/`organization_id`/`id`) fica por conta do Route Handler, não do RLS — mesmo padrão já usado no resto do projeto (RLS como segunda trava, Route Handler com service role fazendo a validação de negócio).

### Sessão — `src/lib/session.ts`

`getCurrentProfile()` passa a selecionar `status` e, se `status === 'inactive'`, retorna `null` (mesmo efeito de "não logado"). Isso propaga automaticamente para os dois layouts (`(app)/layout.tsx` e `admin/layout.tsx`), que já fazem `redirect("/login")` quando `getCurrentProfile()` é `null` — nenhuma mudança extra necessária ali. `CurrentProfile` ganha o campo `id` já existente reaproveitado para a checagem de auto-ação (não precisa de campo novo na interface).

### Camada de dados — `src/lib/employees-mapper.ts` (novo, espelha `requests-mapper.ts`)

```ts
export interface EmployeeRow {
  id: string;
  full_name: string;
  email: string;
  role: "employee" | "admin";
  status: "active" | "inactive";
  created_at: string;
}

export interface Employee extends EmployeeRow {}

export function toEmployee(row: EmployeeRow): Employee { ... }
```

Sem necessidade de mapeamento complexo (a tabela já é quase 1:1 com a UI) — a função existe só para manter o mesmo padrão de camada fina de mapeamento usado no resto do projeto, e para dar um lugar único caso o formato mude depois.

### Páginas — Server Components (mesmo padrão de `admin/requests/page.tsx`)

- `admin/employees/page.tsx`: busca `profiles` via `createSupabaseServerClient()` (RLS real — `profiles_select_org_admin`), passa a lista para `<EmployeesTable requests={...} employees={...} />` (Client Component, busca/filtro/ordenação em estado local, mesmo padrão de `EmployeeRankingTable`). Também busca `requests` (igual às outras páginas admin) só para alimentar o resumo de viagem exibido no perfil — nenhuma chamada extra de API.
- `admin/employees/[id]/page.tsx`: busca o profile específico + as `requests` daquele `employee_id`, monta o resumo via `admin-analytics.ts` (`spendByEmployee`, `outOfPolicyByEmployee`, contagem simples de requests), renderiza `<EmployeeProfileHeader />` + `<EmployeeSummaryCards />` + `<EmployeeActions />` (Client Component com os dois botões de ação).

### Componentes novos (`src/components/admin/`)

- `employees-table.tsx` — Client Component: `Input` de busca (nome/e-mail), dois `Select` de filtro (papel, status), `Table` com `Avatar`+nome, e-mail, `Badge` de papel, `Badge` de status; linha clicável → `router.push(/admin/employees/[id])`.
- `employee-actions.tsx` — Client Component: `Select` de papel (dispara `PATCH /api/admin/employees/[id]/role` on change, com `toast` de sucesso/erro via `sonner`) + `Switch`/botão de ativar-desativar (dispara `PATCH /api/admin/employees/[id]/status`). Ambos os controles vêm com `disabled` quando `employeeId === currentAdminId` (prop recebida do Server Component pai), com `title="Você não pode alterar sua própria conta"` no wrapper.
- `employee-summary-cards.tsx` — 3 `Card`s pequenos (gasto total, nº de solicitações, nº de desvios), mesmo estilo visual de `stat-cards.tsx` mas sem o gráfico/variação percentual (não se aplica a uma pessoa só).

Badges de papel/status: duas funções novas em `src/lib/badge-variants.ts` (`getRoleBadge`, `getEmployeeStatusBadge`), seguindo o mesmo padrão de `getStatusBadge`/`getPolicyBadge` já existentes ali (mapa `Record` + teste Vitest).

### Route Handlers novos

- `PATCH /api/admin/employees/[id]/role` — body `{ role: "employee" | "admin" }`. Valida sessão admin (`getCurrentProfile`), rejeita com 400 se `id === session.id` ("não é possível alterar seu próprio papel"), senão faz `update profiles set role = ... where id = ... and organization_id = session.organizationId` via client de service role.
- `PATCH /api/admin/employees/[id]/status` — body `{ status: "active" | "inactive" }`. Mesma validação, mesma trava de auto-ação, mesmo `update`.

Ambos seguem o padrão já estabelecido em `src/app/api/admin/requests/[id]/approve/route.ts` (auth check → validação de negócio → update → resposta JSON).

## Interações e estados

- Lista vazia (organização sem outros funcionários além do admin logado) → `EmptyState`, mesmo padrão do resto do admin.
- Busca/filtro sem resultado → `EmptyState` "tiny" dentro da própria tabela (mesmo padrão de `EmployeeDetail`).
- Ação de mudar papel/status: otimista não — espera resposta da API, mostra `toast` de sucesso (`sonner`, já configurado em `AppProviders`) ou erro, e revalida a página (`router.refresh()`) para refletir o novo badge.
- Tentativa de ação sobre a própria conta: controles já vêm `disabled` do servidor (não depende só de JS no cliente) — o Route Handler também rejeita, então não há caminho (nem via DevTools) para o admin se autodesativar.

## Testes

- `src/lib/employees-mapper.ts` — sem lógica não-trivial o suficiente para justificar teste próprio (mapeamento 1:1); se ganhar lógica futura, ganha teste então.
- `src/lib/badge-variants.test.ts` — dois `describe` novos (`getRoleBadge`, `getEmployeeStatusBadge`), mesmo padrão dos existentes.
- Páginas/componentes/Route Handlers verificados manualmente (mesmo precedente dos specs anteriores deste projeto — sem setup de teste de renderização React): `npm run build`, `npm run lint`, e checklist manual — listar funcionários, buscar, filtrar, abrir perfil, mudar papel, ativar/desativar, confirmar que os controles da própria conta do admin ficam desabilitados, confirmar que um perfil desativado é redirecionado ao tentar logar/navegar.
