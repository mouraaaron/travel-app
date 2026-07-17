# Design: Sidebar overlay + pin, alinhada ao SideMenu real da Paggo

## Contexto

O usuário compartilhou a especificação completa do `SideMenu` real da Paggo
(componente compartilhado `paggo-fend`, consumido via
`apps/blue/_app.tsx → withPaggoProviders → DashboardLayout → SideMenu`) e pediu
para comparar com o que existe hoje no `travel-app`, implementado a partir de
`docs/superpowers/specs/2026-07-17-animated-sidebar-design.md`.

A comparação encontrou divergências reais de comportamento, não só de estilo:

| Aspecto | Implementado (spec anterior) | Spec real da Paggo |
|---|---|---|
| Modelo de layout | Push via flexbox (`main` encolhe) | Overlay absoluto sobre um slot in-flow |
| Travar expandido | Só hover, sem toggle (rejeitado) | Botão de pin, persistido em `localStorage` |
| Breakpoints | Um só (`lg` = 1024px, mobile vs. desktop) | Faixa 768–1367px força colapsado; pin só acima de 1367px |
| Logo | Ícone + logo completa (asset separado) como crossfade | Um glifo único, nunca trocado, com lettering cropado ao lado |
| Mobile | Header horizontal estático | Drawer deslizante com backdrop |

Este documento registra as decisões tomadas com o usuário sobre até onde
adotar a spec real, e a arquitetura resultante para o `travel-app`. Ele
**substitui as decisões de layout, pin e breakpoints** do documento anterior;
os pontos não revisitados (larguras, `reduced-motion`, divisão
`DesktopSidebar`/`MobileHeader`/`AuthenticatedShell`) permanecem válidos.

Dois itens já foram corrigidos diretamente no código durante a sessão de
brainstorming, antes deste documento, e estão registrados aqui por
completude:

1. **Logo duplicada quando expandida** — `desktop-sidebar.tsx` renderizava o
   glifo (24×24) **e** o arquivo `paggo-logo-light.svg` inteiro (que já
   contém seu próprio glifo embutido, além do wordmark), mostrando duas
   marcas lado a lado. Substituído por um SVG inline recortado
   (`viewBox="77 0 189 32"`, o mesmo `path` do wordmark, só a região do
   lettering) que aparece ao lado do glifo único.
2. **Glifo desalinhado da coluna de ícones quando colapsada** — o header da
   sidebar usava `px-4` (16px) enquanto os itens de navegação usam `px-3`
   (12px), deslocando o glifo 4px à direita da coluna de ícones. Corrigido
   igualando o padding horizontal do header ao dos itens (`px-3`).

## Decisões (confirmadas com o usuário)

- **Modelo de layout**: overlay, como a Paggo real. A sidebar expandida
  flutua por cima do conteúdo (com sombra); `main` nunca muda de largura.
  Elimina o jitter dos gráficos do admin recalculando a cada hover — motivo
  principal da escolha.
- **Pin**: adicionar botão de fixar aberto, com estado persistido em
  `localStorage`. Reverte a decisão anterior de "só hover, sem travar".
- **Breakpoints**: replicar a faixa intermediária que força colapsado,
  adaptada aos breakpoints já existentes no projeto (ver seção
  "Breakpoints" abaixo — a spec real usa 768px como limite inferior, mas o
  `travel-app` já usa `lg` = 1024px como corte mobile/desktop, então a faixa
  de "força rail" começa em 1024, não 768).
- **Morph do glifo**: **não** implementar o `translate`/`scale` absoluto da
  spec real. Mantido o crossfade simples (glifo fixo + lettering
  aparece/some) já corrigido no código — mais simples, e o bug de
  alinhamento que motivou a pergunta já foi resolvido por outra via (padding
  consistente, sem necessidade de reposicionamento por estado).
- **Estilo dos itens de navegação**: adotar os valores exatos da spec real
  (`px-6 py-1.5 text-sm`, opacidades, cores de hover/ativo/disabled, barra
  indicadora), em vez de manter os tokens atuais do design system.
