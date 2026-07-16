# New-Request Flow Button Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing `Button` `loading` prop (CSS shimmer, `src/components/ui/button.tsx`) onto every button in the "issue a new travel request" wizard that currently lacks it, so each shows loading feedback while its navigation is in flight.

**Architecture:** None of the 8 target buttons perform real async work in their click/submit handler — each is a synchronous context/state write followed by `router.push(...)`. Each handler is wrapped in `React.useTransition()`, and the resulting `isPending` boolean is passed straight into the `Button`'s existing `loading` prop. The one list-based case (offer cards in the results list) lifts a `pendingOfferId`/`pendingOfferAction` pair into the parent page so only the clicked card's specific button shimmers.

**Tech Stack:** Next.js 14 / React 18 / TypeScript, react-hook-form, shadcn/ui `Button` component.

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-07-16-new-request-flow-button-loading-design.md`.
- Reuse the existing `Button` `loading` prop (`src/components/ui/button.tsx`, built in `docs/superpowers/plans/2026-07-15-button-loading-shimmer.md`) — do not create a new component or animation.
- Mechanism is `React.useTransition()` wrapping each handler's existing body — never a manually-toggled `useState` flag that needs a reset.
- Out of scope, do not touch: the mobile "Filtros" `SheetTrigger` button in `results/page.tsx` (no navigation, nothing to gate on), and the generic "Tentar novamente" retry button in `error-state.tsx` (shared component, deliberately excluded by a prior plan).
- "Enviar solicitação" on `request/review/page.tsx` already has `loading={submitting}` wired to its real `fetch` call — do not change it.
- No new automated tests — this is a UI/interaction-only change with no new branching logic to unit test (per the design spec's Decision 4).
- Commit after each task using Conventional Commits style (`feat:`), matching this repo's existing commit history.

---

### Task 1: "Buscar ofertas" — `search-criteria-form.tsx`

**Files:**
- Modify: `src/components/trip/search-criteria-form.tsx`

**Interfaces:**
- None consumed from other tasks. Produces nothing other tasks depend on — this file is touched only here.

- [ ] **Step 1: Add the `useTransition` import**

In `src/components/trip/search-criteria-form.tsx`, the file currently has no bare `"react"` import (line 1 is `"use client";`, line 2 is blank, line 3 is `import { useRouter } from "next/navigation";`). Add a new import line before it:

```tsx
import { useTransition } from "react";
import { useRouter } from "next/navigation";
```

- [ ] **Step 2: Add the `useTransition` hook and wrap `onSubmit`**

Find this block (currently lines 78-100):

```tsx
export function SearchCriteriaForm() {
  const router = useRouter();
  const { setCriteria } = useTripFlow();
  const form = useForm<TripSearchFormValues>({
```

Add the hook right after `const { setCriteria } = useTripFlow();`:

```tsx
export function SearchCriteriaForm() {
  const router = useRouter();
  const { setCriteria } = useTripFlow();
  const [isPending, startTransition] = useTransition();
  const form = useForm<TripSearchFormValues>({
```

Then replace the `onSubmit` function:

```tsx
  function onSubmit(values: TripSearchFormValues) {
    setCriteria(tripSearchToCriteria(values));
    router.push("/results");
  }
```

with:

```tsx
  function onSubmit(values: TripSearchFormValues) {
    startTransition(() => {
      setCriteria(tripSearchToCriteria(values));
      router.push("/results");
    });
  }
```

- [ ] **Step 3: Wire `loading` on the submit button**

Replace:

```tsx
              <div className="flex justify-end">
                <Button type="submit" size="lg" className="bg-brand-gradient hover:bg-brand-gradient-hover">
                  Buscar ofertas
                </Button>
              </div>
```

with:

```tsx
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="lg"
                  loading={isPending}
                  className="bg-brand-gradient hover:bg-brand-gradient-hover"
                >
                  Buscar ofertas
                </Button>
              </div>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/trip/search-criteria-form.tsx
git commit -m "$(cat <<'EOF'
feat: show loading on Buscar ofertas during navigation to results

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: "Editar busca", "Ver detalhes", "Selecionar" — `results/page.tsx` + `offer-card.tsx`

**Files:**
- Modify: `src/app/(app)/results/page.tsx`
- Modify: `src/components/trip/offer-card.tsx`

**Interfaces:**
- Produces: `OfferCard` gains two new optional props, `loadingSelect?: boolean` and `loadingView?: boolean` (both default `false`) — consumed only by `results/page.tsx` in this task, no other file renders `OfferCard`.

- [ ] **Step 1: Add the `useTransition` import in `results/page.tsx`**

Replace line 3:

```tsx
import { useEffect, useMemo, useState } from "react";
```

with:

```tsx
import { useEffect, useMemo, useState, useTransition } from "react";
```

- [ ] **Step 2: Add the new pending-state hooks**

Find this block (currently lines 130-131):

```tsx
  const [searchError, setSearchError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
```

Add after it:

```tsx
  const [searchError, setSearchError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [isEditingSearch, startEditSearchTransition] = useTransition();
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null);
  const [pendingOfferAction, setPendingOfferAction] = useState<"view" | "select" | null>(null);
  const [isOfferActionPending, startOfferActionTransition] = useTransition();
```

- [ ] **Step 3: Wrap `handleSelect`/`handleViewDetails`, add `handleEditSearch`**

Replace this block (currently lines 204-212):

```tsx
  function handleSelect(offer: FlightOffer) {
    selectOffer(offer.id);
    router.push(`/request/passengers/${offer.id}`);
  }

  function handleViewDetails(offer: FlightOffer) {
    selectOffer(offer.id);
    router.push(`/offer/${offer.id}`);
  }
```

with:

```tsx
  function handleSelect(offer: FlightOffer) {
    setPendingOfferId(offer.id);
    setPendingOfferAction("select");
    startOfferActionTransition(() => {
      selectOffer(offer.id);
      router.push(`/request/passengers/${offer.id}`);
    });
  }

  function handleViewDetails(offer: FlightOffer) {
    setPendingOfferId(offer.id);
    setPendingOfferAction("view");
    startOfferActionTransition(() => {
      selectOffer(offer.id);
      router.push(`/offer/${offer.id}`);
    });
  }

  function handleEditSearch() {
    startEditSearchTransition(() => {
      router.push("/");
    });
  }
```

- [ ] **Step 4: Wire `loading` on the "Editar busca" header button**

Replace (currently lines 240-242):

```tsx
        <Button variant="secondary" onClick={() => router.push("/")}>
          <PencilLine className="mr-1.5 h-4 w-4" /> Editar busca
        </Button>
```

with:

```tsx
        <Button variant="secondary" loading={isEditingSearch} onClick={handleEditSearch}>
          <PencilLine className="mr-1.5 h-4 w-4" /> Editar busca
        </Button>
```

(The two other "Editar busca" buttons rendered via `EmptyState`'s `button` prop, at what are currently lines 193 and 288, are out of scope — leave them untouched.)

- [ ] **Step 5: Pass the new per-card pending props at the `OfferCard` call site**

Replace (currently lines 291-298):

```tsx
            filtered.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                onSelect={() => handleSelect(offer)}
                onViewDetails={() => handleViewDetails(offer)}
              />
            ))
```

with:

```tsx
            filtered.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                onSelect={() => handleSelect(offer)}
                onViewDetails={() => handleViewDetails(offer)}
                loadingSelect={
                  isOfferActionPending && pendingOfferId === offer.id && pendingOfferAction === "select"
                }
                loadingView={
                  isOfferActionPending && pendingOfferId === offer.id && pendingOfferAction === "view"
                }
              />
            ))
```

- [ ] **Step 6: Add the new props to `OfferCard`'s signature**

In `src/components/trip/offer-card.tsx`, replace (currently lines 25-33):

```tsx
export function OfferCard({
  offer,
  onSelect,
  onViewDetails,
}: {
  offer: FlightOffer;
  onSelect: () => void;
  onViewDetails: () => void;
}) {
```

with:

```tsx
export function OfferCard({
  offer,
  onSelect,
  onViewDetails,
  loadingSelect = false,
  loadingView = false,
}: {
  offer: FlightOffer;
  onSelect: () => void;
  onViewDetails: () => void;
  loadingSelect?: boolean;
  loadingView?: boolean;
}) {
```

- [ ] **Step 7: Wire `loading` on the two card buttons**

Replace (currently lines 104-111):

```tsx
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onViewDetails}>
              Ver detalhes
            </Button>
            <Button type="button" className="bg-brand-gradient hover:bg-brand-gradient-hover" onClick={onSelect}>
              Selecionar
            </Button>
          </div>
```

with:

```tsx
          <div className="flex gap-2">
            <Button type="button" variant="secondary" loading={loadingView} onClick={onViewDetails}>
              Ver detalhes
            </Button>
            <Button
              type="button"
              className="bg-brand-gradient hover:bg-brand-gradient-hover"
              loading={loadingSelect}
              onClick={onSelect}
            >
              Selecionar
            </Button>
          </div>
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(app)/results/page.tsx" src/components/trip/offer-card.tsx
git commit -m "$(cat <<'EOF'
feat: show loading on Editar busca, Ver detalhes, and Selecionar buttons

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: "Selecionar oferta" — `offer/[id]/page.tsx`

**Files:**
- Modify: `src/app/(app)/offer/[id]/page.tsx`

**Interfaces:**
- None consumed from other tasks. This file is touched only here.

- [ ] **Step 1: Add the `useTransition` import**

The file currently has no bare `"react"` import. Add a new import line before the existing `next/navigation` import (currently line 3):

```tsx
import { useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
```

- [ ] **Step 2: Add the hook, before the early return**

Find this block (currently lines 16-20):

```tsx
  const { offers, selectOffer, criteria } = useTripFlow();
  const offer = offers.find((o) => o.id === id);
  const passengerCount = criteria?.passengers?.length ?? 1;

  if (!offer) {
```

Add the hook between `passengerCount` and the `if`:

```tsx
  const { offers, selectOffer, criteria } = useTripFlow();
  const offer = offers.find((o) => o.id === id);
  const passengerCount = criteria?.passengers?.length ?? 1;
  const [isPending, startTransition] = useTransition();

  if (!offer) {
```

(This must be declared before the early return — React hooks cannot follow a conditional `return`.)

- [ ] **Step 3: Wrap `handleSelectOffer`**

Replace (currently lines 39-43):

```tsx
  function handleSelectOffer() {
    if (!offer) return;
    selectOffer(offer.id);
    router.push(`/request/passengers/${offer.id}`);
  }
```

with:

```tsx
  function handleSelectOffer() {
    if (!offer) return;
    startTransition(() => {
      selectOffer(offer.id);
      router.push(`/request/passengers/${offer.id}`);
    });
  }
```

- [ ] **Step 4: Wire `loading` on the button**

Replace (currently lines 178-184):

```tsx
            <Button
              className="w-full bg-brand-gradient hover:bg-brand-gradient-hover"
              disabled={isExpired}
              onClick={handleSelectOffer}
            >
              Selecionar oferta
            </Button>
```

with:

```tsx
            <Button
              className="w-full bg-brand-gradient hover:bg-brand-gradient-hover"
              disabled={isExpired}
              loading={isPending}
              onClick={handleSelectOffer}
            >
              Selecionar oferta
            </Button>
```

(`Button` already forces `disabled={disabled || loading}` internally, so this correctly stays disabled if the offer is expired AND shows the shimmer while pending.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/offer/[id]/page.tsx"
git commit -m "$(cat <<'EOF'
feat: show loading on Selecionar oferta during navigation to passengers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: "Voltar" and "Continuar para revisão" — `passengers/[offerId]/page.tsx`

**Files:**
- Modify: `src/app/(app)/request/passengers/[offerId]/page.tsx`

**Interfaces:**
- None consumed from other tasks. This file is touched only here.

- [ ] **Step 1: Add `useTransition` to the existing `"react"` import**

Replace (currently line 3):

```tsx
import { useMemo } from "react";
```

with:

```tsx
import { useMemo, useTransition } from "react";
```

- [ ] **Step 2: Add the two hooks, before the early return**

Find this block (currently lines 78-79):

```tsx
  const { criteria, offers, setPassengers } = useTripFlow();
  const offer = offers.find((o) => o.id === offerId);
```

Add after it:

```tsx
  const { criteria, offers, setPassengers } = useTripFlow();
  const offer = offers.find((o) => o.id === offerId);
  const [isBackPending, startBackTransition] = useTransition();
  const [isSubmitPending, startSubmitTransition] = useTransition();
```

(This must come before the `if (!criteria || !offer)` early return at what is currently line 98 — hooks cannot follow a conditional `return`.)

- [ ] **Step 3: Wrap `onSubmit`**

Replace this block (currently lines 110-138):

```tsx
  function onSubmit(values: DuffelPassengersFormValues) {
    setPassengers(
      values.passengers.map((p) => ({
        id: p.id,
        type: p.type,
        title: p.title,
        given_name: p.given_name,
        family_name: p.family_name,
        born_on: p.born_on,
        gender: p.gender,
        email: p.email,
        phone_number: toE164(p.phoneCountry, p.phoneLocalNumber),
        ...(p.passportRequired
          ? {
              identity_documents: [
                {
                  type: "passport" as const,
                  unique_identifier: p.passportNumber ?? "",
                  issuing_country_code: p.passportIssuingCountry ?? "",
                  expires_on: p.passportExpiresOn ?? "",
                },
              ],
            }
          : {}),
        ...(p.infantResponsibleFor ? { infant_passenger_id: p.infantResponsibleFor } : {}),
      }))
    );
    router.push("/request/review");
  }
```

with:

```tsx
  function onSubmit(values: DuffelPassengersFormValues) {
    startSubmitTransition(() => {
      setPassengers(
        values.passengers.map((p) => ({
          id: p.id,
          type: p.type,
          title: p.title,
          given_name: p.given_name,
          family_name: p.family_name,
          born_on: p.born_on,
          gender: p.gender,
          email: p.email,
          phone_number: toE164(p.phoneCountry, p.phoneLocalNumber),
          ...(p.passportRequired
            ? {
                identity_documents: [
                  {
                    type: "passport" as const,
                    unique_identifier: p.passportNumber ?? "",
                    issuing_country_code: p.passportIssuingCountry ?? "",
                    expires_on: p.passportExpiresOn ?? "",
                  },
                ],
              }
            : {}),
          ...(p.infantResponsibleFor ? { infant_passenger_id: p.infantResponsibleFor } : {}),
        }))
      );
      router.push("/request/review");
    });
  }
```

- [ ] **Step 4: Wire `loading` on both buttons**

Replace (currently lines 428-435):

```tsx
          <div className="flex items-center justify-between">
            <Button type="button" variant="link" onClick={() => router.push(`/offer/${offer.id}`)}>
              Voltar
            </Button>
            <Button type="submit" className="bg-brand-gradient hover:bg-brand-gradient-hover">
              Continuar para revisão
            </Button>
          </div>
```

with:

```tsx
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="link"
              loading={isBackPending}
              onClick={() => startBackTransition(() => router.push(`/offer/${offer.id}`))}
            >
              Voltar
            </Button>
            <Button type="submit" loading={isSubmitPending} className="bg-brand-gradient hover:bg-brand-gradient-hover">
              Continuar para revisão
            </Button>
          </div>
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/request/passengers/[offerId]/page.tsx"
git commit -m "$(cat <<'EOF'
feat: show loading on Voltar and Continuar para revisão buttons

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: "Voltar" — `request/review/page.tsx`

**Files:**
- Modify: `src/app/(app)/request/review/page.tsx`

**Interfaces:**
- None consumed from other tasks. This file's "Enviar solicitação" button (already `loading={submitting}`) is untouched — only the "Voltar" button changes.

- [ ] **Step 1: Add `useTransition` to the existing `"react"` import**

Replace (currently line 3):

```tsx
import { useEffect, useState } from "react";
```

with:

```tsx
import { useEffect, useState, useTransition } from "react";
```

- [ ] **Step 2: Add the hook**

Find this block (currently line 31):

```tsx
  const [submitting, setSubmitting] = useState(false);
```

Add after it:

```tsx
  const [submitting, setSubmitting] = useState(false);
  const [isBackPending, startBackTransition] = useTransition();
```

- [ ] **Step 3: Wire `loading` on the "Voltar" button**

Replace (currently lines 287-289):

```tsx
            <Button type="button" variant="link" onClick={() => router.push(`/request/passengers/${offer.id}`)}>
              Voltar
            </Button>
```

with:

```tsx
            <Button
              type="button"
              variant="link"
              loading={isBackPending}
              onClick={() => startBackTransition(() => router.push(`/request/passengers/${offer.id}`))}
            >
              Voltar
            </Button>
```

Do not change the adjacent "Enviar solicitação" button (currently lines 290-298) — it already has `loading={submitting}` wired to its real `fetch` call.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/request/review/page.tsx"
git commit -m "$(cat <<'EOF'
feat: show loading on review page's Voltar button

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Full verification pass

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: everything from Tasks 1-5.

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, no failures (248/248 across 25 files as of this plan's writing — no new tests were added per the design spec's Decision 4, so the count should be unchanged; a small drift from unrelated concurrent work is fine, a failure is not).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors (pre-existing `@next/next/no-img-element` warnings on unrelated files are fine; no new warnings from the files this plan touches).

- [ ] **Step 3: Run a full build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual click-through**

Run: `npm run dev`, log in, and walk the full new-request flow end to end:

1. On `/`, fill the search form and click **Buscar ofertas** — confirm the shimmer appears immediately and the button is disabled until `/results` has loaded.
2. On `/results`, click **Editar busca** — confirm it shimmers, then returns to `/`.
3. Back on `/results`, click **Ver detalhes** on one offer card — confirm only that card's "Ver detalhes" button shimmers (not "Selecionar" on the same card, and not any button on a different card), then navigates to `/offer/[id]`.
4. Go back to `/results` and click **Selecionar** on an offer card instead — confirm only that card's "Selecionar" button shimmers.
5. On `/offer/[id]`, click **Selecionar oferta** — confirm it shimmers and navigates to the passengers step.
6. On the passengers step, click **Voltar** — confirm it shimmers and returns to the offer detail page.
7. Go forward again, fill passenger data, click **Continuar para revisão** — confirm it shimmers and navigates to the review step.
8. On the review step, click **Voltar** — confirm it shimmers and returns to the passengers step.
9. Go forward again and click **Enviar solicitação** — confirm this still works exactly as before (unchanged in this plan).

- [ ] **Step 5: Confirm excluded buttons are unaffected**

On `/results` (mobile viewport or narrow window), open the **Filtros** sheet — confirm it opens instantly with no loading state (unchanged, out of scope). If a search error occurs, confirm **Tentar novamente** is also unchanged.
