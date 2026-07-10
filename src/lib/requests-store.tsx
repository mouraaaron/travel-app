"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { requestsReducer, travelRequestsReducer } from "./requests-reducer";
import type { TravelRequest, TripRequest } from "./types";

const STORAGE_KEY = "travel-app.requests.v1";

interface RequestsContextValue {
  requests: TripRequest[];
  addRequest: (request: TripRequest) => void;
}

const RequestsContext = createContext<RequestsContextValue | null>(null);

export function RequestsProvider({ children }: { children: ReactNode }) {
  const [requests, dispatch] = useReducer(requestsReducer, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      dispatch({ type: "HYDRATE", payload: JSON.parse(raw) as TripRequest[] });
    } catch {
      // Corrupt/incompatible localStorage data — ignore and keep the initial empty state.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  }, [requests]);

  const value = useMemo<RequestsContextValue>(
    () => ({
      requests,
      addRequest: (request) => dispatch({ type: "ADD_REQUEST", payload: request }),
    }),
    [requests]
  );

  return (
    <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>
  );
}

export function useRequests(): RequestsContextValue {
  const ctx = useContext(RequestsContext);
  if (!ctx) {
    throw new Error("useRequests must be used within a RequestsProvider");
  }
  return ctx;
}

const TRAVEL_STORAGE_KEY = "travel-app.travel-requests.v1";

interface TravelRequestsContextValue {
  travelRequests: TravelRequest[];
  addTravelRequest: (request: TravelRequest) => void;
  cancelTravelRequest: (id: string, at: string) => void;
}

const TravelRequestsContext = createContext<TravelRequestsContextValue | null>(null);

export function TravelRequestsProvider({ children }: { children: ReactNode }) {
  const [travelRequests, dispatch] = useReducer(travelRequestsReducer, []);
  const hasHydrated = useRef(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(TRAVEL_STORAGE_KEY);
    if (raw) {
      try {
        dispatch({ type: "HYDRATE_TRAVEL", payload: JSON.parse(raw) as TravelRequest[] });
      } catch {
        // Corrupt/incompatible localStorage data — ignore and keep the initial empty state.
      }
    }
    hasHydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hasHydrated.current) return;
    window.localStorage.setItem(TRAVEL_STORAGE_KEY, JSON.stringify(travelRequests));
  }, [travelRequests]);

  const value = useMemo<TravelRequestsContextValue>(
    () => ({
      travelRequests,
      addTravelRequest: (request) => dispatch({ type: "ADD_TRAVEL_REQUEST", payload: request }),
      cancelTravelRequest: (id, at) => dispatch({ type: "CANCEL_TRAVEL_REQUEST", payload: { id, at } }),
    }),
    [travelRequests]
  );

  return (
    <TravelRequestsContext.Provider value={value}>{children}</TravelRequestsContext.Provider>
  );
}

export function useTravelRequests(): TravelRequestsContextValue {
  const ctx = useContext(TravelRequestsContext);
  if (!ctx) {
    throw new Error("useTravelRequests must be used within a TravelRequestsProvider");
  }
  return ctx;
}
