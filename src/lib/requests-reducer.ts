import type { TravelRequest, TripRequest } from "./types";

export type RequestsAction =
  | { type: "ADD_REQUEST"; payload: TripRequest }
  | { type: "HYDRATE"; payload: TripRequest[] };

export function requestsReducer(
  state: TripRequest[],
  action: RequestsAction
): TripRequest[] {
  switch (action.type) {
    case "ADD_REQUEST":
      return [action.payload, ...state];
    case "HYDRATE":
      return action.payload;
    default:
      return state;
  }
}

export type TravelRequestAction =
  | { type: "ADD_TRAVEL_REQUEST"; payload: TravelRequest }
  | { type: "CANCEL_TRAVEL_REQUEST"; payload: { id: string; at: string } }
  | { type: "HYDRATE_TRAVEL"; payload: TravelRequest[] };

export function travelRequestsReducer(
  state: TravelRequest[],
  action: TravelRequestAction
): TravelRequest[] {
  switch (action.type) {
    case "ADD_TRAVEL_REQUEST":
      return [action.payload, ...state];
    case "CANCEL_TRAVEL_REQUEST":
      return state.map((request) =>
        request.id === action.payload.id
          ? {
              ...request,
              status: "cancelled",
              events: [...request.events, { at: action.payload.at, kind: "cancelled" as const }],
            }
          : request
      );
    case "HYDRATE_TRAVEL":
      return action.payload;
    default:
      return state;
  }
}
