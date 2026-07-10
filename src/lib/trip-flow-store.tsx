"use client";

import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { INITIAL_TRIP_FLOW_STATE, tripFlowReducer, type TripFlowState } from "./trip-flow-reducer";
import type { CorporateContext, DuffelPassenger, FlightOffer, SearchCriteria } from "./types";

interface TripFlowContextValue extends TripFlowState {
  selectedOffer: FlightOffer | null;
  setCriteria: (criteria: SearchCriteria) => void;
  startLoadingOffers: () => void;
  setOffers: (offers: FlightOffer[]) => void;
  selectOffer: (offerId: string) => void;
  setPassengers: (passengers: DuffelPassenger[]) => void;
  setCorporate: (corporate: CorporateContext) => void;
  reset: () => void;
}

const TripFlowContext = createContext<TripFlowContextValue | null>(null);

export function TripFlowProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tripFlowReducer, INITIAL_TRIP_FLOW_STATE);

  const value = useMemo<TripFlowContextValue>(() => {
    const selectedOffer = state.offers.find((offer) => offer.id === state.selectedOfferId) ?? null;
    return {
      ...state,
      selectedOffer,
      setCriteria: (criteria) => dispatch({ type: "SET_CRITERIA", payload: criteria }),
      startLoadingOffers: () => dispatch({ type: "START_LOADING_OFFERS" }),
      setOffers: (offers) => dispatch({ type: "SET_OFFERS", payload: offers }),
      selectOffer: (offerId) => dispatch({ type: "SELECT_OFFER", payload: offerId }),
      setPassengers: (passengers) => dispatch({ type: "SET_PASSENGERS", payload: passengers }),
      setCorporate: (corporate) => dispatch({ type: "SET_CORPORATE", payload: corporate }),
      reset: () => dispatch({ type: "RESET" }),
    };
  }, [state]);

  return <TripFlowContext.Provider value={value}>{children}</TripFlowContext.Provider>;
}

export function useTripFlow(): TripFlowContextValue {
  const ctx = useContext(TripFlowContext);
  if (!ctx) {
    throw new Error("useTripFlow must be used within a TripFlowProvider");
  }
  return ctx;
}