- **Mobile**: sem alteração. Sem drawer deslizante — decisão da spec
  anterior reafirmada.
- **Visual validado**: protótipo interativo (HTML/CSS/JS standalone,
  reproduzindo hover, pin e troca manual de tier de viewport) revisado e
  aprovado pelo usuário antes deste documento.

## Arquitetura

### Arquivos

- **`src/components/layout/sidebar-constants.ts`** (novo) — larguras,
  breakpoints, chave de `localStorage`, timing de transição. Única fonte de
  verdade para esses números (hoje espalhados como literais no JSX).
- **`src/components/layout/use-side-menu.ts`** (novo) — hook que encapsula
  pin persistido, hover transiente, tier de viewport e os valores derivados.
  Isolado do JSX, testável sem montar o componente visual.
- **`src/components/layout/desktop-sidebar.tsx`** (editado) — consome o
  hook; troca a animação de largura do próprio `<aside>` pelo modelo
  slot-fixo + painel absoluto.
- **`src/components/layout/authenticated-shell.tsx`** (editado) — a `div`
  flex que hoje contém `DesktopSidebar` como item que anima de largura passa
  a conter um slot de largura **constante** (`SIDEBAR_COLLAPSED_WIDTH`); o
  `main` deixa de precisar reagir à sidebar (já era `flex-1`, mas antes essa
  largura mudava porque o irmão flex mudava — agora o irmão flex não muda
  mais).
- `nav-items.ts`, `sign-out-button.tsx`, `mobile-header.tsx` — sem mudanças.

### `sidebar-constants.ts`

```ts
export const SIDEBAR_COLLAPSED_WIDTH = 64;
export const SIDEBAR_EXPANDED_WIDTH = 248;

// Abaixo de TABLET_BREAKPOINT, o <DesktopSidebar> nem monta (hidden lg:flex
// já cobre isso). Entre TABLET_BREAKPOINT e PIN_BREAKPOINT, o pin é
// ignorado mesmo se true no storage. Acima de PIN_BREAKPOINT, o pin vale.
export const SIDEBAR_TABLET_BREAKPOINT = 1024; // = Tailwind `lg`, sem override no projeto
export const SIDEBAR_PIN_BREAKPOINT = 1367;

export const SIDEBAR_PIN_STORAGE_KEY = "sidebar-pinned-expanded";

export const SIDEBAR_TRANSITION = { duration: 0.2, ease: "easeInOut" as const };
```

`SIDEBAR_EXPANDED_WIDTH` fica em `248` (valor já calibrado no projeto), não
`249` como a spec real usa — diferença de 1px, sem efeito prático, não vale
tocar em paddings/margens já ajustados em outros componentes por causa
disso.

### `use-side-menu.ts` — contrato

```ts
function useSideMenu(): {
  isOpen: boolean;        // painel deve estar em 248px (hover OU pin ativo)
  pinned: boolean;        // preferência do usuário, persistida
  isPinnable: boolean;    // true só quando viewport > SIDEBAR_PIN_BREAKPOINT
  showPinButton: boolean; // === isPinnable
  setHovering: (v: boolean) => void;
  togglePinned: () => void;
};
```

Comportamento interno:

- `pinned` é lido de `localStorage[SIDEBAR_PIN_STORAGE_KEY]` dentro de um
  `useEffect` (não no render inicial) para evitar mismatch de hidratação —
  o server sempre renderiza como se `pinned = false`, e sincroniza no
  client após montar.
- Tier de viewport via `matchMedia`, dois listeners:
  `(min-width: ${SIDEBAR_TABLET_BREAKPOINT}px)` e
  `(min-width: ${SIDEBAR_PIN_BREAKPOINT}px)`. Não precisa de um terceiro
  listener para "mobile" — abaixo de `TABLET_BREAKPOINT` o componente nem
  está montado no DOM (`hidden lg:flex` no wrapper), então o hook nunca
  precisa saber sobre esse caso.
