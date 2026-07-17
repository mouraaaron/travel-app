import { isInternational } from "./airports";
import type { FlightOffer, OfferSegment, OfferSlice, SearchCriteria } from "./types";

export const MOCK_FLIGHT_OFFERS: FlightOffer[] = [
  {
    id: "flt-1",
    mode: "flight",
    origin: "GRU",
    destination: "JFK",
    destinationCountry: "US",
    departureAt: "2026-08-10T22:30:00.000Z",
    returnAt: "2026-08-17T23:10:00.000Z",
    cabinClass: "economy",
    airline: "LATAM",
    stops: 1,
    refundable: false,
    totalAmount: 2850,
    currency: "BRL",
  },
  {
    id: "flt-2",
    mode: "flight",
    origin: "GRU",
    destination: "MIA",
    destinationCountry: "US",
    departureAt: "2026-08-12T09:15:00.000Z",
    returnAt: "2026-08-19T18:40:00.000Z",
    cabinClass: "business",
    airline: "American Airlines",
    stops: 0,
    refundable: true,
    totalAmount: 8200,
    currency: "BRL",
  },
  {
    id: "flt-3",
    mode: "flight",
    origin: "GRU",
    destination: "GIG",
    destinationCountry: "BR",
    departureAt: "2026-08-05T07:00:00.000Z",
    returnAt: "2026-08-06T20:00:00.000Z",
    cabinClass: "economy",
    airline: "Azul",
    stops: 0,
    refundable: false,
    totalAmount: 450,
    currency: "BRL",
  },
  {
    id: "flt-4",
    mode: "flight",
    origin: "GRU",
    destination: "EZE",
    destinationCountry: "AR",
    departureAt: "2026-08-20T13:20:00.000Z",
    returnAt: "2026-08-23T21:00:00.000Z",
    cabinClass: "premium_economy",
    airline: "LATAM",
    stops: 0,
    refundable: false,
    totalAmount: 3400,
    currency: "BRL",
  },
  {
    id: "flt-5",
    mode: "flight",
    origin: "GRU",
    destination: "LIS",
    destinationCountry: "PT",
    departureAt: "2026-09-02T21:45:00.000Z",
    returnAt: "2026-09-12T14:30:00.000Z",
    cabinClass: "business",
    airline: "TAP Air Portugal",
    stops: 1,
    refundable: true,
    totalAmount: 6700,
    currency: "BRL",
  },
  {
    id: "flt-6",
    mode: "flight",
    origin: "CGH",
    destination: "BSB",
    destinationCountry: "BR",
    departureAt: "2026-08-14T08:10:00.000Z",
    returnAt: "2026-08-15T19:50:00.000Z",
    cabinClass: "economy",
    airline: "Gol",
    stops: 0,
    refundable: false,
    totalAmount: 620,
    currency: "BRL",
  },
];

interface Carrier {
  iata_code: string;
  name: string;
  brand_color: string;
  aircraft: string[];
}

