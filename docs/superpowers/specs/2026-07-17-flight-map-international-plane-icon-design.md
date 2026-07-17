# Mapa "Viagens em curso" — Ícone de avião real para voos internacionais

**Contexto:** o card de mapa em `/admin` (`src/components/admin/flight-path-map.tsx`, ver `docs/superpowers/specs/2026-07-16-flight-map-design.md` e `docs/superpowers/specs/2026-07-16-flight-map-recent-flights-design.md`) hoje anima, para **todo** voo (em curso ou concluído, doméstico ou internacional), um pequeno triângulo/chevron SVG desenhado à mão (`<polygon points="-4,-2.5 4,0 -4,2.5 -2,0">`) ao longo da curva Bézier, via `<animateMotion rotate="auto">`. O ícone `Plane` do `lucide-react` só aparece hoje no estado vazio do card ("Nenhuma viagem em curso no momento"), nunca sobre as linhas.

**Goal:** trocar esse chevron por um ícone de avião real (path do `Plane` do lucide-react) **apenas para voos internacionais** — curvas domésticas são curtas demais para o ícone mais detalhado ficar legível/bonito, então continuam com o chevron atual, sem nenhuma mudança visual.

## Escopo

**Dentro do escopo:**
- Novo helper puro `isInternationalRoute(originCode: string, destinationCode: string): boolean` em `src/lib/airports.ts`, ao lado do `isInternational(iataCode: string)` já existente (que fica intocado).
- `src/components/admin/flight-path-map.tsx`: para cada voo, calcula `isInternationalRoute(flight.origin.code, flight.destination.code)` e renderiza um `<path>` com o glifo do lucide `Plane` (internacional) ou mantém o `<polygon>` atual (doméstico), reaproveitando o mesmo `<animateMotion>`/fallback estático de `prefers-reduced-motion` para os dois casos.
- Novo `describe("isInternationalRoute", ...)` em `src/lib/airports.test.ts`.

**Fora de escopo:**
- Qualquer mudança no visual/comportamento de voos domésticos — chevron, cor, animação, tudo permanece exatamente como está hoje.
- Qualquer mudança em `isInternational(iataCode)`, `policy.ts` ou `flight-map-selection.ts` — o critério "internacional" usado para elegibilidade nos 5 slots do mapa (`docs/superpowers/specs/2026-07-16-flight-map-recent-flights-design.md`) continua sendo só `isInternational(destination)`; `isInternationalRoute` é uma função nova e separada, usada só para decidir o ícone.
- Mudança de interface (`InCourseFlight`) — o cálculo é feito dentro do próprio `flight-path-map.tsx`, a partir de `origin.code`/`destination.code` que o componente já recebe.
- Limiar de distância/comprimento de curva como critério alternativo a "internacional" — foi considerado e descartado; o critério é estritamente geográfico (país de origem ou destino).
- Teste automatizado para o componente visual (`flight-path-map.tsx`) — mantém a convenção já registrada nos specs anteriores deste mapa (só módulos `src/lib` puros têm Vitest).

## Decisões confirmadas com o usuário

