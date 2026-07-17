import { describe, expect, it } from "vitest";
import { mapDuffelPlaceSuggestionsToAirportOptions } from "./map-place";
import type { DuffelRawPlaceSuggestion } from "./types";

describe("mapDuffelPlaceSuggestionsToAirportOptions", () => {
  it("maps a top-level airport place directly", () => {
    const raw: DuffelRawPlaceSuggestion[] = [
      {
        type: "airport",
        name: "Miami International Airport",
        iata_code: "MIA",
        city_name: "Miami",
        latitude: 25.7959,
        longitude: -80.287,
      },
    ];

    const result = mapDuffelPlaceSuggestionsToAirportOptions(raw);

    expect(result).toEqual([
      {
        code: "MIA",
        label: "Miami (MIA)",
        sublabel: "Miami International Airport",
        lat: 25.7959,
        lng: -80.287,
      },
    ]);
  });

  it("expands a city place into one option per nested airport", () => {
    const raw: DuffelRawPlaceSuggestion[] = [
      {
        type: "city",
        name: "Amsterdam",
        iata_code: "AMS",
        city_name: "Amsterdam",
        latitude: 52.3676,
        longitude: 4.9041,
        airports: [
          {
            type: "airport",
            name: "Amsterdam Airport Schiphol",
            iata_code: "AMS",
            city_name: "Amsterdam",
            latitude: 52.3086,
            longitude: 4.7639,
          },
        ],
      },
    ];

    const result = mapDuffelPlaceSuggestionsToAirportOptions(raw);

    expect(result).toEqual([
      {
        code: "AMS",
        label: "Amsterdam (AMS)",
        sublabel: "Amsterdam Airport Schiphol",
        lat: 52.3086,
        lng: 4.7639,
      },
    ]);
  });

  it("falls back to the city's own lat/lng when a nested airport has none", () => {
    const raw: DuffelRawPlaceSuggestion[] = [
      {
        type: "city",
        name: "Testville",
        iata_code: null,
        city_name: "Testville",
        latitude: 10,
        longitude: 20,
        airports: [
          {
            type: "airport",
            name: "Testville Airport",
            iata_code: "TVA",
            city_name: "Testville",
            latitude: null,
            longitude: null,
          },
        ],
      },
    ];

    const result = mapDuffelPlaceSuggestionsToAirportOptions(raw);

    expect(result[0]).toEqual({
      code: "TVA",
      label: "Testville (TVA)",
      sublabel: "Testville Airport",
      lat: 10,
      lng: 20,
    });
  });

  it("skips airports without an IATA code", () => {
    const raw: DuffelRawPlaceSuggestion[] = [
      {
        type: "city",
        name: "No Airport City",
        iata_code: null,
        city_name: "No Airport City",
        latitude: 0,
        longitude: 0,
        airports: [
          {
            type: "airport",
            name: "Unnamed strip",
            iata_code: null,
            city_name: "No Airport City",
            latitude: 0,
            longitude: 0,
          },
        ],
      },
    ];

    expect(mapDuffelPlaceSuggestionsToAirportOptions(raw)).toEqual([]);
  });

  it("returns an empty array for an empty input", () => {
    expect(mapDuffelPlaceSuggestionsToAirportOptions([])).toEqual([]);
  });

  it("dedups by code, keeping the top-level airport occurrence over a nested duplicate", () => {
    const raw: DuffelRawPlaceSuggestion[] = [
      {
        type: "airport",
        name: "Miami International Airport",
        iata_code: "MIA",
        city_name: "Miami",
        latitude: 25.7959,
        longitude: -80.287,
      },
      {
        type: "city",
        name: "Miami Metro",
        iata_code: null,
        city_name: "Miami Metro",
        latitude: 25.8,
        longitude: -80.3,
        airports: [
          {
            type: "airport",
            name: "Miami Intl (duplicate nested entry)",
            iata_code: "MIA",
            city_name: "Miami Metro",
            latitude: 25.79,
            longitude: -80.29,
          },
        ],
      },
    ];

    const result = mapDuffelPlaceSuggestionsToAirportOptions(raw);

    const miaEntries = result.filter((option) => option.code === "MIA");
    expect(miaEntries).toHaveLength(1);
    expect(miaEntries[0]).toEqual({
      code: "MIA",
      label: "Miami (MIA)",
      sublabel: "Miami International Airport",
      lat: 25.7959,
      lng: -80.287,
    });
  });
});