- `isPinnable = viewportWidth > SIDEBAR_PIN_BREAKPOINT`.
- `isOpen = (isPinnable && pinned) || hovering`. O hover sempre funciona
  como expansão temporária — inclusive na faixa 1024–1367px. Só o **pin
  permanente** é ignorado nessa faixa.
- `togglePinned` grava em `localStorage` mesmo quando `!isPinnable` (ex.:
  usuário pina em uma janela de 1200px de largura, o valor fica salvo, e
  passa a valer se ele redimensionar a janela para além de 1367px depois).
- Se `localStorage` não estiver disponível (SSR, modo privado com
  bloqueio): `try/catch` silencioso, cai para `pinned = false`, sem lançar
  erro nem quebrar o hover.

### Layout: slot in-flow + painel absoluto

```tsx
<div className="flex">
  <div className="relative h-screen w-16 shrink-0"> {/* slot fixo, sempre 64px */}
    <motion.aside
      className="absolute inset-y-0 left-0 overflow-hidden bg-sidebar text-sidebar-foreground"
      animate={{
        width: isOpen ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH,
        boxShadow: isOpen ? "16px 0 40px rgba(0,0,0,0.35)" : "none",
      }}
      transition={transition}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* conteúdo interno sempre renderizado a 248px, recortado pelo overflow-hidden acima */}
      <div className="w-[248px]">...</div>
    </motion.aside>
  </div>
  <main className="min-h-screen min-w-0 flex-1">...</main>
</div>
```

O slot externo (`w-16`, sempre 64px, `position: relative`) é o que o
`AuthenticatedShell` usa para reservar espaço no fluxo — nunca muda de
tamanho, então `main` nunca reflow. O `motion.aside` é posicionado
`absolute` dentro dele e é só ele que anima de largura, se sobrepondo ao
`main` quando expandido.

### Logo, itens de nav, botão de pin

- **Logo**: sem mudança em relação ao que já está no código — glifo inline
  (24×24, `fill="currentColor"`) sempre visível, lettering inline
  (`viewBox="77 0 189 32"`, mesmo `path` do `paggo-logo-light.svg`) com
  crossfade de opacidade só quando `isOpen`. Ambos com o mesmo padding
  horizontal dos itens de nav (`px-3`), garantindo alinhamento em coluna
  tanto colapsado quanto expandido — sem necessidade de reposicionar nada
  por estado, porque o conteúdo interno nunca muda de largura (sempre
  248px, só o painel externo recorta). A altura do container do header
  (`h-14`, fixa) não muda para o `pb-2 pt-4` da spec real — essa alteração
  foi escopada só para "itens de nav" na decisão do usuário, e trocar a
  altura do header teria efeito em cascata sobre o alinhamento vertical do
  botão de pin e não foi pedida.
- **Itens de nav**: migrar de `px-3 py-1.5 text-[13px]` +
  `bg-sidebar-accent`/`text-sidebar-accent-foreground` para os valores
  exatos da spec real:
  - `px-6 py-1.5 text-sm`
  - opacidade base `70%`; hover `bg-[#13131680]` + opacidade `100%`
  - ativo: `bg-[#131316]` + opacidade `100%` + `font-medium` (a spec real
    referencia `bg-background-inverse text-content-on-color`, mas esses
    tokens não existem no design system do `travel-app`; o screenshot do
    estado ativo mostra claramente um fundo escuro — não invertido para
    claro —, então a tradução direta é o hex literal `#131316`, o mesmo
    valor que `--sidebar-accent` já aproxima)
  - disabled: opacidade `20%` — sem nenhum item usando esse estado hoje;
    fica disponível como classe condicional para uso futuro, não é um
    requisito funcional deste documento
  - barra indicadora `w-[2px]`, altura do item menos margem vertical,
    renderizada só quando `active && !isOpen` (mostra o "onde eu tô" mesmo
    colapsado, sem precisar do texto do label)
