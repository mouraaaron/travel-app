# Guia do banco de dados (Supabase/Postgres)

> Escrito para quem está começando com banco de dados. Se um termo genérico
> (tabela, coluna, chave primária...) não fizer sentido, ele está explicado
> na seção 1 antes de aparecer nas tabelas específicas.
>
> O SQL que cria tudo isso está em
> [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql).
> Este documento é a explicação; aquele arquivo é o que efetivamente roda no
> Supabase.

## 1. Conceitos básicos

- **Tabela**: como uma planilha. Tem colunas fixas (nome, tipo do dado) e
  cada linha é um registro. Ex: a tabela `requests` tem uma linha por
  solicitação de viagem.
- **Coluna** e **tipo**: cada coluna só aceita um tipo de dado. Os tipos que
  usamos aqui:
  - `uuid`: um identificador único gerado automaticamente (ex:
    `a1b2c3d4-...`), usado como "número de identidade" de cada linha.
  - `text`: texto livre.
  - `numeric`: número (usado para valores em dinheiro, ex: `2850.00`).
  - `timestamptz`: data + hora, com fuso horário.
  - `jsonb`: um "objeto" ou "lista" inteiro guardado dentro de uma única
    coluna (explicado na seção 4 — é o tipo mais importante de entender
    aqui, porque é diferente do que costuma aparecer em tutoriais básicos
    de SQL).
- **Chave primária (primary key)**: a coluna que identifica cada linha de
  forma única dentro da tabela. Aqui é sempre `id`, do tipo `uuid`.
- **Chave estrangeira (foreign key / `references`)**: uma coluna que aponta
  para o `id` de outra tabela, criando uma relação entre elas. Ex:
  `requests.employee_id references profiles(id)` significa "cada
  solicitação pertence a exatamente um perfil de funcionário".
- **RLS (Row Level Security)**: uma camada de segurança do Postgres que
  filtra automaticamente quais *linhas* cada usuário pode ver/editar,
  mesmo que a query peça "todas". Explicado na seção 5.

## 2. Visão geral das tabelas

```
organizations (1 linha no MVP)
      │ organization_id
      ├──────────────┐
      ▼              ▼
   profiles        requests
 (1 por usuário)  (1 por solicitação de viagem)
      │                ▲
      └── employee_id ─┘
```

- **`organizations`**: a empresa. No MVP só existe 1 linha ("Paggo (Demo)"),
  mas a coluna já existe nas outras tabelas para não precisar redesenhar o
  banco quando o produto crescer para múltiplas empresas-clientes.
- **`profiles`**: quem é cada pessoa que faz login (nome, papel, empresa).
- **`requests`**: cada solicitação de viagem que um Employee cria.

Não existe hoje: tabela de aprovação, de `orders` da Duffel — porque esta
fase do projeto cobre só o fluxo do Employee até criar a solicitação (ver
decisão de escopo). `policy_rules` já existe (seção 3.4) e alimenta a
avaliação de política por setor. Essas ficam para quando o Admin Panel for
construído.

## 3. Tabela por tabela

### 3.1 `organizations`

| Coluna | Tipo | Obrigatório | Para que serve |
|---|---|---|---|
| `id` | `uuid` | sim (gerado sozinho) | Identificador único da empresa. |
| `name` | `text` | sim | Nome de exibição, ex: `"Paggo (Demo)"`. |
| `created_at` | `timestamptz` | sim (automático) | Quando a linha foi criada. |

No MVP: **uma única linha**, criada pelo próprio arquivo de migração.

### 3.2 `profiles`

Complementa a tabela interna `auth.users` do Supabase (que guarda email,
senha criptografada, etc. — gerenciada pelo próprio Supabase Auth, você
nunca mexe nela diretamente). `profiles` guarda o que é específico do
*nosso* app.

| Coluna | Tipo | Obrigatório | Para que serve |
|---|---|---|---|
| `id` | `uuid` | sim | O mesmo `id` do usuário em `auth.users` — é assim que ligamos "quem logou" com "quem é essa pessoa no nosso sistema". |
| `organization_id` | `uuid` | sim | A qual empresa essa pessoa pertence (aponta para `organizations.id`). |
| `role` | `text` | sim | Só pode ser `"employee"` ou `"admin"` (o banco recusa qualquer outro valor). Define o que a pessoa pode fazer. |
| `cost_center` | `text` | sim | O setor do funcionário: `"product"`, `"marketing"`, `"engineering"` ou `"founders"` (o banco recusa qualquer outro valor). Apesar do nome da coluna, hoje representa o setor da pessoa, não um centro de custo financeiro — o nome foi mantido para não duplicar conceito com `requests.corporate.cost_center` (ver seção 3.3). |
| `full_name` | `text` | sim | Nome de exibição na UI. |
| `created_at` | `timestamptz` | sim (automático) | Quando o perfil foi criado. |

