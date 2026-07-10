import { describe, expect, it } from "vitest";
import {
  formatBaggageSummary,
  formatCurrency,
  formatDate,
  formatDuration,
  formatStopsLabel,
  formatTimeRange,
  getRouteLabel,
  offerTitle,
} from "./offer-format";
import type { FlightOffer, StayOffer, OfferSegment } from "./types";

const flightOffer: FlightOffer = {
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
};

const stayOffer: StayOffer = {
  id: "sty-1",
  mode: "stay",
  city: "São Paulo",
  country: "BR",
  checkIn: "2026-08-10",
  checkOut: "2026-08-13",
  hotelName: "Ibis Budget Paulista",
  starRating: 2,
  refundable: true,
  totalAmount: 480,
  currency: "BRL",
};

describe("offerTitle", () => {
  it("builds a title from airline and route for a flight offer", () => {
    expect(offerTitle(flightOffer)).toBe("LATAM · GRU → JFK");
  });

  it("builds a title from hotel name and city for a stay offer", () => {
    expect(offerTitle(stayOffer)).toBe("Ibis Budget Paulista · São Paulo");
  });
});

describe("formatCurrency", () => {
  it("formats a BRL amount using pt-BR conventions", () => {
    expect(formatCurrency(2850, "BRL")).toBe(
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(2850)
    );
  });
});

describe("formatDate", () => {
  it("formats an ISO date string using pt-BR medium date style", () => {
    expect(formatDate("2026-08-10T22:30:00.000Z")).toBe(
      new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(
        new Date("2026-08-10T22:30:00.000Z")
      )
    );
  });

  it("renders a date-only ISO string as its own calendar day regardless of local timezone", () => {
    // Regression test: new Date("2026-08-10") parses as UTC midnight. Without pinning
    // timeZone: "UTC" in the formatter, any timezone behind UTC (e.g. Brazil, UTC-3)
    // would render this as "9 de ago." instead of "10 de ago.".
    const result = formatDate("2026-08-10");
    expect(result).toBe("10 de ago. de 2026");
    expect(result).not.toContain("9 de ago");
    expect(result).not.toContain("09 de ago");
  });
});

function buildSegment(overrides: Partial<OfferSegment> = {}): OfferSegment {
  return {
    id: "seg-1",
    origin: { iata_code: "GRU", name: "Guarulhos" },
    destination: { iata_code: "CNF", name: "Confins" },
    departing_at: "2026-08-10T14:30:00.000Z",
    arriving_at: "2026-08-10T16:15:00.000Z",
    duration: "PT1H45M",
    marketing_carrier: { iata_code: "LA", name: "LATAM" },
    operating_carrier: { iata_code: "LA", name: "LATAM" },
    marketing_carrier_flight_number: "4643",
    aircraft: { name: "Embraer E195-E2" },
    origin_terminal: null,
    destination_terminal: null,
    baggages: [
      { type: "carry_on", quantity: 1 },
      { type: "checked", quantity: 1 },
    ],
    ...overrides,
  };
}

describe("formatDuration", () => {
  it("formats an ISO 8601 duration as Xh YYmin", () => {
    expect(formatDuration("PT4H5M")).toBe("4h 05min");
  });

  it("pads single-digit minutes", () => {
    expect(formatDuration("PT1H5M")).toBe("1h 05min");
  });

  it("handles zero minutes", () => {
    expect(formatDuration("PT2H0M")).toBe("2h 00min");
  });

  it("handles hour-only durations", () => {
    expect(formatDuration("PT4H")).toBe("4h 00min");
  });

  it("handles minute-only durations", () => {
    expect(formatDuration("PT45M")).toBe("0h 45min");
  });
});

describe("formatTimeRange", () => {
  it("formats departure and arrival as HH:mm → HH:mm in pt-BR", () => {
    expect(formatTimeRange("2026-08-10T14:30:00.000Z", "2026-08-10T18:35:00.000Z")).toBe(
      `${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(
        new Date("2026-08-10T14:30:00.000Z")
      )} → ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(
        new Date("2026-08-10T18:35:00.000Z")
      )}`
    );
  });
});

describe("formatStopsLabel", () => {
  it("returns Direto for a single segment", () => {
    expect(formatStopsLabel([buildSegment()])).toBe("Direto");
  });

  it("returns a connection label with the layover airport for 2 segments", () => {
    const first = buildSegment({ arriving_at: "2026-08-10T16:15:00.000Z" });
    const second = buildSegment({
      id: "seg-2",
      origin: { iata_code: "CNF", name: "Confins" },
      destination: { iata_code: "GIG", name: "Galeão" },
      departing_at: "2026-08-10T17:45:00.000Z",
      arriving_at: "2026-08-10T19:00:00.000Z",
    });
    expect(formatStopsLabel([first, second])).toBe("1 escala em CNF (1h 30min)");
  });

  it("returns an N escalas label for 3+ segments", () => {
    const segments = [buildSegment(), buildSegment({ id: "seg-2" }), buildSegment({ id: "seg-3" })];
    expect(formatStopsLabel(segments)).toBe("2 escalas");
  });

  it("handles minute overflow at 60-minute rounding boundary", () => {
    // Layover of 1h 59m 45s = 1.99583 hours
    // Math.round((1.99583 - 1) * 60) = Math.round(59.748) = 60
    // Without the fix, this would be "1h 60min"
    // With the fix, it should be "2h 00min"
    const first = buildSegment({ arriving_at: "2026-08-10T16:15:00.000Z" });
    const second = buildSegment({
      id: "seg-2",
      origin: { iata_code: "CNF", name: "Confins" },
      destination: { iata_code: "GIG", name: "Galeão" },
      departing_at: "2026-08-10T18:14:45.000Z",
      arriving_at: "2026-08-10T19:30:00.000Z",
    });
    expect(formatStopsLabel([first, second])).toBe("1 escala em CNF (2h 00min)");
  });
});

describe("getRouteLabel", () => {
  it("returns the real destination for a round-trip (2 slices looping back to origin)", () => {
    const slices = [
      { origin: "GRU", destination: "GIG" },
      { origin: "GIG", destination: "GRU" },
    ];
    expect(getRouteLabel(slices)).toEqual({ origin: "GRU", destination: "GIG" });
  });

  it("returns the destination for a one-way (single slice)", () => {
    const slices = [{ origin: "GRU", destination: "JFK" }];
    expect(getRouteLabel(slices)).toEqual({ origin: "GRU", destination: "JFK" });
  });

  it("returns the last slice's destination for a multi-city itinerary that doesn't loop back", () => {
    const slices = [
      { origin: "GRU", destination: "GIG" },
      { origin: "GIG", destination: "CNF" },
      { origin: "CNF", destination: "SSA" },
    ];
    expect(getRouteLabel(slices)).toEqual({ origin: "GRU", destination: "SSA" });
  });
});

describe("formatBaggageSummary", () => {
  it("summarizes carry-on always included plus checked bag count", () => {
    expect(formatBaggageSummary([buildSegment()])).toBe(
      "Mochila incluída · Mala de mão incluída · Despachada 1× 23kg"
    );
  });

  it("says despachada não incluída when no segment has checked baggage", () => {
    const segment = buildSegment({ baggages: [{ type: "carry_on", quantity: 1 }] });
    expect(formatBaggageSummary([segment])).toBe(
      "Mochila incluída · Mala de mão incluída · Despachada não incluída"
    );
  });
});
