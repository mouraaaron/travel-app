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
