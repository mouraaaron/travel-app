# Custo de Semanas Presenciais — Design

**Goal:** hoje o painel principal (`/admin`) mostra "Funcionários por setor" (headcount) e a tela de detalhe de uma semana presencial (`/admin/onsite-weeks/[id]`) só mostra, por funcionário, o resultado (solicitação aprovada ou falha) — sem nenhum valor de custo. Esta mudança (1) substitui o gráfico de headcount por um gráfico de custo médio de viagem de semana presencial por setor, e (2) adiciona o custo de cada passagem e o custo total na tela de detalhe.

## Escopo

**Dentro do escopo:**
- `src/lib/admin-analytics.ts`: nova função `avgOnsiteWeekCostBySector`; remoção de `headcountBySector`.
- `src/components/admin/spend-breakdown-charts.tsx`: novo componente `AvgOnsiteWeekCostChart`; remoção de `SectorHeadcountChart`.
- `src/app/admin/page.tsx`: troca do gráfico de headcount pelo novo gráfico, no mesmo lugar do grid.
- `src/app/admin/onsite-weeks/[id]/page.tsx`: busca adicional das `requests` do lote, para obter custo por funcionário.
- `src/components/admin/onsite-week-detail.tsx`: nova coluna de custo por passagem + card de custo total, com animação de entrada via `framer-motion`.
- `package.json`: adiciona `framer-motion`.

**Fora de escopo:**
- Qualquer mudança na página `/admin/onsite-weeks` (lista) — não recebe coluna de custo nem total agregado.
- Reestruturar a navegação lista→detalhe de semanas presenciais para seleção por estado local (padrão usado em `/admin/reports`) — essa tela continua navegando por rota (`router.push`); não há shared-element morph entre a linha da lista e o cabeçalho do detalhe.
- Qualquer mudança em `/admin/reports` ou na feature de transição de continuidade em si (`docs/superpowers/specs/2026-07-15-admin-reports-continuity-transition-design.md`) — só reaproveitamos o vocabulário de animação de "conteúdo que aparece" definido lá.
- Suporte a múltiplas moedas dentro de uma mesma semana presencial (todas as viagens de uma semana presencial são ida/volta origem→Curitiba, doméstico, mesma moeda na prática).

## Decisões confirmadas com o usuário

1. **Escopo da média (gráfico do painel):** só solicitações com `onsite_week_id` preenchido e status `approved`/`confirmed` entram na média — mesmo critério de "gasto realizado" (`REALIZED_SPEND_STATUSES`) já usado em `spendBySector`. Setor sem nenhuma solicitação realizada tem média 0.
2. **Custos de solicitações canceladas (tela de detalhe):** continuam aparecendo normalmente, tanto por passageiro quanto no total. O valor foi de fato precificado quando a solicitação foi criada; cancelamento posterior não apaga esse histórico de custo.
3. **Animação:** reaproveita só o vocabulário de "conteúdo que aparece" da spec de `admin-reports-continuity-transition` — fade-in + slide-up (`opacity:0→1, y:10→0`, `duration:0.25, delay:0.08, ease:"easeOut"`), via `framer-motion`, respeitando `prefers-reduced-motion`. Não replica o morph completo (linha da tabela virando cabeçalho de outra tela), porque a navegação lista→detalhe de semanas presenciais é por rota, não por estado local — replicar o morph exigiria reestruturar essa navegação, o que está fora do pedido original.

## Parte 1 — Gráfico "Custo médio de viagem de semana presencial por setor" (`/admin`)

### `src/lib/admin-analytics.ts`

Nova função, ao lado de `spendBySector`/`headcountBySector`:

```ts
export function avgOnsiteWeekCostBySector(
  requests: AdminQueueRequest[]
): { sector: Sector; average: number }[] {
  const totals = new Map<Sector, { sum: number; count: number }>(
    SECTORS.map((sector) => [sector, { sum: 0, count: 0 }])
  );
  for (const request of requests) {
    if (!request.onsite_week_id) continue;
    if (!isRealizedSpend(request)) continue;
    const key = request.corporate.cost_center as Sector;
    const entry = totals.get(key);
    if (!entry) continue;
    entry.sum += requestSpend(request);
    entry.count += 1;
  }
  return SECTORS.map((sector) => {
    const entry = totals.get(sector)!;
    return { sector, average: entry.count === 0 ? 0 : entry.sum / entry.count };
  });
}
```

Remove `headcountBySector` e o import de `Employee` de `./employees-mapper` em `admin-analytics.ts` (não sobra nenhum outro uso desse tipo no arquivo).

### `src/components/admin/spend-breakdown-charts.tsx`

Novo componente, no padrão visual do `SectorSpendChart` (barra horizontal, eixo X formatado em moeda):

