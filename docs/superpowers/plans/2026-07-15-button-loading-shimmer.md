# Button Loading Shimmer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's text-swap loading indicator ("Salvando...", "Aprovando...", etc.) on 13 existing buttons with a left-to-right shimmer sweep, driven by a new `loading` prop on the shared `Button` component.

**Architecture:** `Button` (`src/components/ui/button.tsx`) gains a `loading?: boolean` prop. When true, it renders an absolutely positioned `<span className="t-button-sweep">` behind the label and forces `disabled`. The sweep's color (light band on dark/colored backgrounds, dark band on light/transparent backgrounds) is picked automatically from the button's `variant` via an exported `SWEEP_TONE` map. The animation itself is pure CSS, added to `src/styles/transitions.css` following that file's existing token + `.t-*` class + `prefers-reduced-motion` guard conventions. 13 call sites across the app switch from `disabled={x}` + ternary text to `loading={x}` with a static label.

**Tech Stack:** Next.js/React/TypeScript, Tailwind, CVA (`class-variance-authority`), Vitest (`environment: "node"`, no jsdom/React Testing Library installed).

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-07-15-button-loading-shimmer-design.md`. Follow its visual spec exactly (45% width, `blur(2px)`, `translateX(-60%)→(160%)`, `1.6s linear infinite`).
- `loading={true}` always forces the button `disabled`, regardless of the `disabled` prop's own value (`disabled={disabled || loading}`).
- The sweep element is conditionally rendered (not CSS-hidden) — it must not exist in the DOM when `loading` is falsy.
- Every call-site change removes the old ternary loading text; the button keeps a single static label at all times.
- `asChild` buttons never render the sweep (Radix `Slot` requires exactly one child element; injecting a sweep sibling would break it). `loading` on an `asChild` button is a no-op — this is intentional, not a bug.
- This repo has **no jsdom / React Testing Library** (`vitest.config.ts` uses `environment: "node"`; there are zero `.test.tsx` files today). Do not add that infrastructure as part of this plan — it's out of scope (YAGNI/follow existing patterns). Verification per task is `npx tsc --noEmit` plus a final manual browser pass; the one exception is `SWEEP_TONE`, which is plain data and gets a real Vitest test.
- Scope is exactly the 13 buttons listed in the design spec. Do not touch navigation-only buttons, `Select`/`Switch` controls, or the generic `error-state.tsx` retry button.
- Commit after each task using Conventional Commits style (`feat:`), matching this repo's existing commit history.

---

### Task 1: Button-sweep motion tokens and CSS

**Files:**
- Modify: `src/styles/transitions.css`

**Interfaces:**
- Produces: CSS classes `t-button-sweep`, `t-button-sweep--light`, `t-button-sweep--dark`, and the `@keyframes t-button-sweep-move` animation — consumed by Task 2.

- [ ] **Step 1: Add the button-sweep tokens to the existing `:root` block**

In `src/styles/transitions.css`, the `:root` block ends with the "Texts reveal" token group (around line 150, just before the closing `}` of `:root`). Add a new group right after it, still inside `:root`:

```css
  /* Texts reveal */
  --stagger-dur: 500ms;
  --stagger-distance: 12px;
  --stagger-stagger: 40ms;
  --stagger-blur: 3px;
  --stagger-ease: cubic-bezier(0.22, 1, 0.36, 1);
  /* Button loading sweep */
  --button-sweep-dur: 1600ms;
  --button-sweep-ease: linear;
  --button-sweep-width: 45%;
  --button-sweep-blur: 2px;
  --button-sweep-light: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.55) 50%, rgba(255, 255, 255, 0) 100%);
  --button-sweep-dark: linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.12) 50%, rgba(0, 0, 0, 0) 100%);
}
```

(Only the `/* Button loading sweep */` block through the closing `}` is new — the `--stagger-*` lines already exist and are shown for placement context.)

- [ ] **Step 2: Add the behavior block after the "Texts reveal" section**

The file currently ends with the "Texts reveal" `@media (prefers-reduced-motion: reduce)` block:

```css
@media (prefers-reduced-motion: reduce) {
  .t-stagger-line { transition: none !important; opacity: 1; transform: none; filter: none; }
}
```

Append a new section after it (end of file):

```css

