"use client";

import { useEffect, useRef, useState } from "react";
import { searchAirports, type AirportOption } from "./airports";
import { resolvePlaceSuggestions } from "./place-suggestions";

const DEBOUNCE_MS = 300;

export function usePlaceSuggestions(
  query: string,
  enabled: boolean
): { options: AirportOption[]; isLoading: boolean } {
  const [options, setOptions] = useState<AirportOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    controllerRef.current?.abort();

    if (!enabled || query.trim().length < 2) {
      setOptions([]);
      setIsLoading(false);
      return;
    }

    setOptions(searchAirports(query));
    setIsLoading(true);

    const controller = new AbortController();
    controllerRef.current = controller;

    const timer = setTimeout(() => {
      resolvePlaceSuggestions(query, controller.signal)
        .then((remoteOptions) => {
          setOptions(remoteOptions);
          setIsLoading(false);
        })
        .catch(() => {
          // Requisição cancelada por uma tecla mais nova: o próximo efeito já assumiu o estado.
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, enabled]);

  return { options, isLoading };
}
