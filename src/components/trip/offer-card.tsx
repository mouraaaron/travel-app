"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PolicyBadges } from "@/components/trip/policy-badges";
import type { Offer, PolicyEvaluation } from "@/lib/types";

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(iso));
}

export function OfferCard({
  offer,
  evaluation,
  onSelect,
}: {
  offer: Offer;
  evaluation: PolicyEvaluation;
  onSelect: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {offer.mode === "flight"
            ? `${offer.airline} · ${offer.origin} → ${offer.destination}`
            : `${offer.hotelName} · ${offer.city}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {offer.mode === "flight" ? (
          <p className="text-sm text-muted-foreground">
            {formatDate(offer.departureAt)}
            {offer.returnAt ? ` — ${formatDate(offer.returnAt)}` : ""} ·{" "}
            {offer.cabinClass.replace("_", " ")} ·{" "}
            {offer.stops === 0 ? "Direto" : `${offer.stops} parada(s)`}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {formatDate(offer.checkIn)} — {formatDate(offer.checkOut)} ·{" "}
            {offer.starRating} estrelas
          </p>
        )}
        <p className="text-lg font-semibold">
          {formatCurrency(offer.totalAmount, offer.currency)}
        </p>
        <PolicyBadges evaluation={evaluation} />
      </CardContent>
      <CardFooter>
        <Button
          onClick={onSelect}
          className="bg-brand-gradient hover:bg-brand-gradient-hover text-white"
        >
          Solicitar
        </Button>
      </CardFooter>
    </Card>
  );
}