```tsx
const AVG_ONSITE_WEEK_COST_CONFIG: ChartConfig = {
  average: { label: "Custo médio", color: "hsl(var(--chart-4))" },
};

export function AvgOnsiteWeekCostChart({ data }: { data: { sector: Sector; average: number }[] }) {
  const chartData = data.map((entry) => ({ label: SECTOR_LABELS[entry.sector], average: entry.average }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custo médio de viagem de semana presencial por setor</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={AVG_ONSITE_WEEK_COST_CONFIG} className="h-64 w-full">
          <BarChart data={chartData} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatCurrency(Number(value), "BRL")}
            />
            <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={100} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value), "BRL")} />}
            />
            <Bar dataKey="average" fill="var(--color-average)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

Remove `SectorHeadcountChart` e `SECTOR_HEADCOUNT_CONFIG`.

### `src/app/admin/page.tsx`

- Remove o import/uso de `headcountBySector`, `SectorHeadcountChart`, e a busca de `employeeRows`/`employees` (hoje só alimentam o headcount, que deixa de existir) e o import de `toEmployee`/`EmployeeRow`.
- Adiciona `avgOnsiteWeekCostBySector(requests)` e renderiza `<AvgOnsiteWeekCostChart data={avgOnsiteWeekCost} />` no lugar de `<SectorHeadcountChart data={headcount} />`, mesma posição no grid (`xl:grid-cols-2`, ao lado de `SectorVolumeChart`).

## Parte 2 — Custo por passagem e custo total (`/admin/onsite-weeks/[id]`)

### `src/app/admin/onsite-weeks/[id]/page.tsx`

Além do `select("*")` em `onsite_weeks`, busca as solicitações do lote:

```ts
const { data: requestRows } = await supabase
  .from("requests")
  .select("id, total_amount, total_currency")
  .eq("onsite_week_id", params.id);
```

Monta um mapa `request_id → { amount: number; currency: string }` e passa como nova prop `requestCosts` para `OnsiteWeekDetail`.

### `src/components/admin/onsite-week-detail.tsx`

- Assinatura: `OnsiteWeekDetail({ onsiteWeek, requestCosts }: { onsiteWeek: OnsiteWeek; requestCosts: Record<string, { amount: number; currency: string }> })`.
- Nova coluna **"Custo"** na `Table`: para outcomes `created`, `formatCurrency(cost.amount, cost.currency)` usando `requestCosts[outcome.request_id]` (fallback "—" se não houver entrada, o que não deveria acontecer em operação normal); para `failed`, "—".
- Novo card de resumo de **custo total**, posicionado junto ao cabeçalho (ao lado dos badges de setor/status): soma `amount` de todas as entradas de `requestCosts` referenciadas por outcomes `created` (independente do status atual da solicitação — inclui canceladas). Moeda de exibição: a `currency` da primeira entrada encontrada (na prática sempre BRL, viagens domésticas origem→Curitiba).
- Animação de entrada (framer-motion) na coluna "Custo" e no card de total:
  ```tsx
  const shouldReduceMotion = useReducedMotion();
  const contentMotion = shouldReduceMotion
    ? {}
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.25, delay: 0.08, ease: "easeOut" } };
  ```
  Aplicado a um `motion.div` envolvendo o card de total e a `Table` (ou só as partes novas, a definir no plano de forma a não duplicar wrapper desnecessário).

### `package.json`

Adiciona `framer-motion` (`npm install framer-motion`) — mesma dependência introduzida pela feature de continuidade em `/admin/reports`, ainda não presente na branch principal.

## Testes

- `src/lib/admin-analytics.test.ts`: remove os testes de `headcountBySector`; adiciona testes para `avgOnsiteWeekCostBySector` cobrindo:
  - Solicitações de mais de um setor → média correta por setor.
  - Solicitação sem `onsite_week_id` → não entra na média.
  - Solicitação com `onsite_week_id` mas status `rejected`/`pending_admin`/`cancelled` → não entra na média.
  - Setor sem nenhuma solicitação qualificada → média 0.
- Sem testes automatizados novos para `.tsx` (páginas/componentes) — segue a convenção já estabelecida no projeto (só módulos puros em `src/lib` têm Vitest; páginas/componentes são verificados via `tsc --noEmit`, `npm run build`, `npm run lint` e checklist manual).
- Verificação manual:
  1. `/admin` mostra o novo gráfico no lugar do de headcount, com médias plausíveis por setor.
  2. `/admin/onsite-weeks/[id]` de uma semana presencial concluída mostra custo por funcionário e o total, com a animação de fade-in + slide-up ao carregar.
  3. Mesma tela para uma semana presencial **cancelada** — custos continuam aparecendo.
  4. `prefers-reduced-motion` ativado → conteúdo aparece sem animação.
  5. `npx tsc --noEmit`, `npm run build`, `npm run lint` sem erros.
