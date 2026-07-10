import type { Offer, OfferSegment } from "./types";

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

export function formatDuration(iso: string): string {
  const match = /PT(\d+)H(\d+)M/.exec(iso);
  if (!match) return iso;
  const hours = match[1];
  const minutes = match[2].padStart(2, "0");
  return `${hours}h ${minutes}min`;
}

export function formatTimeRange(departingAt: string, arrivingAt: string): string {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(departingAt))} → ${formatter.format(new Date(arrivingAt))}`;
}

function segmentDurationHours(segment: OfferSegment): number {
  const match = /PT(\d+)H(\d+)M/.exec(segment.duration);
  return match ? Number(match[1]) + Number(match[2]) / 60 : 0;
}

export function formatStopsLabel(segments: OfferSegment[]): string {
  if (segments.length <= 1) return "Direto";
  if (segments.length === 2) {
    const layoverAirport = segments[0].destination.iata_code;
    const layoverMs =
      new Date(segments[1].departing_at).getTime() - new Date(segments[0].arriving_at).getTime();
    const layoverHours = layoverMs / (1000 * 60 * 60);
    const wholeHours = Math.floor(layoverHours);
    const minutes = Math.round((layoverHours - wholeHours) * 60);
    return `1 escala em ${layoverAirport} (${wholeHours}h ${minutes.toString().padStart(2, "0")}min)`;
  }
  return `${segments.length - 1} escalas`;
}

export function formatBaggageSummary(segments: OfferSegment[]): string {
  const checkedCount = segments.reduce((max, segment) => {
    const checked = segment.baggages.find((b) => b.type === "checked");
    return Math.max(max, checked?.quantity ?? 0);
  }, 0);
  const checkedLabel = checkedCount > 0 ? `Despachada ${checkedCount}× 23kg` : "Despachada não incluída";
  return `Mochila incluída · Mala de mão incluída · ${checkedLabel}`;
}
