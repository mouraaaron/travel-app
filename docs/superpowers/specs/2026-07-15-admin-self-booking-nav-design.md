# Admin Self-Booking Navigation — Design

**Goal:** deixar claro na navegação que um admin também pode criar e acompanhar viagens para si mesmo — hoje isso já funciona no backend (nenhuma checagem de `role` bloqueia), mas o menu do admin simplesmente não mostra "Nova viagem" / "Minhas solicitações", então a possibilidade fica escondida. Nenhum bloqueio novo está sendo adicionado nesta mudança — só visibilidade de algo que já é permitido.

## Escopo

**Dentro do escopo:**
- `AppSidebar` (`src/components/layout/app-sidebar.tsx`): quando `role === "admin"`, o menu de desktop passa a ter duas seções — os itens administrativos atuais, e uma segunda seção rotulada "PESSOAL" com "Nova viagem" (`/`) e "Minhas solicitações" (`/requests`). O menu mobile (`lg:hidden`) recebe os mesmos itens numa lista única, sem o rótulo de seção.
- `src/app/(app)/requests/page.tsx`: adicionar filtro explícito `.eq("employee_id", user.id)` na query de `requests`. Hoje a página não filtra por usuário — funciona por acidente para funcionários porque a RLS (`requests_select_own_or_admin`, `supabase/migrations/0001_init.sql:85-95`) já restringe o que eles conseguem ler, mas a mesma policy libera leitura de **todas** as requests da organização para admins. Sem esse filtro explícito, "Minhas solicitações" mostraria as viagens de todo mundo para um admin.

**Fora de escopo:**
- Qualquer checagem que impeça um admin de criar, ver ou aprovar sua própria solicitação — comportamento atual mantido intencionalmente (pedido explícito do usuário: não adicionar bloqueios).
- Mudanças em `/api/requests` (POST) ou em qualquer Route Handler — nenhum deles precisa de alteração, já funcionam para qualquer role.
- Mudanças em `/`, `/results`, `/offer/[id]`, `/request/passengers/[offerId]`, `/request/review` — essas páginas já são agnósticas de role.

## Decisões confirmadas com o usuário

1. No desktop, os itens pessoais ficam em seção separada, abaixo dos itens administrativos, com um pequeno rótulo "PESSOAL" (mesmo estilo `text-xs font-medium uppercase text-muted-foreground` já usado em `login/page.tsx:114` e nos detalhes de solicitação).
2. Nenhuma restrição nova de acesso — a mudança é puramente de visibilidade/navegação + a correção de query necessária para "Minhas solicitações" fazer sentido para um admin.

## Arquitetura

### `src/components/layout/app-sidebar.tsx`

- Renomear `EMPLOYEE_NAV_ITEMS` → `PERSONAL_NAV_ITEMS` (mesmo conteúdo: "Nova viagem" `/`, "Minhas solicitações" `/requests`) — nome mais preciso já que agora é usado por ambos os roles.
- Manter `ADMIN_NAV_ITEMS` como está.
- Desktop (`<aside>` / `<nav>`): quando `role === "admin"`, renderizar dois blocos dentro da `<nav>` — o `.map` atual sobre `ADMIN_NAV_ITEMS`, seguido de um `<p>` com o rótulo "PESSOAL" e o `.map` sobre `PERSONAL_NAV_ITEMS`. Quando `role === "employee"`, renderizar só `PERSONAL_NAV_ITEMS` (sem rótulo), como hoje.
- Mobile (`<header lg:hidden>`): `navItems` passa a ser `role === "admin" ? [...ADMIN_NAV_ITEMS, ...PERSONAL_NAV_ITEMS] : PERSONAL_NAV_ITEMS` — lista única, sem rótulo (o nav mobile atual não tem estrutura de seção; é só uma fileira de links).
- `active` (highlight do item corrente) continua funcionando igual, já que compara `pathname === item.href` item a item, independente de seção.

### `src/app/(app)/requests/page.tsx`

- Buscar o usuário autenticado (`supabase.auth.getUser()`) antes da query de `requests`, igual ao padrão já usado em `src/app/api/requests/route.ts:56-64`.
- Adicionar `.eq("employee_id", user.id)` à query existente.
- Sem outras mudanças — `RequestsList` já é agnóstico de role, não recebe nem exibe nome de funcionário.

## Interações e estados

- Admin sem nenhuma solicitação própria: `/requests` mostra o mesmo `EmptyState` que hoje aparece para um funcionário sem solicitações — nenhum componente novo necessário.
- Item ativo no menu ("Nova viagem" ou "Minhas solicitações" destacado) funciona igual para admin e funcionário, já que a lógica de destaque não depende de role.

## Testes

- Sem lógica não-trivial nova o suficiente para exigir teste unitário (mudança é composição de arrays existentes + um filtro de query já testado em outros lugares do projeto no mesmo padrão).
- Verificação manual: logar como admin, confirmar as duas seções no menu desktop e a lista combinada no mobile, criar uma viagem como admin, confirmar que ela aparece em "Minhas solicitações" do admin e que **não há** vazamento de solicitações de outros funcionários nessa mesma tela.
