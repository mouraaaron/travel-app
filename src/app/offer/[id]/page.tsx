"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PolicyBadges } from "@/components/trip/policy-badges";
import { formatCurrency, formatDuration, formatTimeRange } from "@/lib/offer-format";
import { evaluateDuffelOffer } from "@/lib/policy";
import { useTripFlow } from "@/lib/trip-flow-store";

export default function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { offers, selectOffer } = useTripFlow();
  const offer = offers.find((o) => o.id === id);

  if (!offer) {
    return (
      <div className="mx-auto max-w-[1080px]">
        <EmptyState
          title="Oferta não encontrada"
          description="Ela pode ter expirado, ou a busca ainda não foi refeita nesta sessão."
          button={{ label: "Voltar aos resultados", onClick: () => router.push("/results") }}
        />
      </div>
    );
  }

  const evaluation = evaluateDuffelOffer(offer);
  const expiresInMinutes = offer.expiresAt
    ? Math.round((new Date(offer.expiresAt).getTime() - Date.now()) / 60000)
    : null;
  const expiringSoon = expiresInMinutes !== null && expiresInMinutes < 5;
  const isExpired = expiresInMinutes !== null && expiresInMinutes <= 0;

  function handleSelectOffer() {
    if (!offer) return;
    selectOffer(offer.id);
    router.push(`/request/passengers/${offer.id}`);
  }

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6">
      <button
        type="button"
        onClick={() => router.push("/results")}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar aos resultados
      </button>

      {expiringSoon ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Esta oferta {isExpired ? "expirou" : "está expirando"}.{" "}
          {isExpired
            ? "Volte aos resultados para buscar novamente."
            : "Selecione rápido para garantir o preço."}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          {(offer.slices ?? []).map((slice, sliceIndex) => (
            <Card key={slice.id}>
              <CardContent className="flex flex-col gap-4 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">
                    {sliceIndex === 0 ? "Ida" : "Volta"} — {slice.origin} → {slice.destination}
                  </h2>
                  <span className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">
                    {slice.fare_brand_name}
                  </span>
                </div>
                <div className="flex flex-col gap-4 border-l-2 border-border pl-4">
                  {slice.segments.map((segment, segmentIndex) => (
                    <div key={segment.id} className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-foreground">
                        {formatTimeRange(segment.departing_at, segment.arriving_at)} ·{" "}
                        {segment.origin.name} → {segment.destination.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {segment.marketing_carrier.name} {segment.marketing_carrier_flight_number} ·{" "}
                        {segment.aircraft.name} · {formatDuration(segment.duration)}
                        {segment.operating_carrier.iata_code !== segment.marketing_carrier.iata_code
                          ? ` · operado por ${segment.operating_carrier.name}`
                          : ""}
                      </p>
                      {segmentIndex < slice.segments.length - 1 ? (
                        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                          Conexão em {segment.destination.iata_code} — aguarde a próxima etapa do
                          trecho
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardContent className="flex flex-col gap-3 p-6 text-sm">
              <h2 className="text-base font-semibold text-foreground">Condições da tarifa</h2>
              <p>
                Reembolsável antes da partida:{" "}
                {offer.conditions?.refund_before_departure.allowed ? "Sim" : "Não"}
                {offer.conditions?.refund_before_departure.allowed &&
                offer.conditions?.refund_before_departure.penalty_amount
                  ? ` (penalidade de ${formatCurrency(
                      Number(offer.conditions.refund_before_departure.penalty_amount),
                      offer.conditions.refund_before_departure.penalty_currency ?? "BRL"
                    )})`
                  : ""}
              </p>
              <p>
                Alterável antes da partida:{" "}
                {offer.conditions?.change_before_departure.allowed ? "Sim" : "Não"}
                {offer.conditions?.change_before_departure.allowed &&
                offer.conditions?.change_before_departure.penalty_amount
                  ? ` (penalidade de ${formatCurrency(
                      Number(offer.conditions.change_before_departure.penalty_amount),
                      offer.conditions.change_before_departure.penalty_currency ?? "BRL"
                    )})`
                  : ""}
              </p>
              <p>Emissões estimadas: {offer.totalEmissionsKg ?? 0} kg CO₂</p>
            </CardContent>
          </Card>

          {offer.availableServices && offer.availableServices.length > 0 ? (
            <Card>
              <CardContent className="flex flex-col gap-2 p-6 text-sm">
                <h2 className="text-base font-semibold text-foreground">Serviços disponíveis</h2>
                <p className="text-xs text-muted-foreground">
                  Apenas informativo nesta fase — a compra de serviços extras não está disponível.
                </p>
                {offer.availableServices.map((service, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span>{service.title}</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(Number(service.total_amount), service.total_currency)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="h-fit lg:sticky lg:top-20">
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: offer.owner?.brand_color ?? "#9f3f14" }}
              >
                {offer.owner?.iata_code}
              </span>
              <span className="text-sm font-medium text-foreground">{offer.airline}</span>
            </div>
            <PolicyBadges evaluation={evaluation} />
            <div>
              <p className="text-xs text-muted-foreground">Total para 1 passageiro</p>
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrency(offer.totalAmount, offer.currency)}
              </p>
            </div>
            {expiresInMinutes !== null && expiresInMinutes > 0 ? (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Preço garantido por mais {expiresInMinutes} min
              </p>
            ) : null}
            <Button
              className="w-full bg-brand-gradient hover:bg-brand-gradient-hover"
              disabled={isExpired}
              onClick={handleSelectOffer}
            >
              Selecionar oferta
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
