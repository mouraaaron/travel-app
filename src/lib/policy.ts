import type { FlightOffer } from "./types";

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
