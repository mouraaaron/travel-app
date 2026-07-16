import { describe, expect, it } from "vitest";
import { createSpringScalar, stepSpring } from "./spring";

describe("stepSpring", () => {
  it("converges to the target and reports settled", () => {
    const scalar = createSpringScalar(0);
    scalar.target = 100;

    let settled = false;
    for (let i = 0; i < 500 && !settled; i++) {
      settled = stepSpring(scalar, 1 / 60);
    }

    expect(settled).toBe(true);
    expect(scalar.value).toBeCloseTo(100, 0);
  });

  it("preserves velocity when the target changes mid-flight instead of resetting it", () => {
    const scalar = createSpringScalar(0);
    scalar.target = 100;
    for (let i = 0; i < 5; i++) stepSpring(scalar, 1 / 60);

    const velocityBeforeRetarget = scalar.velocity;
    expect(velocityBeforeRetarget).not.toBe(0);

    // Simulate a new click landing before the pill finishes animating to the
    // previous target — this must not zero the velocity.
    scalar.target = 250;

    expect(scalar.velocity).toBe(velocityBeforeRetarget);
  });

  it("settles immediately when created already at its target", () => {
    const scalar = createSpringScalar(50);
    const settled = stepSpring(scalar, 1 / 60);

    expect(settled).toBe(true);
    expect(scalar.value).toBe(50);
    expect(scalar.velocity).toBe(0);
  });
});