/* ─────────────────────────────────────────────────────────────────────────
 * Button loading sweep. A blurred band of light sweeps left-to-right across
 * a button while `loading` is true. Rendered by <Button loading> when the
 * sweep span is present in the DOM (see src/components/ui/button.tsx).
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
.t-button-sweep--dark { background: var(--button-sweep-dark); }

@keyframes t-button-sweep-move {
  0% { transform: translateX(-60%); }
  100% { transform: translateX(160%); }
}

@media (prefers-reduced-motion: reduce) {
  .t-button-sweep { display: none; }
}
```

- [ ] **Step 3: Verify the file is valid CSS**

Run: `npx tsc --noEmit`
Expected: no errors (this step just confirms the surrounding build isn't broken; CSS itself has no type checker in this project — visual confirmation happens in Task 13).

- [ ] **Step 4: Commit**

```bash
git add src/styles/transitions.css
git commit -m "$(cat <<'EOF'
feat: add button-sweep loading animation tokens

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `loading` prop on the shared `Button` component

**Files:**
- Modify: `src/components/ui/button.tsx`
- Create: `src/components/ui/button.test.ts`

**Interfaces:**
- Consumes: `.t-button-sweep`, `.t-button-sweep--light`, `.t-button-sweep--dark` CSS classes from Task 1.
- Produces: `Button` prop `loading?: boolean`; exported `SWEEP_TONE: Record<ButtonVariant, "light" | "dark">` and `ButtonVariant` type — not consumed by later tasks directly (call sites only use `loading`), but `SWEEP_TONE` is what Task 13's manual check will use to enumerate variant/tone combinations.

- [ ] **Step 1: Write the failing test for `SWEEP_TONE`**

Create `src/components/ui/button.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SWEEP_TONE } from "./button";

describe("SWEEP_TONE", () => {
  it("maps colored/dark-background variants to the light sweep", () => {
    expect(SWEEP_TONE.default).toBe("light");
    expect(SWEEP_TONE.destructive).toBe("light");
    expect(SWEEP_TONE.secondary).toBe("light");
    expect(SWEEP_TONE.success).toBe("light");
  });

  it("maps light/transparent-background variants to the dark sweep", () => {
    expect(SWEEP_TONE.outline).toBe("dark");
    expect(SWEEP_TONE.ghost).toBe("dark");
    expect(SWEEP_TONE.link).toBe("dark");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/ui/button.test.ts`
Expected: FAIL — `SWEEP_TONE` is not exported from `./button` yet (module has no such export).

- [ ] **Step 3: Implement `loading`, `SWEEP_TONE`, and the sweep render in `button.tsx`**

Replace the full contents of `src/components/ui/button.tsx`:

```tsx
"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium ring-offset-background transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        success:
          "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-sm px-3",
        lg: "h-11 rounded-sm px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>

/**
 * Which sweep color reads correctly over each variant's background:
 * light band for colored/dark fills, dark band for light/transparent ones.
 */
