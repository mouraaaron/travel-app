import type { FlightOffer, Offer, StayOffer } from "./types";

export interface FlightSearchParams {
  mode: "flight";
  origin: string;
  destination: string;
}

export interface StaySearchParams {
  mode: "stay";
  city: string;
}

export type SearchParams = FlightSearchParams | StaySearchParams;

function includesLoose(value: string, query: string): boolean {
  return value.trim().toLowerCase().includes(query.trim().toLowerCase());
}

export function searchOffers(params: SearchParams, offers: Offer[]): Offer[] {
  const candidates = offers.filter((offer) => offer.mode === params.mode);

  if (params.mode === "flight") {
    const filtered = (candidates as FlightOffer[]).filter(
      (offer) =>
        includesLoose(offer.origin, params.origin) &&
        includesLoose(offer.destination, params.destination)
    );
    return filtered.length > 0 ? filtered : candidates;
  }

  const filtered = (candidates as StayOffer[]).filter((offer) =>
    includesLoose(offer.city, params.city)
  );
  return filtered.length > 0 ? filtered : candidates;
}
