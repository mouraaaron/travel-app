# Travel Admin — Fila de Aprovação: Design

**Handoff:** `HANDOFF TRAVEL-ADMIN-PANNEL.zip` (raiz do repo `bootcamp`), pasta `design_handoff_travel_approval_queue/`. README + prototype `.dc.html` + screenshots ali são a fonte de verdade visual (cores, spacing, cópia em pt-BR); este documento cobre as decisões de implementação que o handoff deixa em aberto.

**Goal:** substituir a página placeholder `src/app/admin/page.tsx` ("Admin Panel em construção") por um painel Travel Admin funcional: fila de aprovação de solicitações de viagem, tela de detalhe com aprovar/rejeitar, e diálogo de rejeição — ligado aos dados reais do Supabase (mesma tabela `requests` já usada pelo Employee), não mock local.

## Escopo

**Dentro do escopo (funcional):**
- `/admin/requests` — fila de aprovação (tabs Pendentes/Todas, busca, aprovação rápida, badges de política).
- `/admin/requests/[id]` — detalhe da solicitação (aprovar/rejeitar, timeline, diálogo de rejeição).
- Sidebar do admin com nav próprio.

**Dentro do escopo (stub "em construção", só pra sidebar bater com o mock):**
- `/admin` (Painel), `/admin/employees` (Funcionários), `/admin/reports` (Relatórios), `/admin/settings` (Configurações).

**Fora de escopo:**
- Notificação por e-mail ao funcionário quando aprovado/rejeitado (o motivo da rejeição já fica visível na tela de detalhe do próprio funcionário, que já existe).
- Qualquer lógica nova de avaliação de política (o `policy_evaluation` já vem pronto no request, calculado na criação).
- Restyle do Badge/Button para bater pixel-a-pixel com o radius do mock (6-8px) — mantemos os componentes do DS como estão (pill/rounded-sm), conforme a própria instrução do README do handoff.

## Decisões confirmadas com o usuário

1. **Aprovação rápida ("Aprovar" na linha da fila):** aparece em toda solicitação `pending_admin`, inclusive fora de política (não força abrir o detalhe).
2. **Sidebar:** os 5 itens do mock (Painel, Solicitações, Funcionários, Relatórios, Configurações) são todos criados; só "Solicitações" é funcional, o resto é stub "em construção".

## Arquitetura

- **Roteamento:** novo `src/app/admin/layout.tsx` (Server Component) faz o guard de role — redirect `/login` se não autenticado, `/` se `role !== "admin"` — e renderiza a sidebar, no mesmo padrão de `src/app/(app)/layout.tsx`.
- **Sidebar:** `AppSidebar` (`src/components/layout/app-sidebar.tsx`) ganha um prop `role: "employee" | "admin"` e dois arrays de nav (o atual, para employee, fica intacto). Nav admin: Painel (`LayoutDashboard`, `/admin`), Solicitações (`ClipboardCheck`, `/admin/requests`), Funcionários (`Users`, `/admin/employees`), Relatórios (`FileText`, `/admin/reports`), Configurações (`Settings`, `/admin/settings`).
- **Dados:** Server Components buscam via `createSupabaseServerClient()` (cookie-scoped, RLS aplicado de verdade — não é filtro manual), igual `src/app/(app)/requests/page.tsx` já faz. A fila usa `select("*, employee:profiles(full_name)")` pra trazer o nome do funcionário (join via a FK `requests.employee_id -> profiles.id` que já existe).
- **RLS — gap encontrado:** `supabase/migrations/0001_init.sql` só tem `requests_update_own` (o próprio employee pode dar update no seu request). Não existe policy de UPDATE para admin — só de SELECT (`requests_select_own_or_admin`). Sem isso, aprovar/rejeitar como admin falha silenciosamente. Nova migration `supabase/migrations/0002_admin_request_updates.sql` adiciona `requests_update_admin`, espelhando a condição já usada na policy de select (role admin + mesma `organization_id`).
- **Mutações:** dois novos Route Handlers, mesmo padrão de `src/app/api/requests/[id]/cancel/route.ts`:
  - `POST /api/admin/requests/[id]/approve` — checa sessão + `profile.role === "admin"` + `request.status` em (`pending_admin`, `needs_review`) + mesma `organization_id`; seta `status: "approved"`, adiciona evento `{ kind: "approved", actor_id: admin.id, at }`.
  - `POST /api/admin/requests/[id]/reject` — mesma checagem + body `{ reason: string }` não-vazio; seta `status: "rejected"`, adiciona evento `{ kind: "rejected", actor_id: admin.id, at, note: reason }`.
