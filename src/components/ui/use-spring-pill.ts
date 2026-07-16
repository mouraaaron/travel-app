"use client";

import * as React from "react";
import { createSpringScalar, stepSpring, type SpringScalar } from "@/lib/spring";

export type SpringPillOrientation = "horizontal" | "vertical";

interface PillSprings {
  main: SpringScalar; // left (horizontal) / top (vertical)
  mainSize: SpringScalar; // width (horizontal) / height (vertical)
  crossSize: SpringScalar; // height (horizontal) / width (vertical)
}

interface UseSpringPillResult {
  pillRef: React.MutableRefObject<HTMLElement | null>;
  /**
   * Call on mount (once the active element is measurable, `snap: true`), on
   * every selection change (`snap: false`), and from a resize observer
   * (`snap: false`, so a resize mid-flight doesn't kill velocity). Pass
   * `null` when nothing is selected (hides the pill).
   */
  sync: (activeEl: HTMLElement | null, snap: boolean) => void;
}

export function useSpringPill(
  orientation: SpringPillOrientation = "horizontal"
): UseSpringPillResult {
  const pillRef = React.useRef<HTMLElement | null>(null);
  const springsRef = React.useRef<PillSprings | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const lastTRef = React.useRef<number | null>(null);

  const applyStyle = React.useCallback(() => {
    const pill = pillRef.current;
    const springs = springsRef.current;
    if (!pill || !springs) return;
    if (orientation === "horizontal") {
      pill.style.left = `${springs.main.value}px`;
      pill.style.width = `${springs.mainSize.value}px`;
      pill.style.height = `${springs.crossSize.value}px`;
    } else {
      pill.style.top = `${springs.main.value}px`;
      pill.style.height = `${springs.mainSize.value}px`;
      pill.style.width = `${springs.crossSize.value}px`;
    }
  }, [orientation]);

  const ensureLoop = React.useCallback(() => {
    if (rafRef.current !== null) return;
    lastTRef.current = performance.now();
    const step = (t: number) => {
      const springs = springsRef.current;
      if (!springs) {
        rafRef.current = null;
        return;
      }
      const dt = Math.min((t - (lastTRef.current ?? t)) / 1000, 0.032);
      lastTRef.current = t;
      const settledMain = stepSpring(springs.main, dt);
      const settledMainSize = stepSpring(springs.mainSize, dt);
      const settledCrossSize = stepSpring(springs.crossSize, dt);
      applyStyle();
      if (settledMain && settledMainSize && settledCrossSize) {
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [applyStyle]);

  const sync = React.useCallback(
    (activeEl: HTMLElement | null, snap: boolean) => {
      const pill = pillRef.current;
      if (!pill) return;
      if (!activeEl) {
        pill.style.opacity = "0";
        return;
      }

      const main = orientation === "horizontal" ? activeEl.offsetLeft : activeEl.offsetTop;
      const mainSize =
        orientation === "horizontal" ? activeEl.offsetWidth : activeEl.offsetHeight;
      const crossSize =
        orientation === "horizontal" ? activeEl.offsetHeight : activeEl.offsetWidth;

      if (!springsRef.current) {
        springsRef.current = {
          main: createSpringScalar(main),
          mainSize: createSpringScalar(mainSize),
          crossSize: createSpringScalar(crossSize),
        };
      }
      const springs = springsRef.current;
      springs.main.target = main;
      springs.mainSize.target = mainSize;
      springs.crossSize.target = crossSize;

      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (snap || prefersReducedMotion) {
        springs.main.value = main;
        springs.main.velocity = 0;
        springs.mainSize.value = mainSize;
        springs.mainSize.velocity = 0;
        springs.crossSize.value = crossSize;
        springs.crossSize.velocity = 0;
        applyStyle();
        pill.style.opacity = "1";
        return;
      }

      pill.style.opacity = "1";
      ensureLoop();
    },
    [orientation, applyStyle, ensureLoop]
  );

  React.useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { pillRef, sync };
}
