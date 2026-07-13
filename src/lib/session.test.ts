import { describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockSingle = vi.fn();

vi.mock("./supabase/server", () => ({
  createSupabaseServerClient: () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }),
  }),
}));

import { getCurrentProfile } from "./session";

describe("getCurrentProfile", () => {
  it("returns null when there is no authenticated user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getCurrentProfile();
    expect(result).toBeNull();
  });

  it("returns null when the user has no profile row", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockSingle.mockResolvedValueOnce({ data: null });
    const result = await getCurrentProfile();
    expect(result).toBeNull();
  });

  it("returns null when the profile is inactive", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockSingle.mockResolvedValueOnce({
      data: {
        id: "u1",
        organization_id: "org1",
        role: "employee",
        full_name: "Funcionário Demo",
        status: "inactive",
      },
    });
    const result = await getCurrentProfile();
    expect(result).toBeNull();
  });

  it("maps an active profile row into CurrentProfile", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockSingle.mockResolvedValueOnce({
      data: {
        id: "u1",
        organization_id: "org1",
        role: "admin",
        full_name: "Admin Demo",
        status: "active",
      },
    });
    const result = await getCurrentProfile();
    expect(result).toEqual({
      id: "u1",
      organizationId: "org1",
      role: "admin",
      fullName: "Admin Demo",
    });
  });
});
