import type { FlightOffer, Offer, Policy, PolicyEvaluation, PolicyFlag, PolicyRule } from "./types";

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

// --- Duffel-shaped policy evaluation (additive; evaluateOffer above is unchanged) ---

export interface DuffelPolicyDefaults {
  domesticCapBRL: number;
  internationalCapBRL: number;
  longHaulCabinHours: number;
  costFlagBRL: number;
}

export const DUFFEL_POLICY_DEFAULTS: DuffelPolicyDefaults = {
  domesticCapBRL: 3500,
  internationalCapBRL: 12000,
  longHaulCabinHours: 8,
  costFlagBRL: 8000,
};

export interface DuffelPolicyViolation {
  rule_id: string;
  message: string;
  field: string;
  expected: string;
  actual: string;
}

export interface DuffelPolicyFlags {
  international_travel: boolean;
  cost_above_threshold: boolean;
}

export interface DuffelPolicyEvaluation {
  compliant: boolean;
  violations: DuffelPolicyViolation[];
  flags: DuffelPolicyFlags;
}

export function evaluateDuffelOffer(
  offer: FlightOffer,
  defaults: DuffelPolicyDefaults = DUFFEL_POLICY_DEFAULTS
): DuffelPolicyEvaluation {
  const violations: DuffelPolicyViolation[] = [];
  const isInternational = offer.destinationCountry !== "BR";
  const cap = isInternational ? defaults.internationalCapBRL : defaults.domesticCapBRL;

  if (offer.totalAmount > cap) {
    violations.push({
      rule_id: "cost-cap",
      message: `Preço R$ ${offer.totalAmount.toFixed(2)} excede o teto de R$ ${cap.toFixed(2)} para voos ${
        isInternational ? "internacionais" : "domésticos"
      }.`,
      field: "totalAmount",
      expected: `<= ${cap}`,
      actual: String(offer.totalAmount),
    });
  }

  const isLongHaulCabin = offer.cabinClass === "business" || offer.cabinClass === "first";
  const longestSegmentHours = offer.longestSegmentHours ?? 0;
  if (isLongHaulCabin && longestSegmentHours < defaults.longHaulCabinHours) {
    violations.push({
      rule_id: "cabin-long-haul",
      message: `Classes executiva/primeira só são permitidas em trechos de ${defaults.longHaulCabinHours}h ou mais (este trecho tem ${longestSegmentHours.toFixed(
        1
      )}h).`,
      field: "cabinClass",
      expected: `duration >= ${defaults.longHaulCabinHours}h`,
      actual: `${longestSegmentHours.toFixed(1)}h`,
    });
  }

  return {
    compliant: violations.length === 0,
    violations,
    flags: {
      international_travel: isInternational,
      cost_above_threshold: offer.totalAmount > defaults.costFlagBRL,
    },
  };
}