No MVP: **duas linhas**, uma para `employee@demo.com` (role `employee`) e
uma para `admin@demo.com` (role `admin`) — ver seção 6.

### 3.3 `requests`

O coração do schema. Cada linha é uma solicitação de viagem — o
equivalente, no banco, ao tipo TypeScript `TravelRequest` que já existe em
[`src/lib/types.ts`](../src/lib/types.ts).

| Coluna | Tipo | Obrigatório | Para que serve |
|---|---|---|---|
| `id` | `uuid` | sim | Identificador único da solicitação. |
| `organization_id` | `uuid` | sim | Empresa dona da solicitação (redundante com `employee_id`, mas deixa filtros e RLS mais simples/rápidos). |
| `employee_id` | `uuid` | sim | Quem criou a solicitação (aponta para `profiles.id`). |
| `status` | `text` | sim | Um de: `pending_admin`, `approved`, `rejected`, `needs_review`, `confirmed`, `cancelled`. Nesta fase, praticamente toda solicitação nasce e fica em `pending_admin`, exceto se o Employee cancelar. |
| `total_amount` | `numeric` | sim | Valor total da oferta escolhida, ex: `2850.00`. Fica fora do JSON para ser fácil de somar/filtrar/ordenar em queries. |
| `total_currency` | `text` | sim | Moeda, ex: `"BRL"`. |
| `created_at` | `timestamptz` | sim (automático) | Quando a solicitação foi criada. |
| `search_criteria` | `jsonb` | sim | O que a pessoa buscou (origem, destino, datas, passageiros, classe). Mesmo formato do tipo `SearchCriteria`. |
| `selected_offer_snapshot` | `jsonb` | sim | Uma "foto" da oferta da Duffel no momento em que foi escolhida (preço, trechos, companhia...). Mesmo formato do tipo `SelectedOfferSnapshot`. Guardamos essa foto em vez do `offer_id` da Duffel porque ofertas expiram em minutos — quando o Admin for aprovar (fase futura), o backend vai buscar uma oferta *nova* na Duffel usando os critérios, não reaproveitar essa. |
| `passengers` | `jsonb` | sim | Lista de passageiros (nome, nascimento, documento...). Mesmo formato de `DuffelPassenger[]`. |
| `corporate` | `jsonb` | sim | Motivo da viagem, centro de custo, justificativa. Mesmo formato de `CorporateContext`. |
| `policy_evaluation` | `jsonb` | sim | Resultado do Policy Engine no momento da criação (`compliant`, violações, flags). |
| `events` | `jsonb` | sim (começa `[]`) | Histórico de eventos da solicitação (`created`, `cancelled`, etc. — mesmo formato de `TravelRequestEvent[]`). Cada ação relevante adiciona um item nessa lista, em vez de sobrescrever. |

> **Nota sobre `corporate.cost_center`**: até a versão anterior deste guia, era escolhido manualmente pelo Employee em cada solicitação, com uma lista de valores livre. Agora é preenchido automaticamente pelo servidor (Route Handler `/api/requests`) a partir do `profiles.cost_center` de quem está enviando, no momento da criação — funciona como uma "foto" congelada do setor da pessoa naquele instante, mesmo que ela troque de setor depois.

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

## 4. Por que `jsonb` em vez de mais tabelas?

`jsonb` guarda um objeto ou lista inteiro (no formato JSON) dentro de uma
única célula da tabela — é como guardar um "mini arquivo" ali dentro, mas o
Postgres ainda entende a estrutura por dentro (dá pra fazer buscas dentro
dele se um dia for preciso).

Decidimos usar isso para `search_criteria`, `selected_offer_snapshot`,
`passengers`, `corporate`, `policy_evaluation` e `events` em vez de criar
uma tabela para cada um (ex: uma tabela `request_passengers` separada) por
dois motivos:

1. **Espelha quase 1:1 os tipos que já existem em `types.ts`.** Salvar e
   ler uma `request` no banco é quase literalmente "pegar o objeto
   TypeScript e jogar no banco" — sem quebrar em pedaços e depois
   remontar.
2. **Menos tabelas, menos `JOIN`s.** Para o tamanho deste projeto (um MVP
   de bootcamp), isso reduz bastante a complexidade sem perder nada que a
   UI atual precise.

O trade-off: fica mais difícil fazer uma pergunta tipo "me dê todos os
passageiros chamados João, de qualquer solicitação" via SQL puro — mas essa
necessidade não existe nas telas de hoje.

