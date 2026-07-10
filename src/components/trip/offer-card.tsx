"use client";

import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDuffelFlagBadges, getDuffelPolicyBadge } from "@/lib/badge-variants";
import {
  formatBaggageSummary,
  formatCurrency,
  formatDuration,
  formatStopsLabel,
  formatTimeRange,
} from "@/lib/offer-format";
import { evaluateDuffelOffer } from "@/lib/policy";
import type { FlightOffer } from "@/lib/types";

function sliceLabel(index: number, total: number): string {
  if (total <= 1) return "Trecho único";
  if (index === 0) return "Ida";
  if (index === 1 && total === 2) return "Volta";
  return `Trecho ${index + 1}`;
}

export function OfferCard({
  offer,
  onSelect,
  onViewDetails,
}: {
  offer: FlightOffer;
  onSelect: () => void;
  onViewDetails: () => void;
}) {
  const evaluation = evaluateDuffelOffer(offer);
  const policyBadge = getDuffelPolicyBadge(evaluation);
  const flagBadges = getDuffelFlagBadges(evaluation);
  const slices = offer.slices ?? [];
  const expiresInMinutes = offer.expiresAt
    ? Math.round((new Date(offer.expiresAt).getTime() - Date.now()) / 60000)
    : null;
  const expiringSoon = expiresInMinutes !== null && expiresInMinutes < 10;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: offer.owner?.brand_color ?? "#9f3f14" }}
            >
              {offer.owner?.iata_code ?? offer.airline.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{offer.airline}</p>
              <p className="text-xs text-muted-foreground">Tarifa {offer.fareBrandName ?? "Light"}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-1.5">
              <Badge variant={policyBadge.variant}>{policyBadge.label}</Badge>
              {flagBadges.map((badge) => (
                <Badge key={badge.label} variant={badge.variant}>
                  {badge.label}
                </Badge>
              ))}
            </div>
            <p className="text-xl font-semibold text-foreground">
              {formatCurrency(offer.totalAmount, offer.currency)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-y border-border py-3">
          {slices.map((slice, index) => (
            <div key={slice.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="w-16 shrink-0 font-medium text-muted-foreground">
                {sliceLabel(index, slices.length)}
              </span>
              <span className="flex-1">
                {formatTimeRange(
                  slice.segments[0].departing_at,
                  slice.segments[slice.segments.length - 1].arriving_at
                )}
                {"  ·  "}
                {slice.origin} → {slice.destination}
                {"  ·  "}
                {formatDuration(slice.duration)}
              </span>
              <span className="shrink-0 text-muted-foreground">{formatStopsLabel(slice.segments)}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>{formatBaggageSummary(slices[0]?.segments ?? [])}</span>
            {expiringSoon ? (
              <span className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                <Clock className="h-3.5 w-3.5" /> Expira em {Math.max(expiresInMinutes ?? 0, 0)} min
              </span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onViewDetails}>
              Ver detalhes
            </Button>
            <Button type="button" className="bg-brand-gradient hover:bg-brand-gradient-hover" onClick={onSelect}>
              Selecionar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
