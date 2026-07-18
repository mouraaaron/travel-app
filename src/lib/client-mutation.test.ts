import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { mutateWithToast } from "./client-mutation";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("mutateWithToast", () => {
  it("passes url and init through to fetch", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const init = { method: "PATCH", body: JSON.stringify({ role: "admin" }) };

    await mutateWithToast("/api/admin/employees/1/role", init, { error: "Falhou." });

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/employees/1/role", init);
  });

  it("shows the success toast and returns ok with the parsed body", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ request: { id: "req-1" } }));

    const result = await mutateWithToast("/api/x", { method: "POST" }, {
      success: "Função atualizada.",
      error: "Não foi possível alterar a função.",
    });

    expect(result).toEqual({ ok: true, body: { request: { id: "req-1" } } });
    expect(toast.success).toHaveBeenCalledWith("Função atualizada.");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("does not show a success toast when no success message is provided", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    const result = await mutateWithToast("/api/x", { method: "POST" }, { error: "Falhou." });

    expect(result.ok).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("prefers the server-provided error message on a failed response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Apenas administradores." }, 403));

    const result = await mutateWithToast("/api/x", { method: "POST" }, { error: "Falhou." });

    expect(result.ok).toBe(false);
    expect(result.body).toEqual({ error: "Apenas administradores." });
    expect(toast.error).toHaveBeenCalledWith("Apenas administradores.");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("falls back to the caller's error message when the failed body is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));

    const result = await mutateWithToast("/api/x", { method: "POST" }, { error: "Falhou." });

    expect(result).toEqual({ ok: false, body: null });
    expect(toast.error).toHaveBeenCalledWith("Falhou.");
  });

  it("shows the caller's error message and never throws on network failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await mutateWithToast("/api/x", { method: "POST" }, {
      success: "Nunca deve aparecer.",
      error: "Não foi possível cancelar a solicitação.",
    });

    expect(result).toEqual({ ok: false, body: null });
    expect(toast.error).toHaveBeenCalledWith("Não foi possível cancelar a solicitação.");
    expect(toast.success).not.toHaveBeenCalled();
  });
});
