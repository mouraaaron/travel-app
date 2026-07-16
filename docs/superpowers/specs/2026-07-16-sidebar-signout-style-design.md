# Design: Estilo do botão "Sair" na sidebar

## Contexto

O botão "Sair" (`SignOutButton`, usado dentro de `AppSidebar`) hoje é renderizado
com o componente `Button` do shadcn (`variant="outline"`), o que o faz aparecer
como um botão "cheio" (fundo branco, borda, sombra sutil de foco), destoando
visualmente dos demais itens de navegação da sidebar, que são links simples
(ícone + texto, sem fundo, cor cinza suave, hover discreto).

A referência visual (screenshot fornecido pelo usuário) mostra um item "Voltar"
no rodapé de uma sidebar de outra aplicação, estilizado exatamente como os
demais itens do menu (mesma tipografia, cor, espaçamento), separado apenas por
uma linha divisória. O usuário quer que o "Sair" da aplicação `travel-app`
tenha esse mesmo tratamento visual.

## Decisões (confirmadas com o usuário)

- **Bloco de avatar + nome**: permanece exatamente como está hoje, acima do
  botão Sair, dentro do mesmo container com `border-t border-sidebar-border`.
- **Ícone**: mantém `LogOut` (lucide-react) — não troca para um ícone de seta
  de retorno como na imagem de referência.
- **Divisor**: mantém como está hoje — uma única linha acima de todo o bloco
  (avatar+nome e botão Sair juntos). Não adiciona um segundo divisor entre o
  avatar e o botão.
- **Escopo mobile**: fora de escopo. O header mobile não tem botão de sair hoje
  e isso não muda.

## Abordagem escolhida

Substituir o `<Button variant="outline" size="sm">` por um `<button>` nativo,
estilizado com as mesmas classes Tailwind usadas nos itens de navegação da
sidebar (função `renderDesktopLink` em `app-sidebar.tsx`). Essa abordagem foi
escolhida (entre 3 propostas) porque:

- `SignOutButton` não usa nenhuma prop de `Button` além de `className`, então
  não há motivo para manter a dependência do componente.
- Evita conflito de especificidade CSS entre as classes-base do `Button` e as
  classes que queremos aplicar (problema da abordagem alternativa de usar
  `variant="ghost"` + overrides).
- Não introduz abstração nova compartilhada (`SidebarNavItem`) — isso seria
  além do escopo pedido, já que o estilo só é reutilizado neste único lugar
  hoje (YAGNI).

## Mudanças

### `src/components/layout/sign-out-button.tsx`

- Remove o import de `Button` (`@/components/ui/button`).
- Troca o elemento raiz para `<button type="button">`.
- Aplica as classes:
  ```
  flex h-8 w-full items-center gap-3 rounded-none px-3 py-1.5 text-[13px]
  font-normal leading-[18px] text-sidebar-foreground/70 transition-colors
  hover:bg-sidebar-accent hover:text-sidebar-accent-foreground
  ```
  compostas via `cn()` com a prop `className` recebida (mantém a mesma
  assinatura pública do componente).
- Ícone `LogOut` com `h-4 w-4` (remove o `mr-1.5` — o espaçamento passa a vir
  do `gap-3` do flex, igual aos demais itens do menu).
- `onClick` (`handleSignOut`) e toda a lógica de logout (Supabase `signOut` +
  `router.push("/login")` + `router.refresh()`) permanecem inalterados.

### `src/components/layout/app-sidebar.tsx`

- Nenhuma mudança. O container do rodapé (avatar + `SignOutButton`) continua
  como está.

## Fora de escopo

- Bloco de avatar/nome.
- Ícone do botão.
- Posição/quantidade de divisores.
- Criação de componente compartilhado entre nav links e o botão Sair.
- Header mobile.

## Teste

- Verificação visual manual: abrir a sidebar no navegador (`npm run dev`) e
  comparar "Sair" com os demais itens do menu — mesma altura (`h-8`), mesma
  tipografia, mesma cor de texto e mesmo comportamento de hover.
- Confirmar que o clique em "Sair" ainda desloga corretamente e redireciona
  para `/login` (fluxo funcional inalterado, não há teste automatizado
  dedicado a este componente hoje).
