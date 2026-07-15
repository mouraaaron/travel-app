# Semanas Presenciais — Spec e Plano de Implementação

> Resultado de uma sessão de grilling (15 decisões) sobre a feature pedida:
> o Travel Admin escolhe um setor e um período, e o sistema gera
> automaticamente uma solicitação de viagem (ida + volta) para cada
> funcionário do setor, de sua cidade de origem até Curitiba.

## 1. Objetivo

A empresa organiza periodicamente "semanas presenciais": funcionários de um
setor viajam até o escritório de Curitiba por alguns dias. Hoje, organizar
isso significa o Travel Admin (ou cada funcionário) abrir o fluxo de busca
de voo manualmente, um de cada vez, para cada pessoa do setor. Esta feature
substitui isso por uma ação única: **"Organizar Semana Presencial"**, que
gera as solicitações de viagem de todo o setor de uma vez.

## 2. Fora de escopo (decisões explícitas)

Estas exclusões foram decididas durante o grilling e devem ser respeitadas
— não expandir a feature para cobri-las sem decisão explícita nova:

- **Emissão real de bilhete (order na Duffel).** Hoje isso não existe em
  lugar nenhum do sistema, nem para o fluxo individual — só busca de oferta
  (`searchFlights`), nunca uma compra. Esta feature cria `requests` reais
  com preço real, mas não compra nada. Uma futura feature separada deve
  simular (ou implementar de verdade) a emissão.
- **Notificação ao funcionário** (e-mail, Slack) de que uma viagem foi
  organizada em seu nome. Nesta fase, ele só vê a solicitação ao entrar em
  "Minhas solicitações" — mesma tela que já existe.
- **Classe de cabine configurável.** Fixa em `economy` — sem exceção por
  setor nesta fase.
- **Documentos de identidade do passageiro** (passaporte/RG). Não são
  exigidos pela Duffel para voos domésticos (`passenger_identity_documents_required`
  só é `true` em voos internacionais), e origem→Curitiba é sempre doméstico.

## 3. Fatos do código existente (não decisões — contexto)

- `search_criteria.slices` já é um array — **uma única busca na Duffel
  com 2 slices (ida + volta) retorna oferta de ida-e-volta combinada**.
  Ou seja: **1 busca Duffel por funcionário**, não duas, e **1 linha em
  `requests` por funcionário** cobre a viagem inteira (não duas linhas).
- Origem/destino em toda a base são **código IATA de aeroporto** (3
  letras), nunca nome de cidade.
- `src/lib/supabase/server.ts` usa a **anon key + sessão do usuário** nos
  Route Handlers — RLS é aplicado de verdade (o comentário do
  `SchemaGuide.md` seção 5, que diz "service_role key", está desatualizado
  e deve ser corrigido como parte desta implementação). Isso significa que
  a policy atual `requests_insert_own` (`employee_id = auth.uid()`) **bloqueia**
  o admin de inserir solicitações em nome de outros — precisa de uma policy
  nova.
- `DuffelPassenger` exige `title`, `given_name`, `family_name`, `born_on`,
  `gender`, `email`, `phone_number`. `profiles` hoje só tem `email` desses
  sete — os outros seis não existem e precisam ser adicionados.
- `policy_rules` já é por setor (`domestic_cap_brl`, `cost_flag_brl` etc.)
  e o `evaluateOffer()` em `src/lib/policy.ts` já pode ser reaproveitado
  sem alteração.
- `CorporateContext.trip_purpose` não tem um valor específico para "semana
  presencial" — usar `"internal_meeting"` (o mais próximo do enum
  existente) em vez de expandir o enum, para não tocar na constraint do
  banco.

## 4. Modelo de dados

### 4.1 `profiles` — colunas novas

| Coluna | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `origin_airport_code` | `text` | não (nullable) | Código IATA do aeroporto de origem do funcionário (ex: `GRU`). Preenchido pelo admin em `/admin/employees/[id]`, mesmo padrão de `cost_center` hoje. |
| `given_name` | `text` | não | Exigido pela Duffel. |
| `family_name` | `text` | não | Exigido pela Duffel. |
| `born_on` | `date` | não | Exigido pela Duffel. |
| `gender` | `text` | não | `check in ('m', 'f')` — enum da Duffel. |
| `title` | `text` | não | `check in ('mr', 'mrs', 'ms', 'miss', 'dr')` — enum da Duffel. |
| `phone_number` | `text` | não | Exigido pela Duffel. |

