export interface SpringScalar {
  value: number;
  velocity: number;
  target: number;
}

export function createSpringScalar(value: number): SpringScalar {
  return { value, velocity: 0, target: value };
}

// Advances one scalar by dt (seconds; callers must pre-clamp to <=0.032 per
// the handoff spec so slow/tab-switched frames don't overshoot). Mutates `s`
// in place and returns whether it has settled on its target.
export function stepSpring(
  s: SpringScalar,
  dt: number,
  stiffness = 520,
  damping = 38,
  mass = 1
): boolean {
  const force = -stiffness * (s.value - s.target);
  const dampingForce = -damping * s.velocity;
  s.velocity += ((force + dampingForce) / mass) * dt;
  s.value += s.velocity * dt;
  return Math.abs(s.velocity) < 0.02 && Math.abs(s.value - s.target) < 0.02;
}
