import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockMaybeSingle = vi.fn();
const mockUpsert = vi.fn();

vi.mock("../supabase/server", () => ({
  createSupabaseServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
      upsert: mockUpsert,
    }),
  }),
}));

import { getRateToBRL } from "./exchange-rate";

describe("getRateToBRL", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockMaybeSingle.mockReset();
    mockUpsert.mockReset();
    mockUpsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns 1 for BRL without touching the database", async () => {
    const rate = await getRateToBRL("BRL");

    expect(rate).toBe(1);
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it("returns the cached rate when it was fetched today", async () => {
    const today = new Date().toISOString();
    mockMaybeSingle.mockResolvedValueOnce({ data: { rate_to_brl: 5.2, fetched_at: today } });

    const rate = await getRateToBRL("USD");

    expect(rate).toBe(5.2);
  });

  it("fetches a live rate and caches it when there is no fresh cache", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ USDBRL: { bid: "5.55" } }),
    }) as unknown as typeof fetch;

    const rate = await getRateToBRL("USD");

    expect(rate).toBe(5.55);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ currency: "USD", rate_to_brl: 5.55 })
    );
  });

  it("falls back to a stale cached rate when the live API fails", async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    mockMaybeSingle.mockResolvedValueOnce({ data: { rate_to_brl: 5.1, fetched_at: twoDaysAgo } });
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    const rate = await getRateToBRL("USD");

    expect(rate).toBe(5.1);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("falls back to the hardcoded safety-net rate when there is no cache and the API fails", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null });
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const rate = await getRateToBRL("EUR");

    expect(rate).toBe(5.4);
  });
});
