import type { AirportOption } from "../airports";
import type { DuffelRawPlaceSuggestion } from "./types";

export function mapDuffelPlaceSuggestionsToAirportOptions(
  places: DuffelRawPlaceSuggestion[]
): AirportOption[] {
  const options: AirportOption[] = [];
  const seenCodes = new Set<string>();

  for (const place of places) {
    if (place.type === "airport") {
      if (!place.iata_code || seenCodes.has(place.iata_code)) continue;
      seenCodes.add(place.iata_code);
      options.push({
        code: place.iata_code,
        label: `${place.city_name ?? place.name} (${place.iata_code})`,
        sublabel: place.name,
        lat: place.latitude ?? 0,
        lng: place.longitude ?? 0,
      });
      continue;
    }

    for (const airport of place.airports ?? []) {
      if (!airport.iata_code || seenCodes.has(airport.iata_code)) continue;
      seenCodes.add(airport.iata_code);
      options.push({
        code: airport.iata_code,
        label: `${place.name} (${airport.iata_code})`,
        sublabel: airport.name,
        lat: airport.latitude ?? place.latitude ?? 0,
        lng: airport.longitude ?? place.longitude ?? 0,
      });
    }
  }

  return options;
}
