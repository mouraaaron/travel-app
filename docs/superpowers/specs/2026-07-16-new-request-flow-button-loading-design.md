# New-request flow button loading — design

## Context

The `Button` component (`src/components/ui/button.tsx`) already exposes a `loading?: boolean`
prop that renders a CSS shimmer sweep and forces `disabled` while active (built in
`docs/superpowers/plans/2026-07-15-button-loading-shimmer.md`). Thirteen buttons across the app
already use it, wired to a real pending state (a `useState` flag or a mutation's pending flag
set around an `await fetch(...)`).

A sweep of the "issue a new travel request" wizard (Critérios → Resultados → Detalhe da oferta →
Passageiros → Revisão) found only one button in the whole flow wired to `loading`: the final
"Enviar solicitação" submit on the review step, which already sets `loading={submitting}` around
its `POST /api/requests` call. Every other button in the flow is a plain
`onClick={() => router.push(...)}` (or a `react-hook-form` submit that only writes to the
in-memory `useTripFlow()` context store) with no `await` and nothing asynchronous happening in
the handler itself — there's no existing pending-state variable to bind `loading` to.

## Decisions made with the user

1. **Scope — 8 buttons** get `loading` wiring (table below, rows 1-8). `Enviar solicitação` (row
   9) is unchanged (already correct) — listed only for completeness. Two candidates are
   explicitly excluded:
   - The mobile **"Filtros"** `SheetTrigger` button (`results/page.tsx`) — it only opens a side
     panel, no navigation and no async work ever occurs, so there is no pending state a shimmer
     could ever reflect.
   - The generic **"Tentar novamente"** retry button in `error-state.tsx` — shared across the
     app beyond this flow; the prior shimmer plan deliberately left it out of scope and this plan
     does not revisit that call.
2. **Mechanism — `React.useTransition()`, not a new component.** None of the 9 buttons have real
   async work to gate on; they synchronously write to context/local state and call
   `router.push(...)`. Wrapping that call in `startTransition(() => { ...; router.push(...) })`
   gives an idiomatic React/Next.js `isPending` flag that stays `true` until the destination route
   has actually mounted — a truer signal than a manually-toggled `useState` that's never reset
   (rejected as approach C: same visual result, but non-idiomatic and requires remembering *why*
   no reset is needed). A global top-of-page progress bar was also considered and rejected
   (approach B) — it wouldn't reuse the existing per-button shimmer component, which is the
   explicit ask.
3. **List items need per-row identity.** The two offer-card buttons ("Ver detalhes", "Selecionar")
   render once per offer in a list — a single `isPending` boolean isn't enough to know *which*
   card's button should shimmer. `ResultsPage` lifts `pendingOfferId`/`pendingAction` state (set
   at click time, alongside the `useTransition` call) and passes two new boolean props down to
   the specific `OfferCard` instance instead.
4. **No new tests.** This is a UI/interaction change with no new business logic or branching to
   unit test — verification is the existing suite (regression) plus a manual click-through of
   all 9 buttons.

## Call site changes

| # | File | Button | Current handler | Change |
|---|---|---|---|---|
| 1 | `src/components/trip/search-criteria-form.tsx` | "Buscar ofertas" (submit) | `onSubmit` writes `criteria` to context, then `router.push("/results")` | Wrap body in `startTransition`; add `loading={isPending}` |
| 2 | `src/app/(app)/results/page.tsx` | "Editar busca" | `onClick={() => router.push("/")}` | Own `useTransition`; `loading={isPending}` |
| 3 | `src/app/(app)/results/page.tsx` + `src/components/trip/offer-card.tsx` | "Ver detalhes" (per card) | `handleViewDetails(offer)` → `selectOffer(offer.id)` + `router.push(...)` | `ResultsPage` adds `pendingOfferId`/`pendingAction` state set at click time inside `startTransition`; passes new `loadingView` prop to `OfferCard`, bound to its own button |
| 4 | same as #3 | "Selecionar" (per card) | `handleSelect(offer)` → `selectOffer(offer.id)` + `router.push(...)` | Same state, `pendingAction: "select"`; new `loadingSelect` prop on `OfferCard` |
| 5 | `src/app/(app)/offer/[id]/page.tsx` | "Selecionar oferta" | `onClick={handleSelectOffer}` | Own `useTransition`; `loading={isPending}` (keeps existing `disabled={isExpired}`) |
| 6 | `src/app/(app)/request/passengers/[offerId]/page.tsx` | "Voltar" | `onClick={() => router.push(...)}` | Own `useTransition`; `loading={isPending}` |
| 7 | same file | "Continuar para revisão" (submit) | `onSubmit` writes `passengers` to context, then `router.push(...)` | Own `useTransition` wrapping the submit body; `loading={isPending}` |
| 8 | `src/app/(app)/request/review/page.tsx` | "Voltar" | `onClick={() => router.push(...)}` | Own `useTransition`; `loading={isPending}` |
| 9 | same file | "Enviar solicitação" | already `loading={submitting}` around `await fetch(...)` | No change |

Each single-button-pair page (#1, #2, #5, #6+#7, #8) gets its own independent `useTransition()`
call — React allows multiple per component, and since only one button per page can be in flight
at a time, this avoids any "which action" bookkeeping. Only the offer-card case (#3/#4) needs
the lifted `pendingOfferId`/`pendingAction` state, because it's a list.

## Data flow

All new state (`isPending` from each `useTransition`, plus `pendingOfferId`/`pendingAction` on
`ResultsPage`) is local component state — nothing changes in `useTripFlow()` (the shared context
store) or in any API call. This is purely a visual affordance: the click still does exactly what
it does today (write to context/local state, then `router.push`); the only addition is a flag
that flips the `Button`'s `loading` prop on until the destination route mounts, at which point the
originating component unmounts and the flag's lifetime ends with it — no manual reset needed.

## Error handling

None of the touched handlers perform a fetch or validation that can reject — they're synchronous
context/state writes followed by a client-side navigation. There's no new error path to handle.
The one button with real async work and error handling (`Enviar solicitação`) is untouched.

## Testing

- Run the existing suite (`npm run test`) and `npx tsc --noEmit` to confirm no regressions —
  no new unit tests are expected since no new branching logic is introduced (see Decision 4).
- Manual verification (`npm run dev`): click each of the 8 buttons and confirm the shimmer
  appears immediately and the button is disabled until the next route mounts; for the offer-card
  buttons specifically, confirm clicking one card's "Ver detalhes"/"Selecionar" only shimmers
  that card's button, not every card in the list.
