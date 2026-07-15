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
5. **Tabela permanece montada** durante toda a transição (nunca desmonta), só fica oculta/atrás via `AnimatePresence`, para permitir a animação reversa ao fechar.
6. A animação é o núcleo desta feature, não um detalhe cosmético opcional — ver seção dedicada "## Animação" abaixo, com os valores concretos que a implementação deve usar.

## Animação

Esta é a parte central da feature — a tabela e o painel são a "casca"; é a transição entre eles que entrega o efeito "continuity" pedido. Os valores abaixo são o contrato que a implementação (e o plano) devem seguir; não são exemplos ilustrativos.

### Abertura (clique na linha) — ~400ms do gesto completo

| Passo | O quê | Timing/curva | Framer Motion |
|---|---|---|---|
| 1 | Demais linhas da tabela + cabeçalho do card (`CardHeader`/`CardTitle` "Ranking de funcionários") | fade-out (`opacity: 1→0`) + scale-down (`scale: 1→0.98`) | `transition: { duration: 0.15, ease: "easeOut" }` |
| 2 | Avatar+nome (`layoutId="employee-anchor-{id}"`) voa da célula da tabela até o cabeçalho do painel | spring, não `ease` linear — é o que dá a sensação de peso físico do iOS | `transition: { type: "spring", stiffness: 300, damping: 30 }` (aplicado via `MotionConfig transition={{ layout: {...} }}` ou prop `layout` no próprio `motion.div` da âncora) |
| 3 | Conteúdo do painel (abas + `EmployeeDetail`) | fade-in (`opacity: 0→1`) + slide-up (`y: 10→0`), atrasado em relação à âncora — "conteúdo se constrói ao redor" | `transition: { duration: 0.25, delay: 0.08, ease: "easeOut" }` |

### Fechamento (seta de voltar / Esc) — sequência invertida

| Passo | O quê | Timing/curva |
|---|---|---|
| 1 | Conteúdo do painel sai primeiro | fade-out + `y: 0→10`, `duration: 0.2` |
| 2 | Âncora (avatar+nome) voa de volta para a posição da linha original | mesmo spring (`stiffness: 300, damping: 30`) |
| 3 | Linhas da tabela + cabeçalho do card reaparecem | fade-in + `scale: 0.98→1`, `duration: 0.15, delay: 0.05` (pequeno atraso para a âncora "pousar" antes do resto reaparecer) |

### `prefers-reduced-motion`

Quando `useReducedMotion()` (framer-motion) retorna `true`, **todas** as três etapas acima (abertura e fechamento) são substituídas por um único cross-fade de `duration: 0.1`, sem spring na âncora, sem scale das linhas, sem slide do conteúdo — a âncora simplesmente aparece/desaparece junto com o resto, sem animação de posição/tamanho.

### Por que estes valores especificamente

- `stiffness: 300, damping: 30` é uma configuração de spring "crítica-ish" (pouco ou nenhum overshoot/bounce) — adequada para um elemento de UI que muda de tamanho drasticamente (linha de tabela → cabeçalho de painel); mais rígido que isso (`stiffness` maior) fica abrupto, mais solto (`damping` menor) faria o avatar "balançar" ao chegar, o que não combina com um contexto administrativo/dados financeiros.
- O atraso de `80ms` no conteúdo do painel (abertura) e a ausência de atraso equivalente no fechamento do conteúdo (fecha imediatamente) é intencional: abrir deve parecer que o conteúdo "emerge depois" da âncora chegar; fechar deve parecer responsivo (não fazer o admin esperar o conteúdo sumir antes de começar a sair da tela).
- Duração total de ~400ms (abertura) é o intervalo comumente citado como "rápido o suficiente para não parecer lento, lento o suficiente para a relação espacial entre lista e detalhe ser perceptível" — abaixo de ~250ms o morph vira um "pulo" que não comunica continuidade; acima de ~600ms parece arrastado para uma ação repetida com frequência (o admin vai abrir/fechar relatórios várias vezes por sessão).

## Arquitetura

### Dependência

- Adicionar `framer-motion` a `package.json` (`npm install framer-motion`).

### `src/components/admin/employee-ranking-table.tsx`

- Envolver a tabela e o painel de relatório em um único `motion.div` com `LayoutGroup` (do framer-motion) para que o `layoutId` do avatar seja resolvido entre os dois — `LayoutGroup` isola esse `layoutId` de outras instâncias da tabela que possam existir na página (não há hoje, mas evita acoplamento futuro).
- Na célula "Funcionário" de cada `TableRow`, envolver `Avatar` + nome num `motion.div layoutId={`employee-anchor-${row.employeeId}`}`, presente **continuamente** em toda linha (não só na selecionada — ver correção na nota de performance abaixo).
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
- **`prefers-reduced-motion`:** ver seção "## Animação" acima para o comportamento exato (`useReducedMotion()` do framer-motion).
- **Performance (correção):** a versão original desta seção assumia que `layoutId` deveria ser atribuído só à linha selecionada. Isso quebra o fechamento: se a linha perde o `layoutId` no mesmo instante em que o painel desmonta, não sobra nenhum elemento com aquele id para a âncora "pousar" de volta — a animação de retorno não tem alvo. A implementação correta mantém `layoutId` em **todas** as linhas continuamente (quando `prefers-reduced-motion` não está ativo); o custo é aceitável para o número de funcionários exibido nesta tabela (dezenas, não milhares), e é o mesmo padrão usado nos exemplos oficiais do framer-motion para grades que expandem para tela cheia.

## Testes

- Sem lógica de negócio nova (é composição visual sobre dados já mapeados) — nenhum teste unitário novo necessário além dos já existentes para `admin-analytics` (não afetados).
- Verificação manual (via skill `verify`/`run` depois da implementação):
  1. Clicar num funcionário na tabela → relatório abre com a animação de morph (âncora + fade das linhas + slide do conteúdo).
  2. Clicar na seta de voltar → animação reversa, tabela volta ao estado normal, foco retorna à linha.
  3. Pressionar Esc com o painel aberto → mesmo comportamento do botão de voltar.
  4. Ativar "reduzir movimento" no SO (ou emular via DevTools `prefers-reduced-motion`) → transição vira cross-fade simples.
  5. Confirmar que a sidebar (`AppSidebar`) permanece visível e clicável com o painel de relatório aberto.
  6. Trocar de funcionário diretamente (clicar em outro, sem fechar antes) — via UI isso não é possível hoje (a tabela fica oculta atrás do painel), então não é um caso a tratar.
