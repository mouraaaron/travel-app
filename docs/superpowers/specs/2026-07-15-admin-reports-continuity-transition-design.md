# Admin Reports — Continuity Transition — Design

**Goal:** hoje, em `/admin/reports`, ao clicar num funcionário na tabela de ranking, o `EmployeeDetail` (abas "Todas" / "Gasto mensal" / "Desvios de política") é inserido *abaixo* da tabela na mesma página — o admin precisa rolar a tela para ver o relatório. Esta mudança substitui isso por uma transição de sobreposição em tela cheia: o relatório do funcionário "cresce" a partir da linha clicada até ocupar toda a área de conteúdo, com uma seta de voltar no canto superior esquerdo para retornar à lista.

## Escopo

**Dentro do escopo:**
- `src/components/admin/employee-ranking-table.tsx`: substituir a renderização condicional simples do `EmployeeDetail` por uma transição orquestrada com `framer-motion` (nova dependência).
- Novo componente `src/components/admin/employee-report-panel.tsx`: envolve o `EmployeeDetail` existente, adiciona o cabeçalho com âncora (avatar + nome) e o botão de voltar.
- Nenhuma mudança de rota, de dados buscados no servidor, ou no conteúdo das abas do `EmployeeDetail` em si.

**Fora de escopo:**
- Navegação por URL (`/admin/reports/[id]`) — deliberadamente não incluída; ver "Decisões confirmadas" abaixo.
- Qualquer transição em `/admin/employees` ou `/admin/requests` — só `/admin/reports` está no escopo, mesmo que o padrão possa ser reaproveitado depois.
- Mudanças no conteúdo/lógica de `EmployeeDetail`, `EmployeeRequestsTable`, `SpendChart` — só a casca (como e onde são exibidos) muda.

## Decisões confirmadas com o usuário

1. **Estado local, não rota.** `selectedEmployeeId` continua sendo estado React em `EmployeeRankingTable`; não há navegação real. A "seta de voltar" é apenas para o admin retornar visualmente à lista, não um `router.back()`.
2. **Âncora do morph = avatar + nome**, não a linha inteira. Uma `<tr>` transformada via FLIP distorce células e bordas; o elemento com `layoutId` compartilhado é o par avatar+nome, que voa da célula da tabela até o cabeçalho do painel de relatório.
3. **Overlay cobre só a área de conteúdo** (`<main>`, respeitando `lg:pl-[248px]` da sidebar) — não a viewport inteira. A sidebar (`AppSidebar`) continua visível e clicável durante a transição.
4. **Dependência nova:** `framer-motion`. Sem ela, `layoutId` (a técnica de shared-element) exigiria FLIP manual (medir `getBoundingClientRect`, aplicar `transform` inicial, animar via CSS) — mais código para manter e mais frágil em resize/scroll.
5. **Coreografia de abertura** (~400ms total):
   - Demais linhas da tabela + cabeçalho do card fazem fade-out + scale-down (~0.98) em ~150ms.
   - Avatar+nome (`layoutId`) voa até o cabeçalho do painel via spring (`stiffness: 300, damping: 30`), não `ease` linear.
   - Conteúdo do painel (abas + `EmployeeDetail`) entra com fade + slide-up (8–12px) com ~80ms de atraso em relação à âncora.
   - **Fechamento é o inverso:** conteúdo do painel sai primeiro, âncora volta voando para a linha original, linhas da tabela reaparecem com fade-in + scale-up de volta a 1.
6. **Tabela permanece montada** durante toda a transição (nunca desmonta), só fica oculta/atrás via `AnimatePresence`, para permitir a animação reversa ao fechar.

## Arquitetura

### Dependência

- Adicionar `framer-motion` a `package.json` (`npm install framer-motion`).

### `src/components/admin/employee-ranking-table.tsx`

