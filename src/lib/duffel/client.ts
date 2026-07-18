import type { AirportOption } from "../airports";
import type { FlightOffer, SearchCriteria } from "../types";
import { getRateToBRL } from "../currency/exchange-rate";
import { mapDuffelOfferToFlightOffer } from "./map-offer";
import { mapDuffelPlaceSuggestionsToAirportOptions } from "./map-place";
import type { DuffelErrorResponse, DuffelOfferRequestResponse, DuffelPlacesResponse } from "./types";

const DUFFEL_API_BASE = "https://api.duffel.com";
const PLACES_FETCH_TIMEOUT_MS = 2500;

export class DuffelSearchError extends Error {}

export async function searchFlights(criteria: SearchCriteria): Promise<FlightOffer[]> {
  const apiKey = process.env.DUFFEL_API_KEY;
  if (!apiKey) {
    throw new DuffelSearchError("DUFFEL_API_KEY não configurada no servidor.");
  }

  const response = await fetch(`${DUFFEL_API_BASE}/air/offer_requests?return_offers=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Duffel-Version": "v2",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      data: {
        slices: criteria.slices,
        passengers: criteria.passengers,
        cabin_class: criteria.cabin_class,
        ...(criteria.max_connections !== undefined
          ? { max_connections: criteria.max_connections }
          : {}),
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as DuffelErrorResponse | null;
    const message = body?.errors?.[0]?.message ?? `Duffel respondeu ${response.status}.`;
    throw new DuffelSearchError(message);
  }

  const json = (await response.json().catch(() => null)) as DuffelOfferRequestResponse | null;
  if (!json?.data?.offers) {
    throw new DuffelSearchError("Resposta inválida da Duffel.");
  }

  const currencies = Array.from(new Set(json.data.offers.map((offer) => offer.total_currency)));
  const rates = new Map<string, number>();
  for (const currency of currencies) {
    rates.set(currency, await getRateToBRL(currency));
  }

  return json.data.offers.map((offer) =>
    mapDuffelOfferToFlightOffer(offer, criteria, rates.get(offer.total_currency) ?? 1)
  );
}

export async function suggestPlaces(query: string): Promise<AirportOption[] | null> {
  const apiKey = process.env.DUFFEL_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PLACES_FETCH_TIMEOUT_MS);

    const response = await fetch(
      `${DUFFEL_API_BASE}/places/suggestions?query=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Duffel-Version": "v2",
          Accept: "application/json",
        },
        signal: controller.signal,
        cache: "no-store",
      }
    );
    clearTimeout(timeout);

    if (!response.ok) return null;

    const json = (await response.json()) as DuffelPlacesResponse;
    return mapDuffelPlaceSuggestionsToAirportOptions(json.data);
  } catch {
    return null;
  }
}
