import { describe, expect, it } from "vitest";
import { INITIAL_TRIP_FLOW_STATE, tripFlowReducer } from "./trip-flow-reducer";
import type { FlightOffer, SearchCriteria } from "./types";

const criteria: SearchCriteria = {
  slices: [{ origin: "GRU", destination: "GIG", departure_date: "2026-08-10" }],
  passengers: [{ type: "adult" }],
  cabin_class: "economy",
};

const offer: FlightOffer = {
  id: "off-1",
  mode: "flight",
  origin: "GRU",
  destination: "GIG",
  destinationCountry: "BR",
  departureAt: "2026-08-10T10:00:00.000Z",
  cabinClass: "economy",
  airline: "Azul",
  stops: 0,
  refundable: false,
  totalAmount: 500,
  currency: "BRL",
};

describe("tripFlowReducer", () => {
  it("sets criteria and clears any prior offers/selection", () => {
    const seeded = { ...INITIAL_TRIP_FLOW_STATE, offers: [offer], selectedOfferId: "off-1" };
    const next = tripFlowReducer(seeded, { type: "SET_CRITERIA", payload: criteria });
    expect(next.criteria).toEqual(criteria);
    expect(next.offers).toEqual([]);
    expect(next.selectedOfferId).toBeNull();
  });

  it("toggles loadingOffers on START_LOADING_OFFERS and clears it on SET_OFFERS", () => {
    const loading = tripFlowReducer(INITIAL_TRIP_FLOW_STATE, { type: "START_LOADING_OFFERS" });
    expect(loading.loadingOffers).toBe(true);

    const loaded = tripFlowReducer(loading, { type: "SET_OFFERS", payload: [offer] });
    expect(loaded.loadingOffers).toBe(false);
    expect(loaded.offers).toEqual([offer]);
  });

  it("stores the selected offer id", () => {
    const next = tripFlowReducer(INITIAL_TRIP_FLOW_STATE, { type: "SELECT_OFFER", payload: "off-1" });
    expect(next.selectedOfferId).toBe("off-1");
  });

  it("resets to the initial state", () => {
    const dirty = { ...INITIAL_TRIP_FLOW_STATE, criteria, selectedOfferId: "off-1" };
    expect(tripFlowReducer(dirty, { type: "RESET" })).toEqual(INITIAL_TRIP_FLOW_STATE);
  });
});
