import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPlaceSuggestionsCache, resolvePlaceSuggestions } from "./place-suggestions";

describe("resolvePlaceSuggestions", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearPlaceSuggestionsCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns an empty array without calling fetch for queries shorter than 2 chars", async () => {
    global.fetch = vi.fn();

    const result = await resolvePlaceSuggestions("a", new AbortController().signal);

    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fetches and returns remote options on success", async () => {
    const remoteOptions = [
      { code: "AMS", label: "Amsterdam (AMS)", sublabel: "Schiphol", lat: 52.3, lng: 4.7 },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ options: remoteOptions }),
    }) as unknown as typeof fetch;

    const result = await resolvePlaceSuggestions("amsterdam", new AbortController().signal);

    expect(result).toEqual(remoteOptions);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("caches successful responses per normalized query", async () => {
    const remoteOptions = [
      { code: "AMS", label: "Amsterdam (AMS)", sublabel: "Schiphol", lat: 52.3, lng: 4.7 },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ options: remoteOptions }),
    }) as unknown as typeof fetch;

    await resolvePlaceSuggestions("Amsterdam", new AbortController().signal);
    await resolvePlaceSuggestions("  amsterdam  ", new AbortController().signal);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to local searchAirports when the response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    const result = await resolvePlaceSuggestions("brasilia", new AbortController().signal);

    expect(result.map((option) => option.code)).toEqual(["BSB"]);
  });

  it("falls back to local searchAirports when fetch throws a network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const result = await resolvePlaceSuggestions("brasilia", new AbortController().signal);

    expect(result.map((option) => option.code)).toEqual(["BSB"]);
  });

  it("re-throws AbortError so a superseded request does not overwrite newer state", async () => {
    const abortError = new DOMException("aborted", "AbortError");
    global.fetch = vi.fn().mockRejectedValue(abortError) as unknown as typeof fetch;

    await expect(
      resolvePlaceSuggestions("brasilia", new AbortController().signal)
    ).rejects.toBe(abortError);
  });
});
