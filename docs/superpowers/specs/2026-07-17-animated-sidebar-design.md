# Design: Sidebar animada (hover-to-expand, estilo 21st.dev/Aceternity)

## Contexto

O usuário quer trazer a animação da sidebar de
[21st.dev/@manuarora700/components/sidebar](https://21st.dev/@manuarora700/components/sidebar)
(colapsa para uma trilha só de ícones e expande suavemente ao passar o mouse)
para melhorar a UI do `travel-app`, preocupado que isso possa distorcer
proporções em outras partes do projeto — em especial os gráficos do painel
admin.

Hoje a sidebar (`src/components/layout/app-sidebar.tsx`) é um `<aside>` fixo
(`position: fixed`, `w-[248px]`) sempre expandido, com labels sempre visíveis.
O `main` de cada layout compensa isso com `lg:pl-[248px]` fixo. Essa mesma
estrutura se repete, quase idêntica, em `src/app/(app)/layout.tsx` e
`src/app/admin/layout.tsx`.

Os gráficos do admin (`src/components/admin/spend-chart.tsx` e
`spend-breakdown-charts.tsx`) já usam `ChartContainer` (shadcn) com altura fixa
(`h-64`/`h-72`/`aspect-square`) e largura `w-full`, que por baixo é o
`ResponsiveContainer` do recharts — ou seja, já são responsivos à largura do
container pai. Isso significa que a "distorção" que o usuário temia não é um
risco real de proporção quebrada; o único efeito colateral é um redesenho
(reflow) do gráfico durante a transição de largura da sidebar, discutido e
aceito abaixo.

## Decisões (confirmadas com o usuário)

- **Comportamento**: hover-to-expand puro (sem toggle fixo/clique para
  travar). Colapsada por padrão; expande no `mouseEnter`, recolhe no
  `mouseLeave`.
- **Integração com o layout**: **push real via flexbox** — o `main` encolhe
  de verdade conforme a sidebar anima, em vez de a sidebar sobrepor o
  conteúdo (overlay). Isso implica remover o `position: fixed` da sidebar e
  o `lg:pl-[248px]` fixo do `main`, substituindo por um contêiner flex real
  onde a sidebar é um item flex e o `main` é `flex-1`.
- **Redesenho dos gráficos durante a animação**: aceitar o leve jitter do
  `ResponsiveContainer` do recharts recalculando a cada frame (~200ms de
  transição). Sem debounce, sem "congelar" a área do gráfico — mitigação
  desnecessária para uma transição tão curta.
- **Mobile**: sem alterações. A barra horizontal fixa no topo (visível abaixo
  do breakpoint `lg`) continua exatamente como está — a animação só faz
  sentido com hover de mouse, então fica restrita ao desktop.
- **Logo no estado colapsado**: usa `paggo-icon.svg` (já existe, usado hoje no
  header mobile). Ao expandir, troca suavemente (crossfade) para a logo por
  extenso `paggo-logo-light.svg`.
- **Rodapé (avatar + nome + "Sair") no estado colapsado**: mostra **só o
  avatar** (círculo com iniciais). Nome do usuário e botão "Sair" ficam
  ocultos (opacity 0, sem interação) e reaparecem juntos ao expandir.
- **Larguras**: `64px` colapsada, `248px` expandida (mantém o valor atual —
  minimiza qualquer reajuste de outras partes do projeto que já foram
  calibradas para esse valor).

## Arquitetura

### Divisão de componentes

O `app-sidebar.tsx` atual retorna um Fragment com dois blocos que hoje vivem
lado a lado só porque compartilham o mesmo componente — mas ocupam posições
completamente diferentes no layout (trilha lateral vs. barra de topo). Com o
push via flexbox, isso precisa ser explícito: o wrapper flex deve conter
*apenas* a sidebar desktop + o `main`, com o header mobile *fora* dessa row
(senão o header mobile viraria um item flex ao lado do `main`, ficando
espremido). Por isso, o componente é dividido em três:

1. **`src/components/layout/desktop-sidebar.tsx`** (novo) — a sidebar animada.
   Substitui o `<aside>` de `app-sidebar.tsx`. Recebe `fullName`/`role` como
   hoje. Usa `framer-motion` (já é dependência do projeto) para animar a
   largura e o fade dos labels/logo/rodapé.
2. **`src/components/layout/mobile-header.tsx`** (novo) — a barra `<header
   lg:hidden>` extraída verbatim do `app-sidebar.tsx` atual. Nenhuma mudança
   de comportamento ou estilo.
3. **`src/components/layout/app-sidebar.tsx`** — removido. Os dois layouts
   passam a consumir `AuthenticatedShell` (abaixo), que por sua vez usa
   `DesktopSidebar` e `MobileHeader`.

### `AuthenticatedShell` (novo, resolve a duplicação existente)

`src/components/layout/authenticated-shell.tsx`, usado por
`(app)/layout.tsx` e `admin/layout.tsx` (que hoje têm markup quase idêntico):

```
<>
  <MobileHeader fullName={fullName} role={role} />
  <div className="flex">
    <DesktopSidebar fullName={fullName} role={role} />
    <main className="min-h-screen flex-1 min-w-0">
      <div className="px-6 pb-16 pt-8">{children}</div>
    </main>
  </div>
</>
```

Como o `main` agora é `flex-1` dentro de um flex real, sua largura é
consequência natural do reflow do navegador quando a sidebar anima — não
precisa de nenhuma sincronização manual entre duas animações separadas (uma
na sidebar, outra numa margin do main). Isso é mais robusto do que animar as
duas larguras via `framer-motion` de forma coordenada.

`(app)/layout.tsx` e `admin/layout.tsx` passam a só chamar:
```
<AuthenticatedShell fullName={profile.fullName} role={profile.role}>
  {children}
</AuthenticatedShell>
```
eliminando a duplicação de markup entre os dois.

### `DesktopSidebar` — comportamento animado

- `const [open, setOpen] = useState(false)` local (sem Context — só este
  componente consome o estado, então um Context seria abstração
  desnecessária pra um único consumidor).
- Elemento raiz vira `motion.aside` com:
  - `className="sticky top-0 h-screen shrink-0 overflow-hidden ..."` (troca
    `fixed inset-y-0 left-0` por `sticky top-0 h-screen`, necessário pra
    sidebar ficar fixa na tela durante o scroll da página mesmo sendo um
    item flex normal, não mais fora do fluxo do documento).
  - `animate={{ width: open ? 248 : 64 }}`, `transition={{ duration: 0.2,
    ease: "easeInOut" }}`.
  - `onMouseEnter={() => setOpen(true)}`, `onMouseLeave={() => setOpen(false)}`.
  - `overflow-hidden` no container é o que permite que o texto dos labels
    (que não encolhe, só perde opacidade) não vaze visualmente nem cause
    reflow enquanto a largura ainda está em transição — mesma técnica do
    componente original do 21st.dev.
- **Logo**: ícone (`paggo-icon.svg`) posicionado de forma fixa à esquerda;
  logo completa (`paggo-logo-light.svg`) sobreposta via `AnimatePresence` +
  `opacity` crossfade, visível só quando `open`.
- **Links de navegação e label "Pessoal"**: mesma estrutura de hoje
  (`renderDesktopLink`, `ADMIN_NAV_ITEMS`, `PERSONAL_NAV_ITEMS`), só que o
  texto do label passa a ficar num `motion.span` com `animate={{ opacity:
  open ? 1 : 0 }}` em vez de sempre visível — o ícone continua sempre
  visível na mesma posição.
- **Rodapé**: avatar (círculo com iniciais) sempre visível. Nome do usuário e
  `<SignOutButton />` ficam dentro de um único wrapper com `animate={{
  opacity: open ? 1 : 0 }}` e `style={{ pointerEvents: open ? "auto" :
  "none" }}` (evita clique fantasma no botão "Sair" enquanto está invisível).
  Nenhuma mudança dentro de `sign-out-button.tsx` — ele continua do jeito que
  ficou definido na spec anterior (`2026-07-16-sidebar-signout-style-design.md`).

### Impacto nos gráficos do admin

Nenhuma mudança de código nos componentes de gráfico. Como todos já usam
`ChartContainer`/`ResponsiveContainer` com altura fixa e `w-full`, eles vão
naturalmente se redesenhar para a nova largura do `main` conforme a sidebar
anima — sem esticar/comprimir de forma desproporcional, só recalculando
espaçamento de eixos, igual a redimensionar a janela do navegador.

## Fora de escopo

- Repensar o header mobile.
- Toggle fixo/clique para travar a sidebar aberta (rejeitado — só
  hover-to-expand).
- Debounce/throttle ou "congelamento" visual dos gráficos durante a
  transição.
- Qualquer alteração em `sign-out-button.tsx`.
- Novas dependências — `framer-motion` já está instalado.

## Teste

Sem testes automatizados dedicados a este componente hoje (mesmo padrão da
spec anterior de sign-out). Verificação manual via `npm run dev`:

- Desktop, rota `/` (employee) e `/admin`: hover na sidebar expande
  suavemente (64px → 248px), labels e "Pessoal" aparecem com fade, logo troca
  de ícone pra wordmark, nome+"Sair" aparecem no rodapé. Tirar o mouse
  recolhe de volta.
- Confirmar que os gráficos do `/admin` (spend chart, breakdown charts) se
  redesenham corretamente durante o hover, sem erro no console e sem
  distorcer proporções (altura constante, largura ajustando).
- Confirmar que o clique em "Sair" com a sidebar expandida ainda desloga e
  redireciona para `/login` normalmente.
- Mobile (viewport < `lg`): confirmar que o header horizontal continua
  idêntico ao atual, sem nenhuma sidebar lateral ou animação.
- Verificar que não sobrou nenhuma referência a `app-sidebar.tsx` no projeto
  (arquivo removido) fora dos worktrees antigos (`.claude/worktrees/`,
  `.worktrees/`), que são cópias isoladas e não fazem parte do escopo desta
  mudança.
