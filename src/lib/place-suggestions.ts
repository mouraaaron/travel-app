import { searchAirports, type AirportOption } from "./airports";

const cache = new Map<string, AirportOption[]>();

export function clearPlaceSuggestionsCache(): void {
  cache.clear();
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export async function resolvePlaceSuggestions(
  query: string,
  signal: AbortSignal
): Promise<AirportOption[]> {
  const key = normalizeQuery(query);
  if (key.length < 2) return [];

  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const response = await fetch(`/api/places/suggestions?query=${encodeURIComponent(query)}`, {
      signal,
    });

    if (!response.ok) return searchAirports(query);

    const json = (await response.json()) as { options: AirportOption[] };
    if (!Array.isArray(json.options) || json.options.length === 0) {
      return searchAirports(query);
    }

    cache.set(key, json.options);
    return json.options;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return searchAirports(query);
  }
}
