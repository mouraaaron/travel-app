# Button loading shimmer — design

## Context

Design handoff (`Animação de loading para botões.zip`, extracted spec below) defines a
left-to-right shimmer sweep for buttons in a loading state: a blurred band of light
sweeps across the button on a 1.6s linear loop while an async action is in flight.

The app already has 13 buttons across the admin and employee flows that track a
pending boolean (`saving`, `approving`, `cancelling`, etc.) and currently signal
loading only by swapping the button's text (e.g. "Salvar" → "Salvando..."). This
spec replaces that text-swap pattern with the shimmer, applied through the shared
`Button` component.

## Handoff spec (source of truth for visual fidelity)

- Sweep: absolutely positioned child, `top:0; bottom:0; left:0`, width 45% of the
  button, `filter: blur(2px)`, `z-index: 1` (label sits above at `z-index: 2`).
- Gradient (light, for colored/dark button backgrounds):
  `linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)`
- Animation: `translateX(-60%)` → `translateX(160%)`, `1.6s linear infinite` — the
  range fully clears both edges before looping, so there's no visible pop/reset.
- Button needs `position: relative; overflow: hidden` while loading.
- Sweep unmounts (not just hides) when loading ends.

## Decisions made with the user

1. **Where it lives:** a `loading?: boolean` prop on the shared `Button` component
   (`src/components/ui/button.tsx`), not a separate `LoadingButton` component and not
   copy-pasted per call site.
2. **Click/text behavior while loading:** the button becomes non-interactive
   (`disabled` is forced true) and the label text stays as-is — no more text swap.
   The shimmer is the only loading signal.