- **Timeline:** rótulos genéricos existentes (`getTravelRequestTimelineLabel` em `src/lib/badge-variants.ts`, ex. "Aprovada por Travel Admin") são mantidos como estão — não buscamos o nome do admin por evento pra não adicionar mais um join só por isso.

## Componentes

Reaproveitados sem alteração: `RequestStatusBadge`, `PolicyBadges` (já tem o tooltip de violações que o handoff pede), `EmptyState`, `Card`, `Dialog`, `Tabs`, `Textarea`, `Button`, `Badge`.

Novos (espelhando a estrutura de `requests-list.tsx` / `request-detail-view.tsx`, sem extrair abstração compartilhada com o employee-side — mesmo estilo do restante do repo):
- `src/components/admin/requests-queue.tsx` (client): tabs Pendentes/Todas, busca (só na aba Todas, case-insensitive por nome/origem/destino), lista ordenada por `created_at` crescente, avatar com iniciais, badges de status/política/flags, borda âmbar + fundo tintado em linhas fora de política, empty state na aba Pendentes.
- `src/app/admin/requests/[id]/page.tsx` + `src/components/admin/request-detail-view.tsx` (client): mesmos cards do detalhe do employee (viagem, contexto, política) + card de Status com botões Aprovar/Rejeitar (visíveis só se `status` em `pending_admin`/`needs_review`) + diálogo de rejeição com textarea obrigatória (botão "Confirmar rejeição" desabilitado até ter texto).

**Extensões pequenas ao DS** (consistentes com padrões já existentes, não introduzem estilo novo):
- `ui/avatar.tsx` — não existe ainda; adicionar via `npx shadcn add avatar`.
- `button.tsx` ganha variante `success` (emerald, mesma paleta que o Badge `success` já usa) para o "Aprovar" rápido da fila. O "Aprovar" grande do detalhe reusa `bg-brand-gradient` (igual ao botão "Nova viagem" já existente); "Rejeitar" reusa o padrão já usado no botão "Cancelar solicitação" do employee (`variant="secondary" className="text-destructive"`).

## Interações e estados

- Troca de tab (Pendentes/Todas): refiltra a lista local (sem refetch), busca só some/aparece na aba Todas.
- Aprovação rápida na linha: chamada otimista ao endpoint approve, sem diálogo de confirmação; em erro, toast + reverte (mesmo padrão de `handleCancel` em `requests-list.tsx`).
- Clique na linha / "Ver detalhes": navega para `/admin/requests/[id]`.
- Detalhe → Aprovar: mesma chamada de approve.
- Detalhe → Rejeitar: abre diálogo; confirmar exige texto não-vazio; sucesso fecha o diálogo e dá `router.refresh()`.
- Erros de API (rede, 403, 409 de status já decidido) sempre viram `toast.error` com a mensagem do backend — nunca throw silencioso.

## Testes

Seguindo o precedente já estabelecido no repo (ver `docs/superpowers/plans/2026-07-10-backend-supabase-duffel-integration.md`, Global Constraints): não há setup de teste de renderização de componente React neste projeto. Lógica pura em `src/lib/**/*.ts` (ex. qualquer novo helper de filtro/ordenação da fila, se extraído) ganha teste vitest co-localizado; componentes/páginas/Route Handlers são verificados via `npm run build`, `npm run lint` e checklist manual (fluxo completo: pendente → aprovar rápido; pendente fora de política → detalhe → rejeitar com motivo → ver motivo na tela do employee).
