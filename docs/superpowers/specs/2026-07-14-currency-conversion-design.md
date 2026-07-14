# Conversão de moeda (USD → BRL) — Design

**Goal:** as ofertas da Duffel voltam em `total_currency` variável (hoje, sempre USD nas buscas observadas), mas o app trata `totalAmount` como se já estivesse em BRL em vários lugares (`policy.ts`, `admin-analytics.ts`, exibição de preço). Este design normaliza toda oferta para BRL logo na entrada (mapeamento da resposta da Duffel), com uma cotação cacheada no Supabase e uma rede de segurança de 3 camadas para nunca falhar a busca de voos, mesmo se a API de câmbio estiver fora do ar (prioridade: confiabilidade no Demo day > precisão da cotação num cenário de falha dupla raríssimo).

## Escopo

**Dentro do escopo:**
- Módulo novo `src/lib/currency/exchange-rate.ts`: resolve a cotação de qualquer moeda → BRL, com cache no Supabase e fallback em camadas (nunca lança erro).
- Migration nova `0006_exchange_rates.sql`: tabela de cache global `exchange_rates`.
- `src/lib/duffel/map-offer.ts`: `mapDuffelOfferToFlightOffer` e `mapConditionDetail` passam a receber a cotação já resolvida e convertem `totalAmount` e `penalty_amount` para BRL. `currency` e `penalty_currency` do resultado passam a ser sempre `"BRL"`.
- `src/lib/duffel/client.ts` (`searchFlights`): resolve a(s) cotação(ões) necessárias (uma por moeda única entre as ofertas retornadas) antes de mapear.
- `src/lib/dev/database-schema.ts` + `src/app/dev/schema/page.tsx`: adiciona o node `exchange_rates` no diagrama React Flow (tabela standalone, sem edges).

**Fora de escopo:**
- Exibir o valor original ao lado do convertido — decidido: mostrar só BRL.
- Qualquer mudança em `src/lib/policy.ts` ou `src/lib/admin-analytics.ts` — como a conversão acontece na origem (mapeamento da oferta), essas camadas já recebem `totalAmount` em BRL sem precisar de nenhum ajuste.
- Mensagens de erro para o usuário relacionadas a câmbio — decidido explicitamente: a busca de voos nunca deve falhar por causa da cotação (ver "Tratamento de erros").

## Decisões confirmadas com o usuário

1. **Exibição:** só BRL, sem mostrar o valor original entre parênteses.
2. **Fonte de cotação:** AwesomeAPI (`economia.awesomeapi.com.br`), gratuita e sem autenticação.
3. **Cache:** tabela nova `exchange_rates` no Supabase (não dá pra embutir em `organizations`/`profiles`/`requests` — cotação é um dado de mercado global, não fica associado a nenhuma dessas entidades).
4. **Prioridade de confiabilidade (Demo day):** a busca de voos NUNCA pode falhar por causa da cotação. Se a API de câmbio cair e não houver nada em cache, usa uma constante hardcoded (`5.4`) em vez de lançar erro — aceitando que, nesse cenário raro (cache vazio + API fora do ar ao mesmo tempo), o valor pode ficar impreciso para moedas que não sejam USD.
5. **Diagrama do banco:** o arquivo React Flow (`src/lib/dev/database-schema.ts` / `src/app/dev/schema/page.tsx`) precisa ser atualizado junto com a migration, seguindo o padrão já documentado no topo do arquivo ("não há introspecção automática").

## Arquitetura

### `exchange_rates` (migration `0006_exchange_rates.sql`)

```sql
create table if not exists exchange_rates (
  currency text primary key,
  rate_to_brl numeric not null,
  fetched_at timestamptz not null default now()
);

alter table exchange_rates enable row level security;

create policy "exchange_rates_select_authenticated"
  on exchange_rates for select
  using (auth.uid() is not null);

create policy "exchange_rates_upsert_authenticated"
  on exchange_rates for insert
  with check (auth.uid() is not null);

create policy "exchange_rates_update_authenticated"
  on exchange_rates for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
```

