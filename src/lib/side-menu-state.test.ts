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
