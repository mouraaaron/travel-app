import type { CabinClass, FlightOffer, OfferConditionDetail, OfferSegment, OfferSlice, SearchCriteria } from "../types";
import type { DuffelRawConditionDetail, DuffelRawOffer, DuffelRawSlice } from "./types";

function mapConditionDetail(
  raw: DuffelRawConditionDetail | null,
  rateToBRL: number
): OfferConditionDetail {
  if (!raw) return { allowed: false };
  return {
    allowed: raw.allowed,
    penalty_amount: raw.penalty_amount
      ? (Number(raw.penalty_amount) * rateToBRL).toFixed(2)
      : undefined,
    penalty_currency: raw.penalty_amount ? "BRL" : undefined,
  };
}

function parseDurationHours(iso: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(iso);
  if (!match) return 0;
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = match[2] ? Number(match[2]) : 0;
  return hours + minutes / 60;
}

function mapSlice(raw: DuffelRawSlice): OfferSlice {
  return {
    id: raw.id,
    origin: raw.origin.iata_code,
    destination: raw.destination.iata_code,
    duration: raw.duration,
    fare_brand_name: raw.fare_brand_name ?? "",
    segments: raw.segments.map(
      (segment): OfferSegment => ({
        id: segment.id,
        origin: { iata_code: segment.origin.iata_code, name: segment.origin.name },
        destination: { iata_code: segment.destination.iata_code, name: segment.destination.name },
        departing_at: segment.departing_at,
        arriving_at: segment.arriving_at,
        duration: segment.duration,
        marketing_carrier: segment.marketing_carrier,
        operating_carrier: segment.operating_carrier,
        marketing_carrier_flight_number: segment.marketing_carrier_flight_number,
        aircraft: { name: segment.aircraft?.name ?? "" },
        origin_terminal: segment.origin_terminal,
        destination_terminal: segment.destination_terminal,
        // Duffel guarda bagagem por passageiro; a UI mostra um resumo único
        // por trecho, então usamos o primeiro passageiro como referência.
        baggages: segment.passengers[0]?.baggages ?? [],
      })
    ),
  };
}

export function mapDuffelOfferToFlightOffer(
  raw: DuffelRawOffer,
  criteria: SearchCriteria,
  rateToBRL: number
): FlightOffer {
  const slices = raw.slices.map(mapSlice);
  const firstSlice = slices[0];
  const lastSlice = slices[slices.length - 1];
  const isRoundTrip = slices.length === 2 && lastSlice?.destination === firstSlice?.origin;

  const longestSegmentHours = slices.reduce(
    (max, slice) => Math.max(max, parseDurationHours(slice.duration)),
    0
  );

  const rawFirstSegmentPassenger = raw.slices[0]?.segments[0]?.passengers[0];
  const cabinClass = (rawFirstSegmentPassenger?.cabin_class as CabinClass | undefined) ?? criteria.cabin_class;

  return {
    id: raw.id,
    mode: "flight",
    origin: firstSlice?.origin ?? criteria.slices[0]?.origin ?? "",
    destination: isRoundTrip ? (firstSlice?.destination ?? "") : (lastSlice?.destination ?? ""),
    destinationCountry: raw.slices[0]?.destination.iata_country_code ?? "",
    departureAt: firstSlice?.segments[0]?.departing_at ?? "",
    returnAt: isRoundTrip ? lastSlice?.segments[0]?.departing_at : undefined,
    cabinClass,
    airline: raw.owner.name,
    stops: (firstSlice?.segments.length ?? 1) - 1,
    refundable: raw.conditions.refund_before_departure?.allowed ?? false,
    totalAmount: Number(raw.total_amount) * rateToBRL,
    currency: "BRL",
    rateToBRL,
    expiresAt: raw.expires_at,
    owner: {
      iata_code: raw.owner.iata_code,
      name: raw.owner.name,
      logo_symbol_url: raw.owner.logo_symbol_url ?? "",
      brand_color: "",
    },
    slices,
    conditions: {
      refund_before_departure: mapConditionDetail(raw.conditions.refund_before_departure, rateToBRL),
      change_before_departure: mapConditionDetail(raw.conditions.change_before_departure, rateToBRL),
    },
    passengerIdentityDocumentsRequired: raw.passenger_identity_documents_required,
    totalEmissionsKg: raw.total_emissions_kg ? Number(raw.total_emissions_kg) : undefined,
    // Duffel's ancillary-services schema is richer than this MVP's UI needs
    // (it only renders the list when non-empty, and never did even with
    // mock data) — left empty deliberately, matching current behavior.
    availableServices: [],
    fareBrandName: firstSlice?.fare_brand_name,
    longestSegmentHours,
  };
}