1. **Critério "internacional":** `isInternational(originCode) || isInternational(destinationCode)` — origem OU destino fora do Brasil. Cobre o caso de "voo de volta" que o `isInternational(destino)` sozinho erraria (ex.: `JFK → GRU` tem destino Brasil, mas é claramente uma curva longa/internacional).
2. **Onde calcular:** dentro do próprio `flight-path-map.tsx`, por voo renderizado — não rio acima em `flight-map-selection.ts`/`in-course-flights.ts`, e sem novo campo na interface `InCourseFlight`.
3. **Técnica de renderização:** mesmo mecanismo SMIL de hoje (`<animateMotion rotate="auto">`, sem CSS `offset-path`, sem `foreignObject`, sem `setInterval`/`requestAnimationFrame`). O path do ícone `Plane` do lucide-react (`node_modules/lucide-react/dist/esm/icons/plane.mjs`, viewBox `24x24`, um único `<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z">`) é copiado como constante local em `flight-path-map.tsx`, **não** importado como componente React (evita misturar HTML/React dentro do `<svg>`).
4. **Fallback doméstico:** inalterado — mesmo `<polygon>` chevron, mesma animação, mesma cor por status.
5. **Cor:** reaproveita `FLIGHT_COLOR[flight.status]` (`#0ea5e9` em curso / `#94a3b8` concluído) já usado pelo chevron — nenhuma cor nova introduzida.
6. **Escala e rotação:** o glifo lucide começa em ~14 unidades de largura no `viewBox="0 0 800 400"` (chevron atual tem 8), com um offset de rotação fixo somado ao `rotate="auto"` do `animateMotion` para compensar a orientação diagonal padrão do ícone lucide. **Valores exatos (`scale`, offset de rotação) são ajustados visualmente durante a implementação**, olhando o resultado real sobre uma curva internacional no navegador — não são cravados nesta spec.

## Implementação (`flight-path-map.tsx`)

```ts
// Path copiado de node_modules/lucide-react/dist/esm/icons/plane.mjs — viewBox 24x24.
const PLANE_ICON_PATH =
  "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";
```

No `<g>` de cada voo (onde hoje vive o `<polygon>` dentro do `<Tooltip>`/`<TooltipTrigger>`), o conteúdo do "marcador móvel" passa a depender de `isInternationalRoute(flight.origin.code, flight.destination.code)`:

- **Internacional:** `<g transform="scale(s) translate(-12,-12) rotate(offsetFixo)"><path d={PLANE_ICON_PATH} fill={color} /></g>`, com o mesmo `<animateMotion path={path} dur={...} begin={...} fill="freeze" rotate="auto">` de hoje dentro desse `<g>` (em vez de dentro do `<polygon>`).
- **Doméstico:** exatamente o `<polygon points="-4,-2.5 4,0 -4,2.5 -2,0" fill={color}>` de hoje, sem mudança.

O fallback estático de `prefers-reduced-motion` (`transform="translate(${staticPlanePoint.x} ${staticPlanePoint.y})"` no `<g>` pai) continua idêntico para os dois casos — só o conteúdo interno do marcador muda.

## Testes

Novo bloco em `src/lib/airports.test.ts`:

```ts
describe("isInternationalRoute", () => {
  it("returns false when both origin and destination are domestic", () => {
    expect(isInternationalRoute("GRU", "CNF")).toBe(false);
  });

  it("returns true when only the destination is international", () => {
    expect(isInternationalRoute("GRU", "JFK")).toBe(true);
  });

  it("returns true when only the origin is international (return leg)", () => {
    expect(isInternationalRoute("JFK", "GRU")).toBe(true);
  });

  it("returns true when both origin and destination are international", () => {
    expect(isInternationalRoute("JFK", "LHR")).toBe(true);
  });
});
```

Sem teste automatizado novo para `flight-path-map.tsx` (convenção já registrada nos specs anteriores deste mapa — componente visual/animado é verificado manualmente).

**Verificação manual em `/admin`:**
1. Voo em curso doméstico → chevron azul de hoje, sem mudança visual.
2. Voo concluído doméstico → chevron cinza de hoje, sem mudança visual.
3. Voo em curso internacional (ex. `GRU→JFK`) → ícone de avião lucide, azul, orientado corretamente ao longo da curva, tamanho legível.
4. Voo concluído internacional **de volta** (ex. `JFK→GRU`, destino Brasil mas origem internacional) → ícone de avião cinza — confirma que `isInternationalRoute` cobre esse caso que `isInternational(destino)` sozinho erraria.
5. `prefers-reduced-motion` ativado (emulado no DevTools) → ícone internacional aparece estático na posição correta, sem animação — mesma lógica do chevron hoje.
6. Hover sobre o ícone (doméstico ou internacional) → tooltip com nome/rota/horários continua funcionando normalmente.
7. `npx tsc --noEmit`, `npm run build`, `npm run lint` sem erros.
