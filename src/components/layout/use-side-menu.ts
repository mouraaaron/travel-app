"use client";

import { useCallback, useEffect, useState } from "react";
import { deriveSideMenuState, resolveSideMenuTier, type SideMenuTier } from "@/lib/side-menu-state";
import { SIDEBAR_PIN_STORAGE_KEY } from "./sidebar-constants";

export interface UseSideMenuResult {
  isOpen: boolean;
  pinned: boolean;
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

  return { isOpen, pinned, showPinButton: isPinnable, setHovering, togglePinned };
}
