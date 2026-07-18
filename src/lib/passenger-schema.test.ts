import { describe, expect, it } from "vitest";
import {
  buildEmptyDuffelPassenger,
  duffelPassengerSchema,
  duffelPassengersSchema,
  toE164,
} from "./passenger-schema";

const VALID_DUFFEL_PASSENGER = {
  id: "pas-1",
  type: "adult" as const,
  title: "mr" as const,
  given_name: "Aaron",
  family_name: "Moura",
  born_on: "1998-03-14",
  gender: "m" as const,
  email: "aaron@paggo.com",
  phoneCountry: "55",
  phoneLocalNumber: "41999998888",
  passportRequired: false,
};

describe("duffelPassengerSchema", () => {
  it("accepts a valid domestic adult passenger with no passport block", () => {
    expect(duffelPassengerSchema.safeParse(VALID_DUFFEL_PASSENGER).success).toBe(true);
  });

  it("rejects a given_name with accented characters", () => {
    const result = duffelPassengerSchema.safeParse({ ...VALID_DUFFEL_PASSENGER, given_name: "João" });
    expect(result.success).toBe(false);
  });

  it("rejects a family_name longer than 20 characters", () => {
    const result = duffelPassengerSchema.safeParse({
      ...VALID_DUFFEL_PASSENGER,
      family_name: "A".repeat(21),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a phone local number with letters", () => {
    const result = duffelPassengerSchema.safeParse({ ...VALID_DUFFEL_PASSENGER, phoneLocalNumber: "abc123" });
    expect(result.success).toBe(false);
  });

  it("rejects a phone local number shorter than 8 digits", () => {
    const result = duffelPassengerSchema.safeParse({ ...VALID_DUFFEL_PASSENGER, phoneLocalNumber: "1234567" });
    expect(result.success).toBe(false);
  });

  it("requires passport fields when passportRequired is true", () => {
    const result = duffelPassengerSchema.safeParse({ ...VALID_DUFFEL_PASSENGER, passportRequired: true });
    expect(result.success).toBe(false);
  });

  it("accepts a full passport block when required", () => {
    const result = duffelPassengerSchema.safeParse({
      ...VALID_DUFFEL_PASSENGER,
      passportRequired: true,
      passportNumber: "FZ123456",
      passportIssuingCountry: "BR",
      passportExpiresOn: "2032-11-30",
    });
    expect(result.success).toBe(true);
  });
});

describe("duffelPassengersSchema — infant responsibility", () => {
  const adult = VALID_DUFFEL_PASSENGER;
  const infant = {
    ...VALID_DUFFEL_PASSENGER,
    id: "pas-2",
    type: "infant_without_seat" as const,
    born_on: "2025-01-01",
  };

  it("requires every infant to have exactly one responsible adult", () => {
    const result = duffelPassengersSchema.safeParse({ passengers: [adult, infant] });
    expect(result.success).toBe(false);
  });

  it("accepts when an adult is marked responsible for the infant", () => {
    const result = duffelPassengersSchema.safeParse({
      passengers: [{ ...adult, infantResponsibleFor: "pas-2" }, infant],
    });
    expect(result.success).toBe(true);
  });

  it("rejects when two adults claim responsibility for the same infant", () => {
    const secondAdult = { ...adult, id: "pas-3", infantResponsibleFor: "pas-2" };
    const result = duffelPassengersSchema.safeParse({
      passengers: [{ ...adult, infantResponsibleFor: "pas-2" }, secondAdult, infant],
    });
    expect(result.success).toBe(false);
  });

  it("rejects when an adult claims responsibility for a non-existent passenger id", () => {
    // The real infant (pas-2) is validly claimed by a separate adult, isolating the
    // dangling-id check from the "every infant must be claimed" check.
    const result = duffelPassengersSchema.safeParse({
      passengers: [
        { ...adult, id: "pas-1", infantResponsibleFor: "pas-2" },
        { ...adult, id: "pas-3", infantResponsibleFor: "pas-99" },
        infant,
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects when an infant passenger itself sets infantResponsibleFor", () => {
    const result = duffelPassengersSchema.safeParse({
      passengers: [adult, { ...infant, infantResponsibleFor: "pas-2" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("toE164", () => {
  it("concatenates dial code and local number with a leading +", () => {
    expect(toE164("55", "41999998888")).toBe("+5541999998888");
  });
});

describe("buildEmptyDuffelPassenger", () => {
  it("returns a blank adult passenger with the given id", () => {
    expect(buildEmptyDuffelPassenger("adult", "pas-1")).toEqual({
      id: "pas-1",
      type: "adult",
      title: "mr",
      given_name: "",
      family_name: "",
      born_on: "",
      gender: "m",
      email: "",
      phoneCountry: "55",
      phoneLocalNumber: "",
      passportRequired: false,
      passportNumber: "",
      passportIssuingCountry: "",
      passportExpiresOn: "",
      infantResponsibleFor: undefined,
    });
  });
});
