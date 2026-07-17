# Sidebar Overlay + Pin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current push-via-flexbox, hover-only desktop sidebar with an overlay sidebar (fixed 64px slot, absolutely-positioned animated panel) that adds a persisted pin toggle, a breakpoint tier that ignores the pin between 1024–1367px, and spec-exact nav item styling — without touching `main`'s layout width or the mobile header.

**Architecture:** A pure, dependency-free state-derivation module (`src/lib/side-menu-state.ts`) computes `isOpen`/`isPinnable` from `{ tier, pinned, hovering }` — this is the only part with real unit tests, since the rest of the change is DOM/React wiring the project has no test harness for (`vitest.config.ts` runs in `environment: "node"`, no `@testing-library/react`). A thin hook (`use-side-menu.ts`) wraps that pure logic with `useState`/`useEffect`/`localStorage`/`window.innerWidth`. `desktop-sidebar.tsx` consumes the hook and switches from an animated root `<aside>` to a fixed-width sticky slot containing an absolutely-positioned animated panel, so `main` never reflows.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, `framer-motion` (already a dependency), `lucide-react` (already a dependency, provides `PanelLeftClose`/`PanelLeftOpen`), TypeScript strict mode, Vitest.

## Global Constraints

- No new dependencies — `framer-motion` `^12.42.2` and `lucide-react` `^1.23.0` are already installed.
- Widths: collapsed `64px`, expanded `248px` (not `249px` — matches the value already calibrated elsewhere in the project; see `docs/superpowers/specs/2026-07-17-sidebar-overlay-pin-design.md`).
- Breakpoints: `SIDEBAR_TABLET_BREAKPOINT = 1024` (matches the project's existing `lg` Tailwind breakpoint, no override in `tailwind.config.ts`), `SIDEBAR_PIN_BREAKPOINT = 1367`. Pin is honored only when `viewportWidth > 1367`; between `1024` and `1367` (inclusive) the pin is ignored but hover still opens the panel.
- `localStorage` key for the pin preference: `"sidebar-pinned-expanded"`. Read/write must be wrapped in `try/catch` — never throw if storage is unavailable (private browsing, SSR).
- Width/opacity transitions: `{ duration: 0.2, ease: "easeInOut" }`, but `duration: 0` when `useReducedMotion()` reports a reduced-motion preference — same convention as `src/components/admin/onsite-week-detail.tsx` and the current `desktop-sidebar.tsx`.
- Do not modify `src/components/layout/sign-out-button.tsx`, `src/components/layout/mobile-header.tsx`, `src/components/layout/nav-items.ts`, or `src/components/layout/authenticated-shell.tsx`. `authenticated-shell.tsx` needs no changes: `DesktopSidebar`'s root element already becomes a fixed-width (`w-16`), non-animating flex item, so the existing `<div className="flex"><DesktopSidebar /><main className="flex-1" /></div>` wrapper works unchanged. This is a deliberate deviation from the design doc's illustrative snippet (which showed the fixed-width slot living in `authenticated-shell.tsx`) — keeping the slot inside `DesktopSidebar` keeps the 64px-reservation detail encapsulated in the one component that owns it.
- No automated tests for React components/hooks in this task — the project has no `@testing-library/react` setup (confirmed via `vitest.config.ts`: `environment: "node"`). Only the pure logic in `src/lib/side-menu-state.ts` gets real unit tests. Everything else is verified with `npx tsc --noEmit`, `npm run lint`, and manual checks via `npm run dev`.
- Spec reference: `docs/superpowers/specs/2026-07-17-sidebar-overlay-pin-design.md`.

---

## Task 1: Pure side-menu state logic

**Files:**
- Create: `src/lib/side-menu-state.ts`
- Test: `src/lib/side-menu-state.test.ts`

**Interfaces:**
- Produces: `SIDEBAR_TABLET_BREAKPOINT: number`, `SIDEBAR_PIN_BREAKPOINT: number`, `type SideMenuTier = "mobile" | "tablet" | "desktop"`, `resolveSideMenuTier(viewportWidth: number): SideMenuTier`, `interface SideMenuDerivedState { isPinnable: boolean; isOpen: boolean }`, `deriveSideMenuState(params: { tier: SideMenuTier; pinned: boolean; hovering: boolean }): SideMenuDerivedState` — consumed by Task 2 (`use-side-menu.ts`) and re-exported (breakpoints only) by Task 2's `sidebar-constants.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/side-menu-state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveSideMenuState, resolveSideMenuTier } from "./side-menu-state";

describe("resolveSideMenuTier", () => {
  it("returns mobile below the tablet breakpoint", () => {
    expect(resolveSideMenuTier(1023)).toBe("mobile");
  });

  it("returns tablet at the tablet breakpoint", () => {
    expect(resolveSideMenuTier(1024)).toBe("tablet");
  });

  it("returns tablet at the pin breakpoint", () => {
    expect(resolveSideMenuTier(1367)).toBe("tablet");
  });

  it("returns desktop just above the pin breakpoint", () => {
    expect(resolveSideMenuTier(1368)).toBe("desktop");
  });
});

describe("deriveSideMenuState", () => {
  it("opens when pinned on desktop, even without hovering", () => {
    const result = deriveSideMenuState({ tier: "desktop", pinned: true, hovering: false });
    expect(result).toEqual({ isPinnable: true, isOpen: true });
  });

  it("stays collapsed on desktop when not pinned and not hovering", () => {
    const result = deriveSideMenuState({ tier: "desktop", pinned: false, hovering: false });
    expect(result).toEqual({ isPinnable: true, isOpen: false });
  });

  it("opens on hover even when not pinned", () => {
    const result = deriveSideMenuState({ tier: "desktop", pinned: false, hovering: true });
    expect(result).toEqual({ isPinnable: true, isOpen: true });
  });

  it("ignores pin on tablet tier but still opens on hover", () => {
    const pinnedNotHovering = deriveSideMenuState({ tier: "tablet", pinned: true, hovering: false });
    expect(pinnedNotHovering).toEqual({ isPinnable: false, isOpen: false });

    const pinnedHovering = deriveSideMenuState({ tier: "tablet", pinned: true, hovering: true });
    expect(pinnedHovering).toEqual({ isPinnable: false, isOpen: true });
  });

  it("ignores pin on mobile tier", () => {
    const result = deriveSideMenuState({ tier: "mobile", pinned: true, hovering: false });
    expect(result).toEqual({ isPinnable: false, isOpen: false });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/side-menu-state.test.ts`
Expected: FAIL — `Cannot find module './side-menu-state'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/side-menu-state.ts`:

```ts
export const SIDEBAR_TABLET_BREAKPOINT = 1024;
export const SIDEBAR_PIN_BREAKPOINT = 1367;

export type SideMenuTier = "mobile" | "tablet" | "desktop";

export function resolveSideMenuTier(viewportWidth: number): SideMenuTier {
  if (viewportWidth < SIDEBAR_TABLET_BREAKPOINT) return "mobile";
  if (viewportWidth <= SIDEBAR_PIN_BREAKPOINT) return "tablet";
  return "desktop";
}

export interface SideMenuDerivedState {
  isPinnable: boolean;
  isOpen: boolean;
}

export function deriveSideMenuState(params: {
  tier: SideMenuTier;
  pinned: boolean;
  hovering: boolean;
}): SideMenuDerivedState {
  const isPinnable = params.tier === "desktop";
  const isOpen = (isPinnable && params.pinned) || params.hovering;
  return { isPinnable, isOpen };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/side-menu-state.test.ts`
Expected: PASS — 9 tests passing (4 in `resolveSideMenuTier`, 5 in `deriveSideMenuState`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/side-menu-state.ts src/lib/side-menu-state.test.ts
git commit -m "feat: add pure side-menu state derivation logic"
```

---

## Task 2: Constants + `useSideMenu` hook

**Files:**
- Create: `src/components/layout/sidebar-constants.ts`
- Create: `src/components/layout/use-side-menu.ts`

**Interfaces:**
- Consumes: `deriveSideMenuState`, `resolveSideMenuTier`, `type SideMenuTier` from `@/lib/side-menu-state` (Task 1).
- Produces: `SIDEBAR_COLLAPSED_WIDTH: number`, `SIDEBAR_EXPANDED_WIDTH: number`, `SIDEBAR_PIN_STORAGE_KEY: string`, `SIDEBAR_TRANSITION_DURATION: number`, `SIDEBAR_TRANSITION_EASE: "easeInOut"` (from `sidebar-constants.ts`); `interface UseSideMenuResult { isOpen: boolean; pinned: boolean; isPinnable: boolean; showPinButton: boolean; setHovering: (value: boolean) => void; togglePinned: () => void }` and `useSideMenu(): UseSideMenuResult` (from `use-side-menu.ts`) — both consumed by Task 3 (`desktop-sidebar.tsx`).

- [ ] **Step 1: Create the constants file**

Create `src/components/layout/sidebar-constants.ts`:

```ts
export { SIDEBAR_PIN_BREAKPOINT, SIDEBAR_TABLET_BREAKPOINT } from "@/lib/side-menu-state";

export const SIDEBAR_COLLAPSED_WIDTH = 64;
export const SIDEBAR_EXPANDED_WIDTH = 248;
export const SIDEBAR_PIN_STORAGE_KEY = "sidebar-pinned-expanded";
export const SIDEBAR_TRANSITION_DURATION = 0.2;
export const SIDEBAR_TRANSITION_EASE = "easeInOut" as const;
```

- [ ] **Step 2: Create the hook**

Create `src/components/layout/use-side-menu.ts`:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { deriveSideMenuState, resolveSideMenuTier, type SideMenuTier } from "@/lib/side-menu-state";
import { SIDEBAR_PIN_STORAGE_KEY } from "./sidebar-constants";

export interface UseSideMenuResult {
  isOpen: boolean;
  pinned: boolean;
  isPinnable: boolean;
  showPinButton: boolean;
  setHovering: (value: boolean) => void;
  togglePinned: () => void;
}

function readStoredPinned(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_PIN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function useSideMenu(): UseSideMenuResult {
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tier, setTier] = useState<SideMenuTier>("desktop");

  useEffect(() => {
    setPinned(readStoredPinned());

    function syncTier() {
      setTier(resolveSideMenuTier(window.innerWidth));
    }

    syncTier();
    window.addEventListener("resize", syncTier);
    return () => window.removeEventListener("resize", syncTier);
  }, []);

  const togglePinned = useCallback(() => {
    setPinned((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(SIDEBAR_PIN_STORAGE_KEY, String(next));
      } catch {
        // localStorage unavailable (private browsing) — pin still works for this session
      }
      return next;
    });
  }, []);

  const { isOpen, isPinnable } = deriveSideMenuState({ tier, pinned, hovering });

  return { isOpen, pinned, isPinnable, showPinButton: isPinnable, setHovering, togglePinned };
}
```

Note on `window.innerWidth` + `resize`: the design doc describes two `matchMedia` listeners; this uses a single `resize` listener that recomputes the tier via `resolveSideMenuTier` instead. Same observable behavior (tier updates whenever the viewport crosses a breakpoint), fewer moving parts (no need to manage two separate `MediaQueryList` subscriptions).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (The hook isn't consumed anywhere yet, but must still type-check standalone.)

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/sidebar-constants.ts src/components/layout/use-side-menu.ts
git commit -m "feat: add sidebar constants and useSideMenu hook"
```

---

## Task 3: Rewrite `DesktopSidebar` — overlay layout, pin button, spec-exact nav styling

**Files:**
- Modify: `src/components/layout/desktop-sidebar.tsx` (full rewrite)

**Interfaces:**
- Consumes: `useSideMenu` and `UseSideMenuResult` from `./use-side-menu` (Task 2); `SIDEBAR_COLLAPSED_WIDTH`, `SIDEBAR_EXPANDED_WIDTH`, `SIDEBAR_TRANSITION_DURATION`, `SIDEBAR_TRANSITION_EASE` from `./sidebar-constants` (Task 2); `PanelLeftClose`, `PanelLeftOpen` from `lucide-react`; `ADMIN_NAV_ITEMS`, `PERSONAL_NAV_ITEMS`, `type NavItem` from `./nav-items` (unchanged); `cn`, `initialsFromName` from `@/lib/utils` (unchanged); `SignOutButton` from `./sign-out-button` (unchanged).
- Produces: `DesktopSidebar({ fullName, role }: { fullName: string; role: "employee" | "admin" })` — same public signature as today, consumed unchanged by `authenticated-shell.tsx`.

- [ ] **Step 1: Replace the file**

Replace the full contents of `src/components/layout/desktop-sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn, initialsFromName } from "@/lib/utils";
import { ADMIN_NAV_ITEMS, PERSONAL_NAV_ITEMS, type NavItem } from "./nav-items";
import { SignOutButton } from "./sign-out-button";
import { useSideMenu } from "./use-side-menu";
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  SIDEBAR_TRANSITION_DURATION,
  SIDEBAR_TRANSITION_EASE,
} from "./sidebar-constants";

export function DesktopSidebar({ fullName, role }: { fullName: string; role: "employee" | "admin" }) {
  const pathname = usePathname();
  const initials = initialsFromName(fullName);
  const isAdmin = role === "admin";
  const { isOpen, pinned, showPinButton, setHovering, togglePinned } = useSideMenu();
  const shouldReduceMotion = useReducedMotion();
  const transition = {
    duration: shouldReduceMotion ? 0 : SIDEBAR_TRANSITION_DURATION,
    ease: SIDEBAR_TRANSITION_EASE,
  };

  function renderLink(item: NavItem) {
    const active = pathname === item.href;
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "relative flex h-8 items-center gap-3 rounded-none px-6 py-1.5 text-sm font-normal leading-[18px] text-sidebar-foreground opacity-70 transition-colors hover:bg-[#13131680] hover:opacity-100",
          active && "bg-[#131316] font-medium opacity-100"
        )}
      >
        {active && !isOpen && (
          <span className="absolute inset-y-1 left-0 w-[2px] rounded-r-full bg-sidebar-foreground" />
        )}
        <Icon className="h-4 w-4 shrink-0" />
        <motion.span animate={{ opacity: isOpen ? 1 : 0 }} transition={transition} className="whitespace-nowrap">
          {item.label}
        </motion.span>
      </Link>
    );
  }

  return (
    <div className="sticky top-0 hidden h-screen w-16 shrink-0 lg:block">
      <motion.aside
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        animate={{ width: isOpen ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH }}
        transition={transition}
        className={cn(
          "group absolute inset-y-0 left-0 z-20 overflow-hidden bg-sidebar text-sidebar-foreground transition-shadow duration-200",
          isOpen && "shadow-[16px_0_40px_rgba(0,0,0,0.35)]"
        )}
      >
        <div className="flex h-full w-[248px] flex-col">
          <div className="relative flex h-14 shrink-0 items-center gap-3 px-6">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-[24px] w-[24px] shrink-0"
              aria-label="Paggo"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M22.5 19L8.49995 19L8.49995 15.9354C14.4876 15.8202 19.3201 10.9877 19.4352 5L22.5 5L22.5 19ZM1.5 5.00002H15.5V8.06464C9.51219 8.17968 4.67955 13.0122 4.56438 19H1.5V5.00002Z"
                fill="currentColor"
              />
            </svg>
            <motion.svg
              width="65"
              height="11"
              viewBox="77 0 189 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-[11px] w-[65px] shrink-0"
              aria-label="Paggo"
              animate={{ opacity: isOpen ? 1 : 0 }}
              transition={transition}
              style={{ pointerEvents: "none" }}
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M203.064 31.7501C197.199 30.7622 192.235 27.3522 190.135 22.8676C189.143 20.7491 188.778 19.2655 188.65 16.8378C188.398 12.0603 189.806 8.30307 193.023 5.16486C196.765 1.5143 201.817 -0.218554 207.867 0.0729304C211.306 0.238556 214.043 0.988091 216.812 2.52271C218.103 3.23786 220.117 4.61043 220.285 4.88947C220.41 5.09632 217.822 8.9542 217.547 8.97192C217.459 8.97732 216.878 8.62734 216.255 8.19359C214.587 7.03156 212.856 6.18587 211.107 5.67895C208.859 5.02719 204.459 5.02431 202.245 5.67278C197.976 6.92428 195.02 9.57359 194.06 13.0067C193.124 16.3586 193.825 19.8596 195.955 22.4732C199.871 27.2758 209.004 28.3075 215.023 24.6271L216.117 23.9586L216.173 21.676L216.229 19.3933H211.949H207.669V16.7394V14.0855H214.427H221.186V20.3883V26.691L219.645 27.7139C216.427 29.8505 214.303 30.8085 211.351 31.4542C208.917 31.9866 205.247 32.1179 203.064 31.7501ZM242.911 31.7148C235.454 30.3168 230.282 25.6706 228.943 19.1663C228.575 17.3755 228.667 13.566 229.123 11.783C230.185 7.62188 232.851 4.47298 237.075 2.3874C246.371 -2.20125 258.075 0.154323 262.955 7.59587C264.581 10.0744 265.35 12.7432 265.35 15.9011C265.35 23.5467 260.46 29.2195 251.968 31.4245C249.789 31.9902 245.17 32.1382 242.911 31.7148ZM251.565 26.2028C255.741 24.9478 258.729 22.3795 259.708 19.2028C261.296 14.0539 259.196 9.12705 254.451 6.86774C251.883 5.64498 250.262 5.31585 246.936 5.3421C244.495 5.36137 243.878 5.43707 242.313 5.9085C236.85 7.5546 233.961 10.9801 233.885 15.9011C233.839 18.8763 234.591 20.9504 236.415 22.8825C238.071 24.6364 240.318 25.85 243.084 26.4845C244.95 26.9126 249.732 26.7538 251.565 26.2028ZM150.121 22.6698C152.634 27.7739 157.687 31.0545 164.278 31.8608C166.468 32.1287 169.863 31.8312 172.405 31.1485C174.335 30.6305 177.429 29.1555 179.61 27.7141L181.227 26.6453V20.3337V14.0221H174.487H167.747V16.6771V19.3322H172.015H176.284L176.228 21.6192L176.172 23.9063L174.586 24.7849C171.538 26.4738 168.203 27.121 164.739 26.6962C159.086 26.0028 155.125 22.9515 153.976 18.4046C153.362 15.9768 153.753 12.967 154.961 10.8314C155.856 9.2494 157.684 7.57359 159.504 6.66686C161.911 5.46812 163.396 5.15574 166.657 5.16191C170.679 5.16979 172.656 5.75549 175.905 7.90251C176.748 8.46005 177.478 8.91621 177.525 8.91621C177.573 8.91621 178.173 8.11204 178.858 7.12917C179.543 6.14628 180.183 5.2339 180.281 5.10163C180.648 4.604 176.101 1.85026 173.496 0.992867C171.103 0.205449 169.897 0.0376173 166.657 0.0414768C163.41 0.0452437 162.253 0.220983 159.502 1.128C155.42 2.4739 151.891 5.468 150.118 9.09115C148.176 13.057 148.178 18.7218 150.121 22.6698ZM107.224 31.1657C107.224 31.0357 109.65 26.5035 118.419 10.2532L123.51 0.816564L126.142 0.767869L128.773 0.719185L132.552 7.73108C134.63 11.5876 138.33 18.4275 140.773 22.9307C143.217 27.434 145.216 31.1549 145.216 31.1994C145.216 31.244 143.86 31.2794 142.203 31.2781L139.191 31.2758L137.267 27.6881L135.343 24.1004L126.032 24.102L116.722 24.1035L114.852 27.6411L112.981 31.1786L110.103 31.2355C108.52 31.2668 107.224 31.235 107.224 31.1657ZM131.731 17.0742C131.168 16.0306 129.683 13.2577 128.431 10.9124C127.178 8.56705 126.085 6.72076 126.001 6.80951C125.848 6.97152 120.926 16.0919 119.979 17.9694L119.473 18.9718H126.113H132.754L131.731 17.0742ZM77.4284 0.720502V16V31.2795H79.9779H82.5273V25.7635V20.2476L90.9405 20.163C100.154 20.0703 100.626 20.0134 102.407 18.7816C103.509 18.0198 105.036 16.3553 105.533 15.3742C107.483 11.5273 106.689 6.1445 103.746 3.2628C103.237 2.76471 102.138 2.01703 101.302 1.60128C100.467 1.18552 99.4318 0.845361 98.1687 0.845361C96.9056 0.845361 88.606 0.782932 88.606 0.782932L77.4284 0.720502ZM99.4948 14.3848C99.0945 14.5529 97.9353 14.7785 96.9188 14.8862C95.9023 14.9938 92.2484 15.083 88.799 15.0853L82.5273 15.0892V10.4779V5.86671L89.3089 5.87058C93.0387 5.87282 96.723 5.96653 97.4962 6.07883C100.083 6.4546 101.24 7.52937 101.439 9.74402C101.667 12.2662 101.053 13.7304 99.4948 14.3848Z"
                fill="currentColor"
              />
            </motion.svg>
            {showPinButton && isOpen && (
              <button
                type="button"
                onClick={togglePinned}
                aria-label={pinned ? "Recolher menu" : "Expandir menu"}
                className="absolute right-3 top-4 flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity hover:bg-[#13131680] hover:opacity-100 group-hover:opacity-70"
              >
                {pinned ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </button>
            )}
          </div>
          <nav className="flex flex-1 flex-col gap-1 py-4">
            {isAdmin ? (
              <>
                {ADMIN_NAV_ITEMS.map(renderLink)}
                <motion.p
                  animate={{ opacity: isOpen ? 1 : 0 }}
                  transition={transition}
                  className="mt-4 whitespace-nowrap px-6 pb-1 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/40"
                >
                  Pessoal
                </motion.p>
                {PERSONAL_NAV_ITEMS.map(renderLink)}
              </>
            ) : (
              PERSONAL_NAV_ITEMS.map(renderLink)
            )}
          </nav>
          <div className="flex flex-col gap-3 border-t border-sidebar-border px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initials}
              </span>
              <motion.span
                animate={{ opacity: isOpen ? 1 : 0 }}
                transition={transition}
                style={{ pointerEvents: isOpen ? "auto" : "none" }}
                className="whitespace-nowrap text-sm font-medium"
              >
                {fullName}
              </motion.span>
            </div>
            <motion.div
              animate={{ opacity: isOpen ? 1 : 0 }}
              transition={transition}
              style={{ pointerEvents: isOpen ? "auto" : "none" }}
            >
              <SignOutButton />
            </motion.div>
          </div>
        </div>
      </motion.aside>
    </div>
  );
}
```

Key changes from the current file:
- Root element is now a `sticky top-0 h-screen w-16 shrink-0` slot (never animates) containing an `absolute inset-y-0 left-0` `motion.aside` that animates `width` between `SIDEBAR_COLLAPSED_WIDTH` and `SIDEBAR_EXPANDED_WIDTH`. The inner content (`<div className="flex h-full w-[248px] flex-col">`) is always rendered at the full expanded width and gets clipped by the panel's `overflow-hidden` — this is what makes labels not reflow/wrap mid-transition.
- `z-20` on the panel so it reliably layers above `main`'s content when expanded (no reliance on DOM-order stacking, in case a page under `main` sets its own `z-index`).
- Box-shadow is toggled via a conditional Tailwind class (`isOpen && "shadow-[16px_0_40px_rgba(0,0,0,0.35)]"`) with `transition-shadow duration-200`, not animated through framer-motion's `animate` prop — string-valued CSS properties like `box-shadow` don't interpolate reliably through framer-motion's animate API, so a plain CSS transition on a toggled class is the more robust choice.
- Logo header and nav items both use `px-6` (24px) now, replacing the mismatched `px-3` header / `px-3` items from before — this is what keeps the glyph and the nav icons in the same column in both states, without any position-shifting logic. The `<nav>` element itself no longer carries its own horizontal padding (each `<Link>` supplies its own `px-6`), and the "Pessoal" label matches at `px-6` too.
- The lettering SVG (`viewBox="77 0 189 32"`) switched from `AnimatePresence`-mounted (`{open && (...)}`) to always-mounted with an animated `opacity` — needed because it's now inside the always-248px inner content wrapper; unmounting/remounting it doesn't affect layout either way, but keeping it mounted avoids an extra mount/unmount transition edge case when hovering rapidly in and out. `pointerEvents: "none"` keeps it inert while invisible.
- Nav items: `px-6 py-1.5 text-sm`, `opacity-70` base, `hover:bg-[#13131680] hover:opacity-100`, active `bg-[#131316] font-medium opacity-100`, and a `w-[2px]` indicator bar shown only when `active && !isOpen`.
- Pin button: `PanelLeftClose`/`PanelLeftOpen` from `lucide-react`, only rendered when `showPinButton && isOpen`, `opacity-0` by default, `group-hover:opacity-70` (the panel carries the `group` class), `hover:opacity-100` on the button itself.
- `open` renamed to `isOpen` throughout (now comes from the hook, not local `useState`).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual verification with the dev server**

Run: `npm run dev`, then in a desktop-width browser window check every row below. This is the acceptance checklist from `docs/superpowers/specs/2026-07-17-sidebar-overlay-pin-design.md`'s "Teste" section:

- [ ] Hover over the collapsed sidebar on `/` or `/admin`: it expands to 248px as an overlay with a drop shadow, and the page content underneath does **not** shift or resize (open DevTools, watch the `main` element's computed width while hovering — it must stay constant).
- [ ] On `/admin`, hover repeatedly over the sidebar while watching the spend chart / breakdown charts: no visible jitter or console errors.
- [ ] Resize the browser window above `1367px` wide, click the pin button (only visible on hover once the panel is open): the sidebar stays expanded after moving the mouse away. Reload the page: it's still pinned expanded.
- [ ] With the window still `> 1367px` and pinned, click the pin button again: it collapses back to 64px and stays collapsed on mouse-out.
- [ ] Resize the window to between `1024px` and `1367px`: even with the pin still `true` in `localStorage` (check via DevTools Application tab), the sidebar rests collapsed; hovering still expands it temporarily; the pin button does not appear.
- [ ] Resize below `1024px`: the desktop sidebar disappears entirely and the mobile header bar appears, unchanged from before this change.
- [ ] The Paggo glyph and the nav item icons line up in the same vertical column both collapsed and expanded.
- [ ] Click "Sair" with the sidebar expanded: still signs out and redirects to `/login`.
- [ ] The active nav item (e.g. "Nova viagem" on `/`) shows the `w-[2px]` indicator bar only while collapsed, and the highlighted background while expanded.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/desktop-sidebar.tsx
git commit -m "feat: overlay sidebar with pin persistence and spec-exact nav styling"
```