Tabela global, sem `organization_id` e sem FK — cache de dado público de mercado, não sensível, por isso qualquer usuário autenticado pode ler/gravar.

### `src/lib/currency/exchange-rate.ts` (novo)

```ts
const FALLBACK_RATE_TO_BRL = 5.4; // última rede de segurança; calibrado para USD, atualizar periodicamente

export async function getRateToBRL(
  supabase: SupabaseClient,
  currency: string
): Promise<number>
```

Fluxo interno (nunca lança erro — sempre resolve para um número):

1. `currency === "BRL"` → retorna `1`, sem consultar o banco.
2. Busca a linha em `exchange_rates` para essa moeda. Se `fetched_at` é de hoje (data UTC) → retorna `rate_to_brl` cacheado.
3. Senão, tenta buscar na AwesomeAPI (`GET https://economia.awesomeapi.com.br/json/last/{currency}-BRL`, timeout curto ~3s). Sucesso → faz upsert em `exchange_rates` e retorna a nova cotação.
4. Falha na API, mas existe cache (mesmo antigo) → retorna o cache antigo (loga um aviso no servidor).
5. Falha na API **e** não existe nenhum cache para essa moeda → retorna `FALLBACK_RATE_TO_BRL` (constante única, não é mais um mapa por moeda).

### `src/lib/duffel/client.ts` (`searchFlights`)

Depois de obter `json.data.offers`:
1. Coleta o conjunto de moedas únicas (`total_currency`) presentes nas ofertas.
2. Resolve `getRateToBRL(supabase, currency)` para cada uma (normalmente 1 chamada, já que uma busca costuma retornar tudo na mesma moeda).
3. Monta `Record<string, number>` moeda → taxa.
4. Passa a taxa correspondente para `mapDuffelOfferToFlightOffer(offer, criteria, rate)`.

Precisa de um `SupabaseClient` — criado internamente com `createSupabaseServerClient()` (mesmo padrão já usado em `route.ts`), sem mudar a assinatura pública de `searchFlights`.

### `src/lib/duffel/map-offer.ts`

- `mapDuffelOfferToFlightOffer(raw, criteria, rateToBRL)`: `totalAmount = Number(raw.total_amount) * rateToBRL`, `currency: "BRL"`.
- `mapConditionDetail(raw, rateToBRL)`: quando `penalty_amount` existe, converte (`Number(penalty_amount) * rateToBRL`) e seta `penalty_currency: "BRL"`.

### Diagrama React Flow

- `src/lib/dev/database-schema.ts`: novo item em `schemaTables` para `exchange_rates` (colunas `currency` PK, `rate_to_brl`, `fetched_at`), `rls: true`, sem entrada nova em `schemaEdges` (tabela standalone).
- `src/app/dev/schema/page.tsx`: nova entrada em `positions` (ex.: `{ x: 1140, y: 40 }`, livre no canto superior direito do diagrama atual).

## Tratamento de erros

Por decisão explícita do usuário: **a busca de voos nunca falha por causa da cotação.** `getRateToBRL` sempre resolve para um número (real, cacheado ou o fallback `5.4`) — não lança exceção em nenhum caso. O único jeito de a rota `/api/flights/search` retornar erro continua sendo os erros que já existiam antes (`DuffelSearchError` vindo da própria Duffel). Timeout curto na chamada à AwesomeAPI evita que uma API lenta atrase a busca.

## Testes

- `exchange-rate.test.ts` (novo): mocka o cliente Supabase e o `fetch` da AwesomeAPI, cobrindo os 5 caminhos do fluxo (BRL direto, cache fresco, cache stale + API ok, API falha + cache antigo, API falha + sem cache → fallback `5.4`).
- `map-offer.test.ts` (existente, atualizado): passa `rateToBRL` nos casos de teste e verifica a conversão de `totalAmount` e `penalty_amount`.
