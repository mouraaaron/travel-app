import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireApiAdmin, requireApiUser } from "./api-auth";

const mocks = vi.hoisted(() => {
  const getUser = vi.fn();
  const single = vi.fn();
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { getUser, single, eq, select, from };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  }),
}));

const USER = { id: "user-1", email: "ana@demo-paggo.com" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireApiUser", () => {
  it("returns a 401 response with the standard message when unauthenticated", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const auth = await requireApiUser();

    expect(auth.user).toBeNull();
    expect(auth.response).not.toBeNull();
    expect(auth.response?.status).toBe(401);
    await expect(auth.response?.json()).resolves.toEqual({ error: "Não autenticado." });
  });

  it("returns the user and no response when authenticated", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: USER } });

    const auth = await requireApiUser();

    expect(auth.response).toBeNull();
    expect(auth.user).toEqual(USER);
    expect(auth.supabase).toBeDefined();
  });
});

describe("requireApiAdmin", () => {
  it("returns 401 without querying the profile when unauthenticated", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const auth = await requireApiAdmin("Apenas administradores.");

    expect(auth.response?.status).toBe(401);
    expect(auth.adminProfile).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns 403 with the caller's message when the profile is missing", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: USER } });
    mocks.single.mockResolvedValue({ data: null });

    const auth = await requireApiAdmin("Apenas administradores podem aprovar solicitações.");

    expect(auth.response?.status).toBe(403);
    await expect(auth.response?.json()).resolves.toEqual({
      error: "Apenas administradores podem aprovar solicitações.",
    });
    expect(auth.adminProfile).toBeNull();
  });

  it("returns 403 when the profile role is not admin", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: USER } });
    mocks.single.mockResolvedValue({ data: { role: "employee" } });

    const auth = await requireApiAdmin("Apenas administradores.");

    expect(auth.response?.status).toBe(403);
    expect(auth.adminProfile).toBeNull();
  });

  it("returns the admin profile, user and supabase client for an admin", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: USER } });
    mocks.single.mockResolvedValue({ data: { role: "admin", organization_id: "org-1" } });

    const auth = await requireApiAdmin("Apenas administradores.", "role, organization_id");

    expect(auth.response).toBeNull();
    expect(auth.user).toEqual(USER);
    expect(auth.adminProfile).toEqual({ role: "admin", organization_id: "org-1" });
  });

  it("queries the profiles table with the requested columns and the user id", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: USER } });
    mocks.single.mockResolvedValue({ data: { role: "admin", organization_id: "org-1" } });

    await requireApiAdmin("Apenas administradores.", "role, organization_id");

    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(mocks.select).toHaveBeenCalledWith("role, organization_id");
    expect(mocks.eq).toHaveBeenCalledWith("id", USER.id);
  });

  it("defaults the profile select to role only", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: USER } });
    mocks.single.mockResolvedValue({ data: { role: "admin" } });

    await requireApiAdmin("Apenas administradores.");

    expect(mocks.select).toHaveBeenCalledWith("role");
  });
});
