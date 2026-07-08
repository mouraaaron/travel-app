import type { Offer, Policy, PolicyEvaluation, PolicyFlag, PolicyRule } from "./types";

/**
 * Not itself a policy rule — a separate "big spend" signal shown to the
 * Travel Admin regardless of whether the offer otherwise complies. In a
 * real system this would likely be configurable per organization; hardcoded
 * here for the MVP demo.
 */
export const HIGH_COST_THRESHOLD = 5000;

function getFieldValue(offer: Offer, field: string): unknown {
  return (offer as unknown as Record<string, unknown>)[field];
}

function ruleApplies(rule: PolicyRule, offer: Offer): boolean {
  return rule.appliesTo === "both" || rule.appliesTo === offer.mode;
}

function ruleViolated(offer: Offer, rule: PolicyRule): boolean {
  const value = getFieldValue(offer, rule.field);

  switch (rule.operator) {
    case "lte":
      return (
        typeof value === "number" &&
        typeof rule.value === "number" &&
        value > rule.value
      );
    case "gte":
      return (
        typeof value === "number" &&
        typeof rule.value === "number" &&
        value < rule.value
      );
    case "eq":
      return value !== rule.value;
    case "in":
      return (
        Array.isArray(rule.value) &&
        typeof value === "string" &&
        !rule.value.includes(value)
      );
    case "not_in":
      return (
        Array.isArray(rule.value) &&
        typeof value === "string" &&
        rule.value.includes(value)
      );
    default:
      return false;
  }
}

function getDestinationCountry(offer: Offer): string {
  return offer.mode === "flight" ? offer.destinationCountry : offer.country;
}

export function evaluateOffer(offer: Offer, policy: Policy): PolicyEvaluation {
  const violations = policy.rules.filter(
    (rule) => ruleApplies(rule, offer) && ruleViolated(offer, rule)
  );

  const flags: PolicyFlag[] = [];
  if (offer.totalAmount > HIGH_COST_THRESHOLD) flags.push("cost_above_threshold");
  if (getDestinationCountry(offer) !== "BR") flags.push("international");

  return {
    compliant: violations.length === 0,
    violations,
    flags,
  };
}
