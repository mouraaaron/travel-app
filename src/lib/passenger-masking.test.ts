import { describe, expect, it } from "vitest";
import { maskEmail, maskGivenName, maskPhone } from "./passenger-masking";

describe("maskGivenName", () => {
  it("keeps the given name and abbreviates the family name to its initial", () => {
    expect(maskGivenName("Aaron", "Moura")).toBe("Aaron M.");
  });
});

describe("maskEmail", () => {
  it("keeps the first two characters of the local part and masks the rest", () => {
    expect(maskEmail("aaron@paggo.com")).toBe("aa***@paggo.com");
  });

  it("returns the input unchanged if there's no @", () => {
    expect(maskEmail("not-an-email")).toBe("not-an-email");
  });
});

describe("maskPhone", () => {
  it("shows only the last 4 digits", () => {
    expect(maskPhone("+5541999998888")).toBe("**** 8888");
  });
});
