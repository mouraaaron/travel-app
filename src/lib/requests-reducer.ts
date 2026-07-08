import type { TripRequest } from "./types";

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
