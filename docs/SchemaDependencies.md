# SchemaDependencies — por que esse esquema de dependências

> Complementa [`SchemaGuide.md`](./SchemaGuide.md) (o que cada tabela/coluna
> significa) e o diagrama
> [`Schema-Banco-de-Dados.excalidraw`](./Schema-Banco-de-Dados.excalidraw)
> (visualização das dependências). Este arquivo justifica *por que* as
> dependências entre tabelas foram desenhadas dessa forma, e quais outras
> formas foram consideradas.

## 1. O esquema de dependências atual

```
auth.users (Supabase Auth, gerenciada)
      ▲
      │ id (1:1, on delete cascade)
      │
organizations ◄────────────┐
      ▲                    │
      │ organization_id    │ organization_id (redundante)
      │                    │
   profiles ◄───────────── requests
                employee_id
```

Quatro dependências (foreign keys):
1. `profiles.id → auth.users.id` (`on delete cascade`)
2. `profiles.organization_id → organizations.id`
3. `requests.organization_id → organizations.id`
4. `requests.employee_id → profiles.id`

## 2. Por que cada dependência foi escolhida

### `organizations` é a raiz
Não depende de nada. Hoje existe uma única linha no MVP ("Paggo (Demo)"),
mas a tabela já existe separada porque, segundo o `SchemaGuide.md`, "a
coluna já existe nas outras tabelas para não precisar redesenhar o banco
quando o produto crescer para múltiplas empresas-clientes" — ou seja, a
dependência foi desenhada pensando em multi-tenant desde o início, mesmo o
produto sendo single-tenant hoje.

### `profiles → auth.users`
`profiles` estende `auth.users` (tabela interna do Supabase Auth, que já
guarda email/senha) em vez de duplicar esses dados. O `id` de `profiles` é
literalmente o mesmo `id` de `auth.users`, com `on delete cascade`: se o
usuário for removido do Auth, o perfil correspondente desaparece
automaticamente, sem deixar registro órfão.

### `profiles → organizations`
Cada pessoa pertence a exatamente uma empresa. Direto e sem redundância —
não há motivo de performance ou RLS que justifique duplicar isso em outro
lugar, já que `profiles` é a "folha" que qualquer outra consulta de
organização acaba visitando de qualquer forma.

### `requests → organizations` **e** `requests → profiles` (redundância proposital)
Essa é a decisão mais deliberada do schema. `requests.organization_id`
poderia, em teoria, ser sempre derivado via join
(`requests.employee_id → profiles.organization_id`) — sem precisar existir
como coluna própria. Mas o `SchemaGuide.md` documenta explicitamente que
foi mantido redundante "pra deixar filtros e RLS mais simples/rápidos".

Isso importa porque as políticas de RLS do Postgres rodam **por linha, em
toda query** (seção 5 do `SchemaGuide.md`). Uma policy como
`requests_select_own_or_admin` que precisasse fazer join com `profiles`
toda vez que alguém lê uma linha de `requests` é mais cara do que comparar
uma coluna direta (`requests.organization_id = ...`). Em troca dessa
performance, o schema aceita um risco de inconsistência (teoricamente,
`requests.organization_id` poderia divergir do `organization_id` do
`profiles` apontado por `employee_id`) que não é impedido por nenhuma FK —
teria que ser garantido pela aplicação (Route Handlers), já que hoje não
existe um `check constraint` ou trigger cruzando as duas colunas.

## 3. Outros esquemas de dependência possíveis (e por que não foram escolhidos agora)

### a) Normalizar de vez: remover `requests.organization_id`
Eliminaria o risco de inconsistência citado acima e deixaria o schema mais
"canônico" (uma FK por fato, sem redundância). O custo é que toda policy de
RLS e toda query administrativa (ex: "todas as requests da empresa X")
passaria a depender de um join extra em `profiles` — pior para performance
à medida que o volume de `requests` cresce, já que RLS reavalia a condição
por linha. Foi a troca que os autores do schema já fizeram conscientemente
ao manter a redundância (decisão registrada no `SchemaGuide.md`, não é uma
alternativa nova).

### b) Tabela de associação `memberships` (many-to-many) entre `profiles` e `organizations`
Hoje `profiles.organization_id` assume que uma pessoa pertence a **uma
única** empresa para sempre. Uma tabela de associação separada permitiria
alguém pertencer a mais de uma organização (ex: um consultor que atende
duas empresas-cliente). Essa alternativa não está documentada como
descartada explicitamente, mas é consistente com a mesma lógica que já
levou à decisão de manter `organization_id` como coluna própria em várias
tabelas: o produto está no estágio single-tenant/MVP e esse tipo de
generalização foi conscientemente adiado para quando (e se) o requisito
aparecer — introduzi-la agora seria complexidade sem uso real ainda.

### c) Tabelas separadas em vez de `jsonb` em `requests`
Não é uma dependência entre tabelas *hoje*, mas seria uma alternativa de
schema: quebrar `search_criteria`, `selected_offer_snapshot`, `passengers`,
`corporate`, `policy_evaluation` e `events` em tabelas próprias (ex.:
`request_passengers`), cada uma com FK para `requests.id`. O
`SchemaGuide.md` (seção 4) já registra por que isso foi descartado por
enquanto: os campos espelham quase 1:1 os tipos TypeScript já existentes, e
menos tabelas significa menos `JOIN`s para o tamanho atual do projeto. O
trade-off documentado: fica mais difícil fazer perguntas analíticas do tipo
"todos os passageiros chamados João, em qualquer solicitação" via SQL puro
— mas essa necessidade não existe nas telas de hoje.

### d) `on delete cascade` vs. `on delete set null` / soft delete em `profiles → auth.users`
O schema usa `cascade`: remover o usuário do Auth remove o perfil junto. A
alternativa (`set null` ou soft delete) preservaria o perfil como histórico
mesmo depois do usuário ser removido do Auth — por exemplo, para manter o
nome de quem aprovou uma `request` no passado mesmo que a conta tenha sido
desativada. `cascade` foi a escolha mais simples para o MVP (evita perfis
órfãos), mas é um ponto a revisitar se o produto precisar de
auditoria/histórico de longo prazo.

## 4. Conclusão

O esquema atual otimiza para (1) simplicidade de um MVP single-tenant e (2)
performance das checagens de RLS por linha, aceitando em troca uma
redundância controlada (`requests.organization_id`) e adiando
generalizações que ainda não têm caso de uso real (multi-empresa por
pessoa, tabelas normalizadas para os campos hoje em `jsonb`). É uma escolha
razoável para a fase atual do projeto — mas as decisões (b), (c) e (d)
acima são os pontos mais prováveis de precisar revisão quando o Admin Panel
e o multi-tenant real forem implementados.
