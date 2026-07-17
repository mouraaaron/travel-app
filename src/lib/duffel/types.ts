export interface DuffelRawPlace {
  iata_code: string;
  name: string;
  iata_country_code?: string;
}

export interface DuffelRawSegmentPassenger {
  passenger_id: string;
  cabin_class: string;
  baggages: { type: "carry_on" | "checked"; quantity: number }[];
}

export interface DuffelRawSegment {
  id: string;
  origin: DuffelRawPlace;
  destination: DuffelRawPlace;
  departing_at: string;
  arriving_at: string;
  duration: string;
  marketing_carrier: { iata_code: string; name: string };
  operating_carrier: { iata_code: string; name: string };
  marketing_carrier_flight_number: string;
  aircraft: { name: string } | null;
  origin_terminal: string | null;
  destination_terminal: string | null;
  passengers: DuffelRawSegmentPassenger[];
}

export interface DuffelRawSlice {
  id: string;
  origin: DuffelRawPlace;
  destination: DuffelRawPlace;
  duration: string;
  fare_brand_name: string | null;
  segments: DuffelRawSegment[];
}

export interface DuffelRawConditionDetail {
  allowed: boolean;
  penalty_amount?: string | null;
  penalty_currency?: string | null;
}

export interface DuffelRawOffer {
  id: string;
  total_amount: string;
  total_currency: string;
  expires_at: string;
  owner: { iata_code: string; name: string; logo_symbol_url: string | null };
  slices: DuffelRawSlice[];
  conditions: {
    refund_before_departure: DuffelRawConditionDetail | null;
    change_before_departure: DuffelRawConditionDetail | null;
  };
  passenger_identity_documents_required: boolean;
  total_emissions_kg: string | null;
}

export interface DuffelOfferRequestResponse {
  data: {
    offers: DuffelRawOffer[];
  };
}

export interface DuffelErrorResponse {
  errors: { title: string; message: string; code: string }[];
}

export interface DuffelRawPlaceSuggestion {
  type: "airport" | "city";
  name: string;
  iata_code: string | null;
  city_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  airports?: DuffelRawPlaceSuggestion[];
}

export interface DuffelPlacesResponse {
  data: DuffelRawPlaceSuggestion[];
}