## 5. RLS (Row Level Security) — explicado com exemplo

Por padrão, `alter table ... enable row level security` faz o Postgres
**bloquear tudo** — nenhuma linha aparece pra ninguém — até você criar
políticas explícitas dizendo o que cada tipo de usuário pode ver.

As políticas que criamos:

- Em `requests`: um Employee só enxerga as próprias solicitações
  (`employee_id = auth.uid()`, onde `auth.uid()` é "o id de quem está
  logado agora"). Um Admin enxerga todas as solicitações da mesma empresa.
- Em `profiles`: cada pessoa só enxerga o próprio perfil.
- Em `organizations`: só quem pertence à empresa consegue ler os dados
  dela.

**Importante para entender o fluxo real deste projeto**: as páginas do
Employee não acessam o Supabase direto do navegador — elas passam pelos
Route Handlers (`src/app/api/...`), que usam a `service_role key`. Essa
chave especial **ignora RLS completamente** (é para uso só no servidor).
Então, na prática, quem impede um Employee de ver a solicitação de outra
pessoa hoje é o código do Route Handler (que já filtra por
`employee_id`) — o RLS é uma segunda trava de segurança, para o caso de
algo no futuro acessar o banco direto do navegador com a sessão do
usuário.

## 6. Usuários demo (`employee@demo.com` / `admin@demo.com`)

Essas duas contas **não são criadas pelo arquivo de migração SQL** — não
dá para inserir direto em `auth.users` via SQL comum, porque é uma tabela
gerenciada pelo Supabase Auth (senha, hashing etc). Foram criadas via a
Admin API do Supabase Auth (com a `service_role key`):

1. Usuário criado em `auth.users` com email/senha fixos (`email_confirm:
   true`, então não precisam de link de confirmação).
2. Linha correspondente inserida em `profiles`, com `role` e
   `organization_id` apontando para a organização seed (`Paggo (Demo)`).

Já criadas e prontas para uso:

| Papel | Email | Senha | `profiles.id` |
|---|---|---|---|
| Employee | `employee@demo.com` | `Employee#Demo2026` | `39557140-a4c1-46cc-803e-021b433332ab` |
| Admin | `admin@demo.com` | `Admin#Demo2026` | `b5c03efb-3a3e-42dd-96f7-45d398d3ac85` |

A tela de login vai exibir essas duas credenciais explicitamente (rotuladas
"Employee" / "Admin"), conforme decidido na fase de planejamento — é uma
conveniência para a demo, não uma prática recomendada para um produto real.

Quando o script de seed reprodutível (`scripts/seed-demo-users.ts`) for
escrito como parte da implementação do backend, ele deve fazer exatamente
esses dois passos — hoje foram feitos manualmente via chamadas diretas à
API, então não há ainda um script versionado para recriar as contas caso o
banco seja resetado.

## 7. Como isso aparece no código TypeScript

Depois que o backend estiver conectado, ler uma solicitação do banco via
Supabase client vai devolver um objeto assim (bem parecido com o tipo
`TravelRequest` que já existe hoje, só que "achatado" nos campos que viraram
coluna própria):

```jsonc
{
  "id": "b7e1...",
  "organization_id": "a3f0...",
  "employee_id": "9c21...",
  "status": "pending_admin",
  "total_amount": 2850.00,
  "total_currency": "BRL",
  "created_at": "2026-07-10T14:32:00Z",
  "search_criteria": { "slices": [...], "passengers": [...], "cabin_class": "economy" },
  "selected_offer_snapshot": { "offer_id": "off_...", "total_amount": "2850.00", ... },
  "passengers": [ { "id": "pas-1", "given_name": "Maria", ... } ],
  "corporate": { "trip_purpose": "client_meeting", "cost_center": "Engenharia", ... },
  "policy_evaluation": { "compliant": true, "violations": [], "flags": {...} },
  "events": [ { "at": "2026-07-10T14:32:00Z", "kind": "created" } ]
}
```

Uma camada pequena de mapeamento (função `toTravelRequest(row)`) vai
recompor isso de volta no formato `TravelRequest` exato que a UI já espera
— assim as páginas React não precisam saber que o dado veio do banco.

## 8. Próximos passos práticos

1. Rodar `supabase/migrations/0001_init.sql` no SQL Editor do Supabase
   (cria as 3 tabelas + RLS + a organização seed).
2. Rodar o script de seed dos 2 usuários demo (será entregue junto com a
   implementação do login).
3. Implementar os Route Handlers (`/api/flights/search`, `/api/requests`)
   que efetivamente leem/escrevem essas tabelas.
