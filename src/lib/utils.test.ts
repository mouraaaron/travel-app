import { describe, expect, it } from "vitest";
import { initialsFromName } from "./utils";

describe("initialsFromName", () => {
  it("returns first+last initials for a full name", () => {
    expect(initialsFromName("Marina Castro")).toBe("MC");
  });

  it("returns a single initial when there's only one name", () => {
    expect(initialsFromName("Marina")).toBe("M");
  });

  it("uses only the first and the last part for names with a middle name", () => {
    expect(initialsFromName("Marina Souza Castro")).toBe("MC");
  });
});
