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
