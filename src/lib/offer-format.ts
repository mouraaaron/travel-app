import type { Offer } from "./types";

export function offerTitle(offer: Offer): string {
  return offer.mode === "flight"
    ? `${offer.airline} · ${offer.origin} → ${offer.destination}`
    : `${offer.hotelName} · ${offer.city}`;
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(iso));
}