Todas nullable no banco (ao contrário do padrão "default temporário +
backfill + drop default" usado em `0004`/`0005`) porque, diferente de
`cost_center` (que é obrigatório desde o dia 1 para todo profile), estes
campos só passam a ser necessários quando alguém tenta incluir a pessoa
numa semana presencial — um profile "incompleto" continua válido para
todo o resto do sistema. A ausência de qualquer um deles é o gatilho do
status "faltando informação" na tela de revisão (seção 6.2).

### 4.2 `onsite_weeks` — tabela nova

| Coluna | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | `uuid` | sim (gerado) | PK. |
| `organization_id` | `uuid` | sim | FK `organizations`. |
| `sector` | `text` | sim | Mesmo check constraint de `profiles.cost_center`. |
| `week_start_date` | `date` | sim | Data de ida, escolhida pelo admin. |
| `week_end_date` | `date` | sim | Data de volta, escolhida pelo admin. |
| `status` | `text` | sim | `check in ('completed', 'partial', 'cancelled')`. |
| `created_by` | `uuid` | sim | FK `profiles`, o admin que organizou. |
| `created_at` | `timestamptz` | sim (automático) | |
| `cancelled_at` | `timestamptz` | não | Preenchido no cancelamento em lote. |

```sql
unique (organization_id, sector, week_start_date, week_end_date)
```

Essa constraint é a trava de idempotência (decisão da pergunta 11): uma
segunda tentativa com os mesmos parâmetros falha na constraint, e o backend
deve traduzir esse erro para "já existe uma semana presencial organizada
para {setor} nessas datas" com link para o lote existente.

### 4.3 `requests` — coluna nova

| Coluna | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `onsite_week_id` | `uuid` | não (nullable) | FK `onsite_weeks`. `null` para toda solicitação criada pelo fluxo individual normal. |

```sql
create unique index requests_onsite_week_employee_unique
  on requests (onsite_week_id, employee_id)
  where onsite_week_id is not null;
```

Impede duas `requests` para o mesmo funcionário no mesmo lote (protege o
fluxo de "retry" da seção 6.5 contra duplicar quem já teve sucesso).

### 4.4 RLS — políticas novas

- `onsite_weeks`: select para qualquer membro da organização (mesmo padrão
  de `policy_rules_select_org_member`); insert/update só para
  `is_org_admin(organization_id)`.
- `requests`: nova policy de insert para admin —
  `requests_insert_admin_onsite_week`, permitindo
  `is_org_admin(organization_id) and onsite_week_id is not null` — ou seja,
  o admin só pode inserir solicitações em nome de terceiros *através* desse
  fluxo (com `onsite_week_id` preenchido), não solicitações avulsas
  arbitrárias em nome de qualquer um.

## 5. Fluxo ponta a ponta

1. Admin acessa `/admin/onsite-weeks` (seção nova no menu do admin, ao lado
   de `employees`/`requests`/`settings`/`reports`). Vê lista de lotes já
   organizados (setor, período, status, contagem de solicitações).
2. Clica **"Organizar nova semana presencial"** → formulário: setor
   (dropdown, os 4 valores existentes) + data de ida + data de volta (dois
   date pickers, sem regra de negócio fixa entre elas).
3. Submit chama `POST /api/admin/onsite-weeks/preview` (não grava nada) →
   backend busca todos os `profiles` `status = 'active'` do setor+org, e
   para cada um calcula um status de elegibilidade (seção 6.2).
4. Tela de revisão: tabela com 1 linha por funcionário — nome, status,
   checkbox pré-marcado (exceto quem já está em Curitiba, ver 6.3).
5. Admin ajusta os checkboxes e clica **"Confirmar e buscar voos"** →
   `POST /api/admin/onsite-weeks` com `{sector, week_start_date,
   week_end_date, employee_ids: [...selecionados]}`.
6. Backend cria a linha em `onsite_weeks` (a unique constraint pega
   duplicata aqui) e, para cada `employee_id`, roda o fluxo da seção 6.4
   (busca Duffel → policy evaluation → insert em `requests`), continuando
   mesmo se algum falhar (seção 6.5).
7. Resposta mostra o resultado: quem teve solicitação criada, quem falhou
   e por quê. `onsite_weeks.status` = `completed` (0 falhas) ou `partial`
   (1+ falhas).
8. Lote aparece em `/admin/onsite-weeks/[id]` (detalhe: lista de `requests`
   geradas + falhas + botão de retry para os que faltam + botão "Cancelar
   semana presencial").
9. Cada `request` gerada aparece também em `/admin/requests` com um badge
   visual diferenciando "gerada por semana presencial" das solicitações
   normais.

## 6. Regras de negócio

### 6.1 Setor e elegibilidade base

Só `profiles` com `status = 'active'` e `cost_center = {setor escolhido}`
entram na lista de elegíveis.

### 6.2 Status de elegibilidade por funcionário (tela de revisão)

- `ok` — tem `origin_airport_code`, `given_name`, `family_name`, `born_on`,
  `gender`, `title`, `phone_number` preenchidos. Checkbox habilitado.
- `missing_profile_data` — falta 1+ desses campos. Checkbox desabilitado,
  linha mostra quais campos faltam + link para
  `/admin/employees/[id]` para completar.
- Em ambos os casos o admin pode ver a linha; só `ok` pode ser
  selecionado.

### 6.3 Exclusão automática de quem já está em Curitiba

Se `origin_airport_code` do funcionário já for o aeroporto de Curitiba
(`CWB`), o checkbox nasce **desmarcado** (mas habilitado, caso o admin
queira incluir mesmo assim por algum motivo). Constante `CURITIBA_IATA =
"CWB"` no código, não configurável nesta fase.

### 6.4 Geração de cada `request` (por funcionário selecionado)

1. Monta `search_criteria`: `slices = [{origin: profile.origin_airport_code,
   destination: "CWB", departure_date: week_start_date}, {origin: "CWB",
   destination: profile.origin_airport_code, departure_date:
   week_end_date}]`, `cabin_class: "economy"`, `passengers: [{type:
   "adult"}]`.
2. Chama `searchFlights()` (mesma função já usada em
   `/api/flights/search`) — 1 chamada cobre ida+volta.
3. Escolhe a oferta mais barata retornada (mesma lógica de ranking que já
   deve existir para ordenar por preço na tela `/results`).
4. Roda `evaluateOffer()` (já existe em `src/lib/policy.ts`) contra o
   `policy_rules` do setor → `policy_evaluation`.
5. Monta `passengers: [DuffelPassenger]` a partir dos campos novos do
   `profiles` (seção 4.1).
6. Monta `corporate: {trip_purpose: "internal_meeting", cost_center:
   profile.cost_center, business_justification: "Semana presencial —
   {setor}, {week_start_date} a {week_end_date}."}`.
7. Insere em `requests` com `status: "approved"` diretamente (decisão da
   pergunta 7 — sem passar por `pending_admin`), `onsite_week_id` setado,
   `events: [{kind: "created", ...}, {kind: "auto_approved_onsite_week",
   actor_id: admin.id}]`.

### 6.5 Falha parcial

Cada funcionário selecionado é processado de forma independente
(try/catch por iteração, não uma transação única para o lote inteiro).
Falha comum esperada: `DuffelSearchError` (sem oferta disponível na rota,
API fora do ar). A falha é registrada (não persiste como `request` nenhuma
— só aparece no resultado da chamada e, opcionalmente, num log/coluna de
`onsite_weeks` para exibir depois). `onsite_weeks.status` vira `partial`
se houver 1+ falha, `completed` se todos os selecionados tiverem sucesso.

**Retry**: a tela de detalhe do lote (`/admin/onsite-weeks/[id]`) mostra
quem falhou e oferece "Tentar novamente" — reexecuta a seção 6.4 apenas
para os que faltam, inserindo mais `requests` no **mesmo** `onsite_week_id`
existente (não cria um lote novo — por isso a unique constraint da seção
4.3 em `(onsite_week_id, employee_id)` existe: impede duplicar quem já
teve sucesso caso o retry seja clicado sobre a lista errada).

### 6.6 Cancelamento em lote

`POST /api/admin/onsite-weeks/[id]/cancel`: seta `onsite_weeks.status =
'cancelled'`, `cancelled_at = now()`, e propaga `status = 'cancelled'`
(mais um evento no `events` jsonb) para toda `request` vinculada que ainda
não esteja `cancelled` individualmente. Reaproveita a lógica de cancelamento
que já existe em `/api/requests/[id]/cancel`, chamada em loop dentro de
uma única rota nova (não expor N chamadas ao frontend).

### 6.7 Diferenciação visual em `/admin/requests`

Qualquer `request` com `onsite_week_id != null` recebe um badge (ex:
"Semana Presencial") na listagem existente — mudança pequena no
componente que já renderiza cada linha, sem alterar a query/paginação.

## 7. API — rotas novas

| Rota | Método | Descrição |
|---|---|---|
| `/api/admin/onsite-weeks` | `GET` | Lista lotes da organização (para `/admin/onsite-weeks`). |
| `/api/admin/onsite-weeks/preview` | `POST` | `{sector, week_start_date, week_end_date}` → lista de elegibilidade por funcionário (seção 6.2), sem gravar nada. |
| `/api/admin/onsite-weeks` | `POST` | `{sector, week_start_date, week_end_date, employee_ids}` → cria o lote + as `requests` (seção 6.4/6.5). |
| `/api/admin/onsite-weeks/[id]` | `GET` | Detalhe do lote: dados do lote + `requests` vinculadas + falhas pendentes. |
| `/api/admin/onsite-weeks/[id]/retry` | `POST` | `{employee_ids}` → reexecuta 6.4 só para esses, dentro do lote existente. |
| `/api/admin/onsite-weeks/[id]/cancel` | `POST` | Cancelamento em lote (seção 6.6). |

Todas exigem `role = 'admin'`, mesmo padrão de guarda usado em
`/api/admin/requests/[id]/approve`.

## 8. UI — telas novas/alteradas

- **Novo item de menu** no admin (`src/app/admin/layout.tsx` ou onde o
  menu é definido hoje) apontando para `/admin/onsite-weeks`.
- **`/admin/onsite-weeks`** (nova): lista de lotes.
- **`/admin/onsite-weeks/new`** (nova): formulário setor+datas → tela de
  revisão por funcionário (pode ser 1 página com 2 passos ou 2 rotas).
- **`/admin/onsite-weeks/[id]`** (nova): detalhe do lote, com retry e
  cancelamento em lote.
- **`/admin/employees/[id]`** (alterada): adicionar campos do novo
  `profiles` (origin_airport_code, given_name, family_name, born_on,
  gender, title, phone_number) ao formulário de edição já existente.
- **`/admin/requests`** (alterada): badge visual para `onsite_week_id !=
  null` (seção 6.7).

## 9. Plano de implementação (fases)

**Fase 0 — Schema**
1. Migration `0008_onsite_weeks.sql`: colunas novas em `profiles` (4.1),
   tabela `onsite_weeks` (4.2), coluna+índice em `requests` (4.3), RLS
   (4.4).
2. Script `scripts/seed-onsite-week-demo-fields.ts` (ou estender o seed
   existente): popular os campos novos das 2 contas demo com dados
   mockados plausíveis (nome/sobrenome a partir do `full_name` já
   existente, nascimento fictício, gênero, título, telefone fictício,
   `origin_airport_code` de exemplo, ex: `GRU`) — sem isso, as contas demo
   ficam com status `missing_profile_data` e a feature não é demonstrável
   ponta a ponta.

**Fase 1 — Backend**
3. `POST /api/admin/onsite-weeks/preview` (elegibilidade, seção 6.2/6.3).
4. `POST /api/admin/onsite-weeks` (criação do lote + 6.4 + 6.5, com
   tratamento de erro de constraint duplicada → mensagem amigável).
5. `GET /api/admin/onsite-weeks` e `GET /api/admin/onsite-weeks/[id]`.
6. `POST /api/admin/onsite-weeks/[id]/retry`.
7. `POST /api/admin/onsite-weeks/[id]/cancel`.

**Fase 2 — Admin UI**
8. Formulário de organização (setor + datas) + tela de revisão
   (checkboxes, status por funcionário).
9. Tela de detalhe do lote (resultado, falhas, retry, cancelar).
10. Lista `/admin/onsite-weeks`.
11. Badge em `/admin/requests`.
12. Campos novos no form de `/admin/employees/[id]`.

**Fase 3 — Validação manual**
13. Rodar o fluxo completo com as 2 contas demo (ou dados de setor
    maiores, se o seed for expandido) verificando: idempotência (tentar
    organizar o mesmo lote 2x), falha parcial simulada (rota sem oferta),
    cancelamento em lote, badge visual.

## 10. Riscos conhecidos

- **Latência**: N funcionários = N buscas Duffel sequenciais/paralelas
  disparadas por uma única ação do admin. Para setores grandes isso pode
  ser lento o suficiente para exigir feedback de progresso na UI (fora do
  escopo desta spec decidir a UI de loading — tratar como detalhe de
  implementação da Fase 2, item 8).
- **Preço pode variar** entre a tela de revisão (que não busca oferta,
  seção 6.2) e a confirmação (que busca de verdade, seção 6.4) — não há
  preço nenhum mostrado antes da confirmação, então isso é esperado e não
  é um bug.
