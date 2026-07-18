import type { OnsiteWeekStatus, Sector } from "./badge-variants";
import type {
  CabinClass,
  CorporateContext,
  DuffelPassenger,
  FlightOffer,
  PassengerGender,
  PassengerTitle,
  SearchCriteria,
  SelectedOfferSnapshot,
} from "./types";

const CURITIBA_IATA = "CWB";

export interface TravelProfileFields {
  origin_airport_code: string | null;
  given_name: string | null;
  family_name: string | null;
  born_on: string | null;
  gender: PassengerGender | null;
  title: PassengerTitle | null;
  phone_number: string | null;
  email: string;
}

const REQUIRED_TRAVEL_PROFILE_FIELDS: Array<{ key: keyof TravelProfileFields; label: string }> = [
  { key: "origin_airport_code", label: "Cidade de origem" },
  { key: "given_name", label: "Nome" },
  { key: "family_name", label: "Sobrenome" },
  { key: "born_on", label: "Data de nascimento" },
  { key: "gender", label: "Gênero" },
  { key: "title", label: "Título" },
  { key: "phone_number", label: "Telefone" },
];

export type EmployeeEligibility =
  | { status: "ok" }
  | { status: "missing_profile_data"; missingFields: string[] };

export function computeEmployeeEligibility(profile: TravelProfileFields): EmployeeEligibility {
  const missingFields = REQUIRED_TRAVEL_PROFILE_FIELDS.filter(({ key }) => !profile[key]).map(
    ({ label }) => label
  );
  if (missingFields.length > 0) {
    return { status: "missing_profile_data", missingFields };
  }
  return { status: "ok" };
}

export function isBasedInCuritiba(originAirportCode: string | null): boolean {
  return originAirportCode === CURITIBA_IATA;
}

export interface OnsiteWeekPreviewEmployee {
  id: string;
  full_name: string;
  origin_airport_code: string | null;
  eligibility: EmployeeEligibility;
  default_checked: boolean;
}

export function buildOnsiteWeekPreviewEmployee(
  profile: { id: string; full_name: string } & TravelProfileFields
): OnsiteWeekPreviewEmployee {
  const eligibility = computeEmployeeEligibility(profile);
  return {
    id: profile.id,
    full_name: profile.full_name,
    origin_airport_code: profile.origin_airport_code,
    eligibility,
    default_checked: eligibility.status === "ok" && !isBasedInCuritiba(profile.origin_airport_code),
  };
}

export function buildOnsiteWeekSearchCriteria(
  originAirportCode: string,
  weekStartDate: string,
  weekEndDate: string
): SearchCriteria {
  return {
    slices: [
      { origin: originAirportCode, destination: CURITIBA_IATA, departure_date: weekStartDate },
      { origin: CURITIBA_IATA, destination: originAirportCode, departure_date: weekEndDate },
    ],
    passengers: [{ type: "adult" }],
    cabin_class: "economy" as CabinClass,
  };
}

export function pickCheapestOffer(offers: FlightOffer[]): FlightOffer | null {
  if (offers.length === 0) return null;
  return offers.reduce((cheapest, offer) => (offer.totalAmount < cheapest.totalAmount ? offer : cheapest));
}

export function buildOnsiteWeekPassenger(profile: TravelProfileFields): DuffelPassenger {
  return {
    id: "pas-1",
    type: "adult",
    title: profile.title as PassengerTitle,
    given_name: profile.given_name as string,
    family_name: profile.family_name as string,
    born_on: profile.born_on as string,
    gender: profile.gender as PassengerGender,
    email: profile.email,
    phone_number: profile.phone_number as string,
  };
}

export function buildOnsiteWeekCorporateContext(
  sector: Sector,
  weekStartDate: string,
  weekEndDate: string
): CorporateContext {
  return {
    trip_purpose: "internal_meeting",
    cost_center: sector,
    business_justification: `Semana presencial — ${sector}, ${weekStartDate} a ${weekEndDate}.`,
  };
}

export function buildOnsiteWeekOfferSnapshot(offer: FlightOffer): SelectedOfferSnapshot {
  const now = new Date().toISOString();
  return {
    offer_id: offer.id,
    total_amount: String(offer.totalAmount),
    total_currency: offer.currency,
    exchange_rate_to_brl: offer.rateToBRL,
    owner: {
      iata_code: offer.owner?.iata_code ?? "",
      name: offer.airline,
      logo_symbol_url: offer.owner?.logo_symbol_url ?? "",
    },
    slices: (offer.slices ?? []).map((slice) => ({
      origin: slice.origin,
      destination: slice.destination,
      departure_datetime: slice.segments[0]?.departing_at ?? "",
      arrival_datetime: slice.segments[slice.segments.length - 1]?.arriving_at ?? "",
      duration: slice.duration,
      segments_count: slice.segments.length,
      fare_brand_name: slice.fare_brand_name,
    })),
    conditions: offer.conditions ?? {
      refund_before_departure: { allowed: false },
      change_before_departure: { allowed: false },
    },
    passenger_identity_documents_required: offer.passengerIdentityDocumentsRequired ?? false,
    total_emissions_kg: offer.totalEmissionsKg,
    expires_at: offer.expiresAt ?? now,
  };
}

export function deriveOnsiteWeekStatus(failureCount: number): OnsiteWeekStatus {
  return failureCount > 0 ? "partial" : "completed";
}

export interface OnsiteWeekEmployeeOutcome {
  employee_id: string;
  employee_name: string;
  status: "created" | "failed";
  request_id?: string;
  error_message?: string;
}

export interface OnsiteWeek {
  id: string;
  organization_id: string;
  sector: Sector;
  week_start_date: string;
  week_end_date: string;
  status: OnsiteWeekStatus;
  employee_outcomes: OnsiteWeekEmployeeOutcome[];
  created_by: string;
  created_at: string;
  cancelled_at: string | null;
}

export function mergeOnsiteWeekOutcomes(
  existing: OnsiteWeekEmployeeOutcome[],
  updates: OnsiteWeekEmployeeOutcome[]
): OnsiteWeekEmployeeOutcome[] {
  const updatesById = new Map(updates.map((outcome) => [outcome.employee_id, outcome]));
  const merged = existing.map((outcome) => updatesById.get(outcome.employee_id) ?? outcome);
  const existingIds = new Set(existing.map((outcome) => outcome.employee_id));
  const appended = updates.filter((outcome) => !existingIds.has(outcome.employee_id));
  return [...merged, ...appended];
}
