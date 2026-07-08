import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, offerTitle } from "./offer-format";
import type { FlightOffer, StayOffer } from "./types";

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
      new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
        new Date("2026-08-10T22:30:00.000Z")
      )
    );
  });
});