export const SWEEP_TONE: Record<ButtonVariant, "light" | "dark"> = {
  default: "light",
  destructive: "light",
  secondary: "light",
  success: "light",
  outline: "dark",
  ghost: "dark",
  link: "dark",
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    // Slot renders its single child as-is, so the sweep (an extra sibling)
    // can only be injected for real <button> elements.
    const showSweep = loading && !asChild
    const tone = SWEEP_TONE[variant ?? "default"]

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          showSweep && "relative overflow-hidden"
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {showSweep ? (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "t-button-sweep",
                tone === "light" ? "t-button-sweep--light" : "t-button-sweep--dark"
              )}
            />
            <span className="relative z-[2]">{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/ui/button.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/button.test.ts
git commit -m "$(cat <<'EOF'
feat: add loading prop to Button for the sweep animation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Login submit button

**Files:**
- Modify: `src/app/login/page.tsx:100-106`

**Interfaces:**
- Consumes: `Button` prop `loading?: boolean` (Task 2).

- [ ] **Step 1: Replace the submit button**

In `src/app/login/page.tsx`, replace:

```tsx
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-brand-gradient hover:bg-brand-gradient-hover"
                >
                  {submitting ? "Entrando..." : "Entrar"}
                </Button>
```

with:

```tsx
                <Button
                  type="submit"
                  loading={submitting}
                  className="bg-brand-gradient hover:bg-brand-gradient-hover"
                >
                  Entrar
                </Button>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "$(cat <<'EOF'
feat: use loading shimmer on the login submit button

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Request review submit button

**Files:**
- Modify: `src/app/(app)/request/review/page.tsx:290-297`

**Interfaces:**
- Consumes: `Button` prop `loading?: boolean` (Task 2).

- [ ] **Step 1: Replace the submit button**

`submitting` is the pending flag; `!policyLoaded` is an unrelated gating condition and stays on `disabled`. In `src/app/(app)/request/review/page.tsx`, replace:

```tsx
            <Button
              type="submit"
              size="lg"
              disabled={submitting || !policyLoaded}
              className="bg-brand-gradient hover:bg-brand-gradient-hover"
            >
              {submitting ? "Enviando..." : !policyLoaded ? "Carregando política..." : "Enviar solicitação"}
            </Button>
```

with:

```tsx
            <Button
              type="submit"
              size="lg"
              loading={submitting}
              disabled={!policyLoaded}
              className="bg-brand-gradient hover:bg-brand-gradient-hover"
            >
              Enviar solicitação
            </Button>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/request/review/page.tsx"
git commit -m "$(cat <<'EOF'
feat: use loading shimmer on the request review submit button

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Admin request approve and reject buttons

**Files:**
- Modify: `src/components/admin/request-detail-view.tsx:165-171,215-221`

**Interfaces:**
- Consumes: `Button` prop `loading?: boolean` (Task 2).

- [ ] **Step 1: Replace the "Aprovar" button**

In `src/components/admin/request-detail-view.tsx`, replace:

```tsx
                  <Button
                    className="bg-brand-gradient hover:bg-brand-gradient-hover"
                    disabled={approving}
                    onClick={handleApprove}
                  >
                    {approving ? "Aprovando..." : "Aprovar"}
                  </Button>
```

with:

```tsx
                  <Button
                    className="bg-brand-gradient hover:bg-brand-gradient-hover"
                    loading={approving}
                    onClick={handleApprove}
                  >
                    Aprovar
                  </Button>
```

- [ ] **Step 2: Replace the "Confirmar rejeição" button**

`rejecting` is the pending flag; the empty-reason check is an unrelated gating condition and stays on `disabled`. Replace:

```tsx
            <Button
              variant="destructive"
              disabled={rejecting || rejectReason.trim().length === 0}
              onClick={handleRejectConfirm}
            >
              {rejecting ? "Rejeitando..." : "Confirmar rejeição"}
            </Button>
```

with:

```tsx
            <Button
              variant="destructive"
              loading={rejecting}
              disabled={rejectReason.trim().length === 0}
              onClick={handleRejectConfirm}
            >
              Confirmar rejeição
            </Button>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/request-detail-view.tsx
git commit -m "$(cat <<'EOF'
feat: use loading shimmer on admin approve/reject buttons

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Employee-facing request cancel button

**Files:**
- Modify: `src/components/trip/request-detail-view.tsx:193-195`

**Interfaces:**
- Consumes: `Button` prop `loading?: boolean` (Task 2).

- [ ] **Step 1: Replace the "Cancelar solicitação" confirm button**

In `src/components/trip/request-detail-view.tsx`, replace:

```tsx
            <Button variant="destructive" disabled={cancelling} onClick={handleCancelConfirm}>
              {cancelling ? "Cancelando..." : "Cancelar solicitação"}
            </Button>
```

with:

```tsx
            <Button variant="destructive" loading={cancelling} onClick={handleCancelConfirm}>
              Cancelar solicitação
            </Button>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/trip/request-detail-view.tsx
git commit -m "$(cat <<'EOF'
feat: use loading shimmer on the request cancel button

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Onsite week retry and cancel buttons

**Files:**
- Modify: `src/components/admin/onsite-week-detail.tsx:176-178,198-200`

**Interfaces:**
- Consumes: `Button` prop `loading?: boolean` (Task 2).

- [ ] **Step 1: Replace the "Tentar novamente" button**

In `src/components/admin/onsite-week-detail.tsx`, replace:

```tsx
            <Button variant="secondary" disabled={retrying} onClick={handleRetry}>
              {retrying ? "Tentando novamente..." : `Tentar novamente (${failed.length})`}
            </Button>
```

with:

```tsx
            <Button variant="secondary" loading={retrying} onClick={handleRetry}>
              {`Tentar novamente (${failed.length})`}
            </Button>
```

- [ ] **Step 2: Replace the "Cancelar semana presencial" confirm button**

Replace:

```tsx
            <Button variant="destructive" disabled={cancelling} onClick={handleCancelConfirm}>
              {cancelling ? "Cancelando..." : "Cancelar semana presencial"}
            </Button>
```

with:

```tsx
            <Button variant="destructive" loading={cancelling} onClick={handleCancelConfirm}>
              Cancelar semana presencial
            </Button>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/onsite-week-detail.tsx
git commit -m "$(cat <<'EOF'
feat: use loading shimmer on onsite week retry/cancel buttons

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Policy rules save button

**Files:**
- Modify: `src/components/admin/policy-rules-form.tsx:89-91`

**Interfaces:**
- Consumes: `Button` prop `loading?: boolean` (Task 2).

- [ ] **Step 1: Replace the "Salvar" button**

In `src/components/admin/policy-rules-form.tsx`, replace:

```tsx
        <Button size="sm" className="w-fit" disabled={saving} onClick={handleSave}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
```

with:

```tsx
        <Button size="sm" className="w-fit" loading={saving} onClick={handleSave}>
          Salvar
        </Button>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/policy-rules-form.tsx
git commit -m "$(cat <<'EOF'
feat: use loading shimmer on the policy rules save button

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Employee travel profile save button

**Files:**
- Modify: `src/components/admin/employee-travel-profile-form.tsx:136-138`

**Interfaces:**
- Consumes: `Button` prop `loading?: boolean` (Task 2).

- [ ] **Step 1: Replace the "Salvar perfil de viagem" button**

In `src/components/admin/employee-travel-profile-form.tsx`, replace:

```tsx
      <Button size="sm" className="w-fit" disabled={saving} onClick={handleSave}>
        {saving ? "Salvando..." : "Salvar perfil de viagem"}
      </Button>
```

with:

```tsx
      <Button size="sm" className="w-fit" loading={saving} onClick={handleSave}>
        Salvar perfil de viagem
      </Button>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/employee-travel-profile-form.tsx
git commit -m "$(cat <<'EOF'
feat: use loading shimmer on the travel profile save button

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Organize onsite week flow — advance and confirm buttons

**Files:**
- Modify: `src/components/admin/organize-onsite-week-flow.tsx:142-144,210-212`

**Interfaces:**
- Consumes: `Button` prop `loading?: boolean` (Task 2).

- [ ] **Step 1: Replace the "Avançar" button**

In `src/components/admin/organize-onsite-week-flow.tsx`, replace:

```tsx
            <Button disabled={loadingPreview} onClick={handlePreview} className="w-fit">
              {loadingPreview ? "Carregando..." : "Avançar"}
            </Button>
```

with:

```tsx
            <Button loading={loadingPreview} onClick={handlePreview} className="w-fit">
              Avançar
            </Button>
```

- [ ] **Step 2: Replace the "Confirmar e buscar voos" button**

Replace:

```tsx
        <Button disabled={confirming} onClick={handleConfirm}>
          {confirming ? "Buscando voos e criando solicitações..." : "Confirmar e buscar voos"}
        </Button>
```

with:

```tsx
        <Button loading={confirming} onClick={handleConfirm}>
          Confirmar e buscar voos
        </Button>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/organize-onsite-week-flow.tsx
git commit -m "$(cat <<'EOF'
feat: use loading shimmer on the organize onsite week buttons

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Requests queue quick-approve button

**Files:**
- Modify: `src/components/admin/requests-queue.tsx:131-138`

**Interfaces:**
- Consumes: `Button` prop `loading?: boolean` (Task 2).

- [ ] **Step 1: Replace the per-row "Aprovar" button**

In `src/components/admin/requests-queue.tsx`, replace:

```tsx
                      <Button
                        variant="success"
                        size="sm"
                        disabled={approvingId === request.id}
                        onClick={() => handleQuickApprove(request.id)}
                      >
                        {approvingId === request.id ? "Aprovando..." : "Aprovar"}
                      </Button>
```

with:

```tsx
                      <Button
                        variant="success"
                        size="sm"
                        loading={approvingId === request.id}
                        onClick={() => handleQuickApprove(request.id)}
                      >
                        Aprovar
                      </Button>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/requests-queue.tsx
git commit -m "$(cat <<'EOF'
feat: use loading shimmer on the requests queue approve button

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Requests list cancel button

**Files:**
- Modify: `src/components/trip/requests-list.tsx:121-129`

**Interfaces:**
- Consumes: `Button` prop `loading?: boolean` (Task 2).

- [ ] **Step 1: Replace the per-row "Cancelar" button**

In `src/components/trip/requests-list.tsx`, replace:

```tsx
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={cancellingId === request.id}
                      onClick={() => handleCancel(request.id)}
                    >
                      {cancellingId === request.id ? "Cancelando..." : "Cancelar"}
                    </Button>
```

with:

```tsx
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={cancellingId === request.id}
                      onClick={() => handleCancel(request.id)}
                    >
                      Cancelar
                    </Button>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/trip/requests-list.tsx
git commit -m "$(cat <<'EOF'
feat: use loading shimmer on the requests list cancel button

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Full verification pass

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: all buttons wired in Tasks 3-12, `Button` from Task 2.

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including the two `SWEEP_TONE` tests from Task 2.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Run a full build (catches type errors `tsc --noEmit` alone can miss in Next.js)**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual browser verification**

Run: `npm run dev`

Log in as `admin@demo.com` (password `Admin#Demo2026`, per the demo-credentials card on `/login`). Exercise at least one button of each `SWEEP_TONE` used in the 13 sites:
- **light tone:** the "Entrar" button on `/login` (trigger by submitting the login form) and "Aprovar" on an admin request detail page (`/admin/requests`) — confirm the white/translucent band sweeps left-to-right, loops smoothly with no visible jump, the button is unclickable while it runs, and it disappears the instant the request resolves.
- **dark tone:** "Cancelar" on `/requests` (employee-facing requests list, `variant="outline"`) — confirm the darker band is visible against the light button background and behaves the same way.

Then click a `Button asChild` link that was untouched by this plan — "Ver detalhes" on `/admin/requests` (in `requests-queue.tsx`) or `/requests` (in `requests-list.tsx`) — and confirm it still navigates normally. This exercises the `Comp`/`Slot` child-passthrough path from Task 2 and would fail loudly (a thrown `React.Children.only` error) if that path regressed.

Stop the dev server (Ctrl+C) when done.

- [ ] **Step 5: Confirm no stray call sites were missed**

Run: `grep -rn "? \"Salvando\|Aprovando\|Rejeitando\|Cancelando\|Tentando novamente\|Carregando\|Enviando\|Entrando\|Buscando voos" src --include="*.tsx"`
Expected: no matches (all 13 ternary loading-text call sites from the design spec's table were converted).