3. **Scope:** only the 13 buttons that already track a pending boolean today (listed
   below). Buttons that only `router.push()` with no awaited call (e.g. "Buscar
   ofertas", the passengers-form submit) are out of scope for this pass — there's no
   pending boolean to wire up, and adding one (via `useTransition`) is a separate
   concern from "recreate this animation on existing loading buttons".
4. **Non-Button controls** (`Select`, `Switch` in `employee-actions.tsx`) and the
   generic `error-state.tsx` retry button (no loading state of its own today) are out
   of scope.

## Alignment with existing motion system

`src/styles/transitions.css` already establishes this project's animation
conventions (the `transitions-dev` token system): motion values as CSS custom
properties in `:root`, behavior implemented as `.t-*` classes, and every animated
block ships a `prefers-reduced-motion` guard directly in the CSS (see `.t-success-check`,
`.t-stagger-line`). The button sweep follows the same shape rather than introducing
ad hoc classes:

- New tokens added to the existing `:root` block in `transitions.css`:
  ```css
  /* Button loading sweep */
  --button-sweep-dur: 1600ms;
  --button-sweep-ease: linear;
  --button-sweep-width: 45%;
  --button-sweep-blur: 2px;
  --button-sweep-light: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%);
  --button-sweep-dark: linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.12) 50%, rgba(0,0,0,0) 100%);
  ```
- New behavior block (same file, following the `.t-success-check` banner-comment
  style):
  ```css
  /* ─────────────────────────────────────────────────────────────────────────
   * Button loading sweep. A blurred band of light sweeps left-to-right across
   * a button while `loading` is true. Rendered by <Button loading> (src/components/ui/button.tsx).
   * ───────────────────────────────────────────────────────────────────────── */
  .t-button-sweep {
    position: absolute;
    inset: 0 auto 0 0;
    width: var(--button-sweep-width);
    filter: blur(var(--button-sweep-blur));
    pointer-events: none;
    z-index: 1;
    animation: t-button-sweep-move var(--button-sweep-dur) var(--button-sweep-ease) infinite;
  }
  .t-button-sweep--light { background: var(--button-sweep-light); }
  .t-button-sweep--dark  { background: var(--button-sweep-dark); }

  @keyframes t-button-sweep-move {
    0%   { transform: translateX(-60%); }
    100% { transform: translateX(160%); }
  }

  @media (prefers-reduced-motion: reduce) {
    .t-button-sweep { display: none; }
  }
  ```
  Under reduced motion, the sweep simply doesn't render — the button still shows its
  normal disabled state while loading, just without the animated band.

## `Button` component changes

`src/components/ui/button.tsx`:

- New prop: `loading?: boolean` (default `false`).
- `disabled` passed to the underlying element becomes `disabled || loading`.
- Variant → sweep color mapping (colocated in the component, not a new token per
  variant):
  ```ts
  const sweepTone: Record<NonNullable<ButtonProps["variant"]>, "light" | "dark"> = {
    default: "light",
    destructive: "light",
    secondary: "light",
    success: "light",
    outline: "dark",
    ghost: "dark",
    link: "dark",
  };
  ```
  `bg-brand-gradient` is applied via an extra `className` on top of `variant="default"`,
  so it inherits "light" automatically — no special case needed.
- When `loading` is true: the root element gains `relative overflow-hidden` (via
  `cn()`, additive — doesn't change layout when `loading` is false), and a
  `<span aria-hidden className={cn("t-button-sweep", sweepTone[variant] === "light" ? "t-button-sweep--light" : "t-button-sweep--dark")} />`
  is rendered as the first child. The label content gets `relative z-[2]` so it stays
  above the sweep (`z-index: 1`).
- When `loading` is false, the sweep span is not rendered at all (conditional render,
  not CSS-hidden) — matches the handoff's "unmount, don't hide" requirement for free.

## Call site changes (13 buttons)

Mechanical change at each site: replace `disabled={x}` with `loading={x}` on the
`Button`, and remove the ternary text swap, leaving the static label. Where a site
combines the pending flag with another condition (e.g.
`disabled={submitting || !policyLoaded}`), the non-pending part of the condition
stays on `disabled` and only the pending flag moves to `loading`.

| # | File | Button | Pending var | Today's text swap → new (static) label |
|---|---|---|---|---|
| 1 | `src/app/login/page.tsx` | Entrar | `submitting` | "Entrando..." → "Entrar" |
| 2 | `src/app/(app)/request/review/page.tsx` | Enviar solicitação | `submitting` (plus `disabled` stays gated on `!policyLoaded`) | "Enviando..." / "Carregando política..." → "Enviar solicitação" |
| 3 | `src/components/admin/request-detail-view.tsx` | Aprovar | `approving` | "Aprovando..." → "Aprovar" |
| 4 | `src/components/admin/request-detail-view.tsx` | Confirmar rejeição | `rejecting` (plus `disabled` stays gated on empty reason) | "Rejeitando..." → "Confirmar rejeição" |
| 5 | `src/components/trip/request-detail-view.tsx` | Cancelar solicitação | `cancelling` | "Cancelando..." → "Cancelar solicitação" |
| 6 | `src/components/admin/onsite-week-detail.tsx` | Tentar novamente (n) | `retrying` | "Tentando novamente..." → "Tentar novamente (n)" |
| 7 | `src/components/admin/onsite-week-detail.tsx` | Cancelar semana presencial | `cancelling` | "Cancelando..." → "Cancelar semana presencial" |
| 8 | `src/components/admin/policy-rules-form.tsx` | Salvar | `saving` | "Salvando..." → "Salvar" |
| 9 | `src/components/admin/employee-travel-profile-form.tsx` | Salvar perfil de viagem | `saving` | "Salvando..." → "Salvar perfil de viagem" |
| 10 | `src/components/admin/organize-onsite-week-flow.tsx` | Avançar | `loadingPreview` | "Carregando..." → "Avançar" |
| 11 | `src/components/admin/organize-onsite-week-flow.tsx` | Confirmar e buscar voos | `confirming` | "Buscando voos e criando solicitações..." → "Confirmar e buscar voos" |
| 12 | `src/components/admin/requests-queue.tsx` | Aprovar (fila, por linha) | `approvingId === request.id` | "Aprovando..." → "Aprovar" |
| 13 | `src/components/trip/requests-list.tsx` | Cancelar (por linha) | `cancellingId === request.id` | "Cancelando..." → "Cancelar" |

## Testing

- Unit test for `Button`: renders the sweep span with the right tone class per
  variant when `loading`; omits it when not loading; forces `disabled` when
  `loading` is true even if `disabled` prop is unset.
- No changes needed to existing call-site tests beyond removing assertions on the
  old loading text, if any exist.
- Manual verification: run `npm run dev`, exercise at least one button per distinct
  variant/tone (e.g. login submit for the brand-gradient/light case, "Cancelar" for
  the outline/dark case) and visually confirm the sweep matches the handoff timing
  and disappears cleanly when the request resolves.