- **Botão de pin**: ícones `PanelLeftClose`/`PanelLeftOpen` (lucide-react,
  já é dependência do projeto). `aria-label` dinâmico ("Recolher
  menu"/"Expandir menu"). Só renderiza quando `showPinButton` (viewport
  > 1367px). `opacity-0` por padrão, `group-hover:opacity-70` no hover do
  painel, `hover:opacity-100` no próprio botão. Clique chama
  `togglePinned()`; **não** deve alternar `isOpen` diretamente — `isOpen`
  já deriva de `pinned` dentro do hook.

## Breakpoints

| Viewport | Pin honrado? | Estado de repouso |
|---|---|---|
| `< 1024px` | — | `DesktopSidebar` nem monta; `MobileHeader` horizontal (sem mudança) |
| `1024–1367px` | Não — ignorado mesmo se `true` no storage | Rail (64px); hover ainda expande como overlay temporário |
| `> 1367px` | Sim | Rail (64px) se não pinado; 248px fixo se pinado |

A spec real usa `768px` como limite inferior da faixa de colapso forçado;
adaptado para `1024px` porque é onde o `travel-app` já corta
mobile/desktop (`hidden lg:flex` / `lg:hidden`, `lg` = 1024px, sem override
em `tailwind.config.ts`) — replicar `768px` literalmente não faria sentido,
porque abaixo de `1024px` a sidebar desktop já nem existe nesse projeto.

## Animação e erros

- Reaproveita `{ duration: shouldReduceMotion ? 0 : 0.2, ease: "easeInOut" }`,
  mesma convenção já usada em `onsite-week-detail.tsx` e no
  `DesktopSidebar` atual.
- `localStorage` indisponível: hook cai para `pinned = false` sem lançar
  erro (ver seção do hook acima).
- Redimensionar a janela através de um breakpoint enquanto a sidebar está
  com hover ativo: `isOpen` recalcula no próximo render pelo listener de
  `matchMedia`; não há estado inconsistente possível porque `isOpen` é
  sempre derivado, nunca guardado diretamente.

## Fora de escopo

- Drawer mobile deslizante (reafirmado fora de escopo da spec anterior).
- Morph do glifo com `translate`/`scale` e fórmula dependente de
  `--side-menu-rail` — resolvido de forma mais simples (padding
  consistente), sem necessidade de reposicionamento por estado.
- Badge "Novo" (`bg-[#0bb1fe3d] text-[#B7E8FF]`) — nenhum item de nav do
  `travel-app` usa esse estado hoje.
- Replicar a inconsistência conhecida de `88px` vs `64px` do componente
  real (mencionada pelo usuário) — não existe no `travel-app` porque não
  implementamos o morph que a contém.
- Novas dependências — `framer-motion` e `lucide-react` já estão
  instalados.

## Teste

Sem suíte automatizada para este componente (mesmo padrão do resto do
projeto — `vitest.config.ts` roda em `environment: "node"`, sem
`@testing-library/react`). Verificação via `npx tsc --noEmit`,
`npm run lint`, e manual com `npm run dev`:

- Hover expande em overlay sem alterar a largura do `main` (sem jitter nos
  gráficos do `/admin`).
- Acima de 1367px: pin mantém a sidebar aberta ao tirar o mouse; recarregar
  a página mantém o pin (persistência).
- Entre 1024–1367px: pin não segura aberto (mesmo se `true` no storage);
  hover ainda expande temporariamente; botão de pin não aparece.
- Abaixo de 1024px: nenhuma mudança visível — `MobileHeader` continua
  idêntico.
- Redimensionar a janela cruzando os breakpoints não deixa a sidebar em
  estado visualmente inconsistente (ex. pinada "presa" aberta abaixo de
  1367px).
- Logo alinhada com os ícones de nav em coluna, tanto colapsada quanto
  expandida.
- Itens de nav: hover, ativo e a barra indicadora (`w-[2px]`, só quando
  colapsado) renderizam com os valores exatos da spec.
