# Diagrama de schema (`/dev/schema`) — Notação crow's foot nas relações

**Contexto:** o diagrama ReactFlow em `src/app/dev/schema/page.tsx` (acessível via link em `/admin/settings`) desenha as relações de FK descritas em `schemaEdges` (`src/lib/dev/database-schema.ts`) como linhas `smoothstep` lisas, sem nenhum marcador nas pontas — não dá pra ver visualmente se uma relação é 1-pra-N, 1-pra-1 etc. sem ler o código/as migrations.

**Goal:** adicionar marcadores de notação crow's foot (pé de galinha) nas pontas das linhas, mostrando cardinalidade (1 ou N) em cada relação. Mudança é só na camada de apresentação (dado estático em TS + SVG do ReactFlow) — nenhuma migration SQL, nenhuma mudança no banco real.

## Escopo

**Dentro do escopo:**
- Campo novo opcional `oneToOne?: boolean` em `SchemaEdge` (`src/lib/dev/database-schema.ts`). Default (ausente/`false`) = relação 1-pra-N. Só a edge `profiles-auth_users` recebe `oneToOne: true`.
- Dois `<marker>` SVG novos definidos uma vez em `src/app/dev/schema/page.tsx`, dentro de um `<svg>` oculto (`width={0} height={0}`, `position: absolute`) renderizado antes do `<ReactFlow>`:
  - `crowfoot-one`: uma barra vertical simples (lado "um").
  - `crowfoot-many`: um pé de galinha de 3 pontas (lado "muitos").
  - Ambos com `viewBox`/`refX`/`orient="auto"` fixos (sem `orient="auto-start-reverse"` nem rotação dinâmica — todas as conexões do diagrama são horizontais, handles sempre `Position.Left`/`Position.Right`).
  - Cor: `style={{ fill: "hsl(var(--muted-foreground))" }}` no path/polyline interno do marker, igual ao `stroke` que a linha já usa hoje — acompanha dark/light mode automaticamente.
- No `useMemo` das edges (`page.tsx`): cada edge ganha `markerStart` (ponta em `source`, lado da FK) e `markerEnd` (ponta em `target`, lado da PK):
  - Caso normal (`oneToOne` ausente): `markerStart: 'url(#crowfoot-many)'`, `markerEnd: 'url(#crowfoot-one)'`.
  - Caso `oneToOne: true`: os dois lados usam `'url(#crowfoot-one)'`.

**Fora de escopo:**
- Qualquer migration SQL ou mudança no schema real do Supabase — `database-schema.ts` é só a descrição estática que alimenta o diagrama (comentário já existente no topo do arquivo).
- Notação de opcionalidade (círculo pra FK nullable vs. barra dupla pra obrigatória) — decisão do usuário foi só cardinalidade 1/N, sem distinguir obrigatório/opcional.
- Mudança em `table-node.tsx` ou nos `Handle` — os marcadores ficam só nas pontas da linha (edge), não nos handles dos nós.
- Suporte a N-pra-N — não existe nenhuma relação N-N no schema atual (todas as 8 edges são 1-pra-N, exceto `profiles-auth_users` que é 1-pra-1), então não há necessidade de um terceiro tipo de marker.
- Edge customizado (`type` diferente de `"smoothstep"`) ou lógica de rotação — desnecessário já que toda conexão é horizontal.

## Decisões confirmadas com o usuário

1. **Nível de detalhe:** só cardinalidade (1/N), sem opcionalidade.
2. **Nenhuma mudança no banco:** confirmado explicitamente — a mudança é 100% em `database-schema.ts` (TS estático) e `page.tsx` (SVG/ReactFlow), nada em `supabase/migrations/`.
3. **Técnica:** `<marker>` SVG nativos referenciados via `markerStart`/`markerEnd` do ReactFlow, não um componente de edge customizado — porque todas as 8 relações conectam sempre `Position.Right` (FK, fonte) → `Position.Left` (PK, alvo), nunca em ângulo, então marker com orientação fixa já resolve.

## Mapeamento das 8 edges

Todas 1-pra-N (default), exceto a marcada 1-pra-1:

| Edge | Lado N (source) | Lado 1 (target) |
|---|---|---|
| `profiles-organizations` | profiles | organizations |
| `requests-organizations` | requests | organizations |
| `requests-profiles` | requests | profiles |
| `policy_rules-organizations` | policy_rules | organizations |
| `profiles-auth_users` | profiles (**1-pra-1**) | auth.users |
| `onsite_weeks-organizations` | onsite_weeks | organizations |
| `onsite_weeks-profiles` | onsite_weeks | profiles |
| `requests-onsite_weeks` | requests | onsite_weeks |

## Testes

Sem teste automatizado — página visual/dev-only (`/dev/schema`), sem lógica testável isoladamente (mesma convenção de outras specs de componentes visuais deste projeto).

**Verificação manual em `/dev/schema`:**
1. Abrir `/admin/settings` → clicar no link do diagrama → confirmar que ainda abre `/dev/schema` normalmente.
2. Cada uma das 7 relações 1-pra-N mostra pé de galinha (3 pontas) no lado da tabela com a FK e uma barra simples no lado da tabela com a PK.
3. A relação `profiles → auth.users` mostra barra simples nos dois lados (1-pra-1), não pé de galinha.
4. Cor dos marcadores acompanha o `stroke` atual da linha (mesmo tom `muted-foreground`) em light e dark mode.
5. Zoom/pan no ReactFlow não distorce nem desalinha os marcadores.
6. `npx tsc --noEmit`, `npm run build`, `npm run lint` sem erros.
