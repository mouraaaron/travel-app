import type { CorporateContext, DuffelPassenger, FlightOffer, SearchCriteria } from "./types";

export interface TripFlowState {
  criteria: SearchCriteria | null;
  offers: FlightOffer[];
  loadingOffers: boolean;
  selectedOfferId: string | null;
  passengers: DuffelPassenger[] | null;
  corporate: CorporateContext | null;
}

export const INITIAL_TRIP_FLOW_STATE: TripFlowState = {
  criteria: null,
  offers: [],
  loadingOffers: false,
  selectedOfferId: null,
  passengers: null,
  corporate: null,
};

export type TripFlowAction =
  | { type: "SET_CRITERIA"; payload: SearchCriteria }
  | { type: "START_LOADING_OFFERS" }
  | { type: "SET_OFFERS"; payload: FlightOffer[] }
  | { type: "SELECT_OFFER"; payload: string }
  | { type: "SET_PASSENGERS"; payload: DuffelPassenger[] }
  | { type: "SET_CORPORATE"; payload: CorporateContext }
  | { type: "RESET" };

export function tripFlowReducer(state: TripFlowState, action: TripFlowAction): TripFlowState {
  switch (action.type) {
    case "SET_CRITERIA":
      return { ...state, criteria: action.payload, offers: [], selectedOfferId: null };
    case "START_LOADING_OFFERS":
      return { ...state, loadingOffers: true };
    case "SET_OFFERS":
      return { ...state, offers: action.payload, loadingOffers: false };
    case "SELECT_OFFER":
      return { ...state, selectedOfferId: action.payload };
    case "SET_PASSENGERS":
      return { ...state, passengers: action.payload };
    case "SET_CORPORATE":
      return { ...state, corporate: action.payload };
    case "RESET":
      return INITIAL_TRIP_FLOW_STATE;
    default:
      return state;
  }
}
