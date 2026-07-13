import { describe, expect, it } from "vitest";
import { corporateContextSchema } from "./corporate-schema";

const valid = {
  trip_purpose: "conference" as const,
  project_code: "",
  business_justification: "Conferência anual do setor de pagamentos.",
  isOutOfPolicy: false,
  out_of_policy_justification: "",
};

describe("corporateContextSchema", () => {
  it("accepts a valid compliant submission with no out-of-policy justification", () => {
    expect(corporateContextSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a business_justification shorter than 20 characters", () => {
    const result = corporateContextSchema.safeParse({ ...valid, business_justification: "Muito curto" });
    expect(result.success).toBe(false);
  });

  it("requires an out_of_policy_justification of at least 50 characters when isOutOfPolicy is true", () => {
    const result = corporateContextSchema.safeParse({
      ...valid,
      isOutOfPolicy: true,
      out_of_policy_justification: "Muito curto",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a 50+ character out_of_policy_justification when isOutOfPolicy is true", () => {
    const result = corporateContextSchema.safeParse({
      ...valid,
      isOutOfPolicy: true,
      out_of_policy_justification:
        "Preciso deste voo específico porque é o único com conexão compatível com a agenda do cliente.",
    });
    expect(result.success).toBe(true);
  });
});
