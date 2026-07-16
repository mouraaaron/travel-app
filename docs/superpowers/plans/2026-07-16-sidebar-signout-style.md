# Sidebar Sign-Out Button Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the "Sair" (sign-out) button in the app sidebar so it visually matches the plain nav-link style used by the other sidebar items (icon + text, no button chrome), instead of looking like a filled/outlined `Button`.

**Architecture:** `SignOutButton` (`src/components/layout/sign-out-button.tsx`) currently renders a shadcn `Button` (`variant="outline"`). It is only consumed once, inside `AppSidebar`'s desktop footer (`src/components/layout/app-sidebar.tsx:89`). Since it uses no `Button` prop besides `className`, it will be changed to render a native `<button>` styled with the exact Tailwind classes `AppSidebar`'s `renderDesktopLink` already uses for nav items, so "Sair" is visually indistinguishable from the rest of the menu except for its position below the avatar block. No other files change.

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind CSS, lucide-react icons, `cn()` utility from `@/lib/utils`.

## Global Constraints

- Keep the avatar + name block above the button exactly as-is (no layout change to that block or its `border-t border-sidebar-border` wrapper in `app-sidebar.tsx`).
- Keep the `LogOut` icon (do not swap to a different icon).
- Keep exactly one divider (the existing `border-t` above the whole footer block) — do not add a second divider between avatar and button.
- `SignOutButton`'s public interface (`{ className }: { className?: string }` prop, still merged via `cn()`) must not change — it's a drop-in style swap only.
- The sign-out behavior (`supabase.auth.signOut()` → `router.push("/login")` → `router.refresh()`) must be byte-for-byte unchanged.
- This codebase has no React component-render test setup (no `@testing-library/react`/jsdom dependency, no `.test.tsx` files) — existing tests (e.g. `src/components/ui/button.test.ts`) only test exported constants/logic, not rendered markup. Do not introduce a new testing pattern for this task; verification is via `tsc`/lint and manual visual check in the dev server, consistent with the rest of the sidebar's styling work.

---

### Task 1: Restyle `SignOutButton` to match sidebar nav-link items

**Files:**
- Modify: `src/components/layout/sign-out-button.tsx` (full file, currently 30 lines)
- Reference (read-only, do not modify): `src/components/layout/app-sidebar.tsx:45-61` (`renderDesktopLink`, source of the class string to match) and `:82-90` (footer block that stays unchanged)

**Interfaces:**
- Consumes: `cn` from `@/lib/utils` (unchanged import), `LogOut` from `lucide-react` (unchanged import), `createSupabaseBrowserClient` from `@/lib/supabase/client` (unchanged import), `useRouter` from `next/navigation` (unchanged import).
- Produces: `SignOutButton({ className }: { className?: string })` — same exported function name, same props shape, as consumed by `app-sidebar.tsx:89` (`<SignOutButton />`, no args passed today).

- [ ] **Step 1: Read the current file to confirm no drift before editing**

Run: `cat src/components/layout/sign-out-button.tsx`

Expected output (current state):

```tsx
"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("w-full justify-start border-transparent bg-white text-neutral-900 hover:bg-white/90", className)}
      onClick={handleSignOut}
    >
      <LogOut className="mr-1.5 h-4 w-4" /> Sair
    </Button>
  );
}
```

If the file differs from this, stop and re-check with the plan author before proceeding — the rest of this task assumes this exact starting point.

- [ ] **Step 2: Replace the file contents with the native-button version**

Write the full file `src/components/layout/sign-out-button.tsx` as:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={cn(
        "flex h-8 w-full items-center gap-3 rounded-none px-3 py-1.5 text-[13px] font-normal leading-[18px] text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        className
      )}
    >
      <LogOut className="h-4 w-4" />
      Sair
    </button>
  );
}
```

Key changes from the original:
- Removed the `Button` import — no longer used.
- Root element is a native `<button>` instead of the shadcn `Button`.
- Class string now matches `renderDesktopLink`'s nav-item classes (`app-sidebar.tsx:52-55`) verbatim, so hover/typography/spacing are pixel-identical to the other menu items.
- `LogOut` icon drops `mr-1.5` (spacing now comes from the parent's `gap-3`, matching how `renderDesktopLink` spaces its `Icon` and label).
- `onClick` moved directly onto the native `<button>` (previously a prop on `Button`); `handleSignOut` itself is untouched.

- [ ] **Step 3: Type-check the change**

Run: `npx tsc --noEmit`

Expected: no errors (specifically, no "unused import" error for the removed `Button` import, and no type errors on the new `<button>` markup).

- [ ] **Step 4: Lint the change**

Run: `npx eslint src/components/layout/sign-out-button.tsx`

Expected: no errors or warnings.

- [ ] **Step 5: Manually verify in the dev server**

Run: `npm run dev`

Then in a browser:
1. Navigate to a logged-in page (e.g. `/` or `/admin`) so the sidebar renders.
2. Compare the "Sair" row at the bottom of the sidebar against the nav items above it (e.g. "Nova viagem", "Painel"): confirm same height, same font size/weight, same gray text color, and same hover highlight behavior when you mouse over it.
3. Confirm the avatar + name block above "Sair" is unchanged, and the single divider line still sits above that whole block (not between the avatar and the button).
4. Click "Sair" and confirm it still signs out and redirects to `/login`.

Stop the dev server (Ctrl+C) once verified.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/sign-out-button.tsx
git commit -m "style: match sidebar sign-out button to nav-link item style"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Every decision in `docs/superpowers/specs/2026-07-16-sidebar-signout-style-design.md` maps to this single task — avatar block untouched (Step 2 doesn't touch `app-sidebar.tsx`), `LogOut` icon retained (Step 2), single divider retained (no change to `app-sidebar.tsx:82`), mobile out of scope (no mobile files touched), native-`<button>` approach with `renderDesktopLink`'s exact class string (Step 2).
- **No placeholders:** every step shows the actual before/after code, exact commands, and expected output.
- **Type consistency:** `SignOutButton`'s exported signature (`{ className }: { className?: string }`) is unchanged from the original file, so the single call site (`app-sidebar.tsx:89`, no props passed) keeps working with no changes needed there.
