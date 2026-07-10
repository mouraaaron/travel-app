import type { FlightOffer, SearchCriteria } from "../types";
import { mapDuffelOfferToFlightOffer } from "./map-offer";
import type { DuffelErrorResponse, DuffelOfferRequestResponse } from "./types";

const DUFFEL_API_BASE = "https://api.duffel.com";

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

  const json = (await response.json()) as DuffelOfferRequestResponse;
  return json.data.offers.map((offer) => mapDuffelOfferToFlightOffer(offer, criteria));
}