export const CARRIERS: Carrier[] = [
  { iata_code: "LA", name: "LATAM", brand_color: "#7c2e12", aircraft: ["Airbus A320", "Boeing 787-9"] },
  { iata_code: "G3", name: "Gol", brand_color: "#d4582f", aircraft: ["Boeing 737 MAX 8"] },
  { iata_code: "AD", name: "Azul", brand_color: "#c54220", aircraft: ["Embraer E195-E2", "Airbus A330-900"] },
  { iata_code: "AA", name: "American Airlines", brand_color: "#7c2e12", aircraft: ["Boeing 777-200"] },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildSegment(
  origin: string,
  destination: string,
  departingAt: Date,
  durationHours: number,
  carrier: Carrier,
  flightNumberSeed: number
): OfferSegment {
  const arrivingAt = new Date(departingAt.getTime() + durationHours * 60 * 60 * 1000);
  const wholeHours = Math.floor(durationHours);
  const minutes = Math.round((durationHours - wholeHours) * 60);
  return {
    id: `seg_${flightNumberSeed}`,
    origin: { iata_code: origin, name: origin },
    destination: { iata_code: destination, name: destination },
    departing_at: departingAt.toISOString(),
    arriving_at: arrivingAt.toISOString(),
    duration: `PT${wholeHours}H${minutes}M`,
    marketing_carrier: { iata_code: carrier.iata_code, name: carrier.name },
    operating_carrier: { iata_code: carrier.iata_code, name: carrier.name },
    marketing_carrier_flight_number: String(1000 + (flightNumberSeed % 8999)),
    aircraft: { name: carrier.aircraft[flightNumberSeed % carrier.aircraft.length] },
    origin_terminal: null,
    destination_terminal: null,
    baggages: [
      { type: "carry_on", quantity: 1 },
      { type: "checked", quantity: flightNumberSeed % 3 === 0 ? 0 : 1 },
    ],
  };
}

function buildSlice(
  origin: string,
  destination: string,
  departureDate: string,
  carrier: Carrier,
  fareBrand: string,
  seed: number
): OfferSlice {
  const departingAt = new Date(`${departureDate}T${String(8 + (seed % 10)).padStart(2, "0")}:${seed % 2 === 0 ? "00" : "30"}:00.000Z`);
  const hasStop = seed % 3 === 0;
  const segments: OfferSegment[] = hasStop
    ? [
        buildSegment(origin, "CNF", departingAt, 1.75, carrier, seed),
        buildSegment(
          "CNF",
          destination,
          new Date(departingAt.getTime() + (1.75 + 1.5) * 60 * 60 * 1000),
          2.25,
          carrier,
          seed + 1
        ),
      ]
    : [buildSegment(origin, destination, departingAt, 2 + (seed % 5), carrier, seed)];

  const totalHours = segments.reduce((sum, segment) => {
    const match = /PT(\d+)H(\d+)M/.exec(segment.duration);
    return sum + (match ? Number(match[1]) + Number(match[2]) / 60 : 0);
  }, hasStop ? 1.5 : 0);

  return {
    id: `sli_${seed}`,
    origin,
    destination,
    duration: `PT${Math.floor(totalHours)}H${Math.round((totalHours % 1) * 60)}M`,
    fare_brand_name: fareBrand,
    segments,
  };
}

const FARE_BRANDS = ["Light", "Plus", "Flex"];

export function generateOffers(criteria: SearchCriteria): FlightOffer[] {
  const firstSlice = criteria.slices[0];
  if (!firstSlice) return [];
  if (firstSlice.destination.toUpperCase() === "ABV") return [];

  const passengerCount = criteria.passengers.length || 1;
  const international = isInternational(firstSlice.destination);
  const offerCount = 5;
  const now = Date.now();

  return Array.from({ length: offerCount }, (_, index) => {
    const seed = hashString(`${firstSlice.origin}${firstSlice.destination}${firstSlice.departure_date}${index}`);
    const carrier = CARRIERS[seed % CARRIERS.length];
    const fareBrand = FARE_BRANDS[seed % FARE_BRANDS.length];
    const basePrice = international ? 4500 + (seed % 8000) : 350 + (seed % 3200);
    const cabinClass =
      criteria.cabin_class === "economy" && seed % 7 === 0 ? "business" : criteria.cabin_class;

    const slices = criteria.slices.map((slice, sliceIndex) =>
      buildSlice(slice.origin, slice.destination, slice.departure_date, carrier, fareBrand, seed + sliceIndex * 100)
    );

    const totalDurationHours = slices.reduce((sum, slice) => {
      const match = /PT(\d+)H(\d+)M/.exec(slice.duration);
      return Math.max(sum, match ? Number(match[1]) + Number(match[2]) / 60 : 0);
    }, 0);

    const expiresInMinutes = index === 0 ? 8 : 30 + (seed % 90);

    return {
      id: `off_mock_${seed}`,
      mode: "flight",
      origin: firstSlice.origin,
      destination: firstSlice.destination,
      destinationCountry: international ? "US" : "BR",
      departureAt: slices[0].segments[0].departing_at,
      returnAt: slices[1]?.segments[0]?.departing_at,
      cabinClass,
      airline: carrier.name,
      stops: slices[0].segments.length - 1,
      refundable: seed % 2 === 0,
      totalAmount: basePrice * passengerCount,
      currency: "BRL",
      expiresAt: new Date(now + expiresInMinutes * 60 * 1000).toISOString(),
      owner: {
        iata_code: carrier.iata_code,
        name: carrier.name,
        logo_symbol_url: "",
        brand_color: carrier.brand_color,
      },
      slices,
      conditions: {
        refund_before_departure:
          seed % 2 === 0
            ? { allowed: true, penalty_amount: "350.00", penalty_currency: "BRL" }
            : { allowed: false },
        change_before_departure: { allowed: true, penalty_amount: "150.00", penalty_currency: "BRL" },
      },
      passengerIdentityDocumentsRequired: international,
      totalEmissionsKg: Math.round(80 + (seed % 400)),
      availableServices: [],
      fareBrandName: fareBrand,
      longestSegmentHours: totalDurationHours,
    } satisfies FlightOffer;
  });
}
