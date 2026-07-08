"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { requestsReducer } from "./requests-reducer";
import type { TripRequest } from "./types";

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