- Envolver a tabela e o painel de relatório em um único `motion.div` com `LayoutGroup` (do framer-motion) para que o `layoutId` do avatar seja resolvido entre os dois — `LayoutGroup` isola esse `layoutId` de outras instâncias da tabela que possam existir na página (não há hoje, mas evita acoplamento futuro).
- Na célula "Funcionário" de cada `TableRow`, envolver `Avatar` + nome num `motion.div layoutId={`employee-anchor-${row.employeeId}`}` (só quando aquela linha for a selecionada, para não computar layout de todas as linhas — ver nota de performance abaixo).
- Quando `selectedEmployeeId` não é `null`:
  - Tabela: `motion.div` com `animate={{ opacity: 0, scale: 0.98 }}` (ao invés de deixar de renderizar) — mantém montada mas oculta.
  - `AnimatePresence` envolve o `EmployeeReportPanel`, que entra com `layoutId` compartilhado no cabeçalho.
- Quando volta a `null`: estados invertidos, `AnimatePresence` cuida do exit do painel antes de reativar a tabela (`onExitComplete` ou coordenação via `mode="sync"` com variants, a definir no plano de implementação).

### Novo: `src/components/admin/employee-report-panel.tsx`

- Recebe as mesmas props que `EmployeeDetail` hoje recebe (`employeeId`, `employeeName`, `requests`) + `onBack: () => void`.
- Estrutura:
  ```
  <motion.div className="absolute inset-0 z-10 bg-background"> {/* painel */}
    <div className="flex items-center gap-3 border-b p-4">
      <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar para a lista">
        <ArrowLeft />
      </Button>
      <motion.div layoutId={`employee-anchor-${employeeId}`} className="flex items-center gap-2">
        <Avatar>...</Avatar>
        <span>{employeeName}</span>
      </motion.div>
    </div>
    <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay:0.08}}>
      <EmployeeDetail employeeId={employeeId} employeeName={employeeName} requests={requests} />
    </motion.div>
  </motion.div>
  ```
- `EmployeeDetail` (`src/components/admin/employee-detail.tsx`) não muda — abas continuam sempre resetando para `"all"` (`defaultValue="all"`) a cada montagem, o que já satisfaz "não persistir última aba vista" já que o painel desmonta/remonta a cada seleção.

### `AppSidebar` / `admin/layout.tsx`

- Sem mudanças — o overlay já nasce restrito a `<main>` porque `EmployeeRankingTable` é renderizado dentro de `{children}`.

## Interação e acessibilidade

- **Esc fecha o painel:** listener de `keydown` (via `useEffect` no `EmployeeReportPanel` ou hook compartilhado) chama `onBack` quando `selectedEmployeeId !== null`.
- **Foco:** ao abrir, mover foco para o botão de voltar (`ref.current?.focus()` num `useEffect`); ao fechar, retornar foco para a `TableRow` selecionada (precisa de `ref` por linha, guardado num `Map` ou `ref` único atualizado no clique).
- **`prefers-reduced-motion`:** usar `useReducedMotion()` do framer-motion; quando `true`, todas as transições acima caem para um cross-fade simples de ~100ms, sem spring da âncora nem scale/slide das outras linhas.
- **Performance:** `layoutId` só é atribuído à linha correspondente a `selectedEmployeeId` (nunca a todas as linhas simultaneamente), evitando que o framer-motion precise rastrear layout de todas as linhas da tabela a cada render.

## Testes

- Sem lógica de negócio nova (é composição visual sobre dados já mapeados) — nenhum teste unitário novo necessário além dos já existentes para `admin-analytics` (não afetados).
- Verificação manual (via skill `verify`/`run` depois da implementação):
  1. Clicar num funcionário na tabela → relatório abre com a animação de morph (âncora + fade das linhas + slide do conteúdo).
  2. Clicar na seta de voltar → animação reversa, tabela volta ao estado normal, foco retorna à linha.
  3. Pressionar Esc com o painel aberto → mesmo comportamento do botão de voltar.
  4. Ativar "reduzir movimento" no SO (ou emular via DevTools `prefers-reduced-motion`) → transição vira cross-fade simples.
  5. Confirmar que a sidebar (`AppSidebar`) permanece visível e clicável com o painel de relatório aberto.
  6. Trocar de funcionário diretamente (clicar em outro, sem fechar antes) — via UI isso não é possível hoje (a tabela fica oculta atrás do painel), então não é um caso a tratar.
