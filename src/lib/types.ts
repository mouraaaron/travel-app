export type CabinClass = "economy" | "premium_economy" | "business" | "first";

export interface FlightOffer {
  id: string;
  mode: "flight";
  origin: string;
  destination: string;
  destinationCountry: string;
  departureAt: string;
  returnAt?: string;
  cabinClass: CabinClass;
  airline: string;
  stops: number;
  refundable: boolean;
  totalAmount: number;
  currency: string;
  // --- Duffel-shaped extension (optional; populated by generateOffers in mock-data.ts) ---
  expiresAt?: string;
  owner?: OfferOwner;
  slices?: OfferSlice[];
  conditions?: OfferConditions;
  passengerIdentityDocumentsRequired?: boolean;
  totalEmissionsKg?: number;
  availableServices?: AvailableService[];
  fareBrandName?: string;
  longestSegmentHours?: number;
  rateToBRL?: number;
}

// --- Duffel-shaped additions (additive; nothing above this line is modified) ---

export interface OfferOwner {
  iata_code: string;
  name: string;
  logo_symbol_url: string;
  brand_color: string;
}

export interface OfferSegmentBaggage {
  type: "carry_on" | "checked";
  quantity: number;
}

export interface OfferSegment {
  id: string;
  origin: { iata_code: string; name: string };
  destination: { iata_code: string; name: string };
  departing_at: string;
  arriving_at: string;
  duration: string; // ISO 8601 duration, e.g. "PT4H5M"
  marketing_carrier: { iata_code: string; name: string };
  operating_carrier: { iata_code: string; name: string };
  marketing_carrier_flight_number: string;
  aircraft: { name: string };
  origin_terminal: string | null;
  destination_terminal: string | null;
  baggages: OfferSegmentBaggage[];
}

export interface OfferSlice {
  id: string;
  origin: string;
  destination: string;
  duration: string;
  fare_brand_name: string;
  segments: OfferSegment[];
}

export interface OfferConditionDetail {
  allowed: boolean;
  penalty_amount?: string;
  penalty_currency?: string;
}

export interface OfferConditions {
  refund_before_departure: OfferConditionDetail;
  change_before_departure: OfferConditionDetail;
}

export interface AvailableService {
  type: string;
  title: string;
  total_amount: string;
  total_currency: string;
}

export interface SearchSlice {
  origin: string;
  destination: string;
  departure_date: string;
}

export type SearchPassengerSpec = { type: "adult" | "child" | "infant_without_seat" };

export interface SearchCriteria {
  slices: SearchSlice[];
  passengers: SearchPassengerSpec[];
  cabin_class: CabinClass;
  max_connections?: 0 | 1 | 2;
  preferences?: {
    arrive_by_outbound?: string;
    depart_after_return?: string;
  };
}

export type PassengerTitle = "mr" | "mrs" | "ms" | "miss" | "dr";
export type PassengerGender = "m" | "f";

export interface IdentityDocument {
  type: "passport";
  unique_identifier: string;
  issuing_country_code: string;
  expires_on: string;
}

export interface DuffelPassenger {
  id: string;
  type: "adult" | "child" | "infant_without_seat";
  title: PassengerTitle;
  given_name: string;
  family_name: string;
  born_on: string;
  gender: PassengerGender;
  email: string;
  phone_number: string;
  identity_documents?: IdentityDocument[];
  infant_passenger_id?: string;
}

export type TripPurpose =
  | "client_meeting"
  | "conference"
  | "internal_meeting"
  | "training"
  | "other";

export interface CorporateContext {
  trip_purpose: TripPurpose;
  cost_center: string;
  project_code?: string;
  business_justification: string;
  out_of_policy_justification?: string;
}

export type TravelRequestStatus =
  | "pending_admin"
  | "approved"
  | "rejected"
  | "needs_review"
  | "confirmed"
  | "cancelled";

export interface SelectedOfferSnapshot {
  offer_id: string;
  total_amount: string;
  total_currency: string;
  exchange_rate_to_brl?: number;
  owner: { iata_code: string; name: string; logo_symbol_url: string };
  slices: Array<{
    origin: string;
    destination: string;
    departure_datetime: string;
    arrival_datetime: string;
    duration: string;
    segments_count: number;
    fare_brand_name?: string;
  }>;
  conditions: OfferConditions;
  passenger_identity_documents_required: boolean;
  total_emissions_kg?: number;
  expires_at: string;
}

export interface TravelRequestEvent {
  at: string;
  kind: "created" | "approved" | "rejected" | "needs_review" | "confirmed" | "cancelled";
  actor_id?: string;
  note?: string;
}

export interface DuffelPolicyViolationRecord {
  rule_id: string;
  message: string;
  field: string;
  expected: string;
  actual: string;
}

export interface TravelRequest {
  id: string;
  organization_id: string;
  employee_id: string;
  onsite_week_id: string | null;
  created_at: string;
  status: TravelRequestStatus;
  search_criteria: SearchCriteria;
  selected_offer_snapshot: SelectedOfferSnapshot;
  passengers: DuffelPassenger[];
  corporate: CorporateContext;
  policy_evaluation: {
    compliant: boolean;
    violations: DuffelPolicyViolationRecord[];
    flags: { international_travel: boolean; cost_above_threshold: boolean };
  };
  events: TravelRequestEvent[];
}
