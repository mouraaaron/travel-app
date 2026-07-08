import { describe, expect, it } from "vitest";
import { buildEmptyPassenger, passengersSchema } from "./passenger-schema";

const VALID_PASSENGER = {
  firstName: "Ana",
  lastName: "Souza",
  dateOfBirth: "1990-05-10",
  gender: "f" as const,
  email: "ana@example.com",
  phone: "+55 11 91234-5678",
};

describe("passengersSchema", () => {
  it("accepts a list with one valid passenger", () => {
    const result = passengersSchema.safeParse({ passengers: [VALID_PASSENGER] });
    expect(result.success).toBe(true);
  });

  it("accepts multiple valid passengers", () => {
    const result = passengersSchema.safeParse({
      passengers: [VALID_PASSENGER, { ...VALID_PASSENGER, firstName: "Bruno", gender: "m" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty passenger list", () => {
    const result = passengersSchema.safeParse({ passengers: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = passengersSchema.safeParse({
      passengers: [{ ...VALID_PASSENGER, email: "not-an-email" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing first name", () => {
    const result = passengersSchema.safeParse({
      passengers: [{ ...VALID_PASSENGER, firstName: "" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("buildEmptyPassenger", () => {
  it("returns a passenger shape with all fields blank and gender defaulted to f", () => {
    expect(buildEmptyPassenger()).toEqual({
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "f",
      email: "",
      phone: "",
    });
  });
});
