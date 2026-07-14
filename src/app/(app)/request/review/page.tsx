"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WizardStepper } from "@/components/trip/wizard-stepper";
import {
  TRIP_PURPOSE_LABELS,
  corporateContextSchema,
  type CorporateContextFormValues,
} from "@/lib/corporate-schema";
import { formatCurrency, formatDate } from "@/lib/offer-format";
import { evaluateDuffelOffer, DUFFEL_POLICY_DEFAULTS, type DuffelPolicyDefaults } from "@/lib/policy";
import { useTripFlow } from "@/lib/trip-flow-store";

export default function ReviewPage() {
  const router = useRouter();
  const { criteria, selectedOffer: offer, passengers, corporate, reset } = useTripFlow();
  const [policyDefaults, setPolicyDefaults] = useState<DuffelPolicyDefaults>(DUFFEL_POLICY_DEFAULTS);
  const [policyLoaded, setPolicyLoaded] = useState(false);
  const evaluation = offer ? evaluateDuffelOffer(offer, policyDefaults) : null;
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/policy/me")
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled && body?.defaults) setPolicyDefaults(body.defaults);
      })
      .finally(() => {
        if (!cancelled) setPolicyLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const form = useForm<CorporateContextFormValues>({
    resolver: zodResolver(corporateContextSchema),
    defaultValues: {
      trip_purpose: corporate?.trip_purpose ?? "client_meeting",
      project_code: corporate?.project_code ?? "",
      business_justification: corporate?.business_justification ?? "",
      isOutOfPolicy: evaluation ? !evaluation.compliant : false,
      out_of_policy_justification: corporate?.out_of_policy_justification ?? "",
    },
  });

  if (!criteria || !offer || !passengers || !evaluation) {
    return (
      <div className="mx-auto max-w-[760px]">
        <EmptyState
          title="Revise as etapas anteriores"
          description="Faltam dados da oferta ou dos passageiros para revisar esta solicitação."
          button={{ label: "Voltar à busca", onClick: () => router.push("/") }}
        />
      </div>
    );
  }

  async function onSubmit(values: CorporateContextFormValues) {
    if (!criteria || !offer || !passengers || !evaluation) return;
    const now = new Date().toISOString();

    const payload = {
      search_criteria: criteria,
      selected_offer_snapshot: {
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
      },
      passengers,
      corporate: {
        trip_purpose: values.trip_purpose,
        project_code: values.project_code || undefined,
        business_justification: values.business_justification,
        out_of_policy_justification: values.isOutOfPolicy ? values.out_of_policy_justification : undefined,
      },
      policy_evaluation: {
        compliant: evaluation.compliant,
        violations: evaluation.violations,
        flags: evaluation.flags,
      },
      events: [{ at: now, kind: "created" }],
    };

    setSubmitting(true);
    const response = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      toast.error(body.error ?? "Não foi possível enviar a solicitação.");
      return;
    }

    reset();
    toast.success("Solicitação enviada. Aguardando aprovação do Travel Admin.");
    router.push(`/requests/${body.request.id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <WizardStepper current="review" />
      <h1 className="text-2xl font-semibold text-foreground">Revisar e enviar</h1>

      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Viagem selecionada</h2>
            <button
              type="button"
              onClick={() => router.push("/results")}
              className="text-sm font-medium text-primary hover:underline"
            >
              trocar oferta
            </button>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium text-foreground">
                {offer.origin} → {offer.destination} {offer.returnAt ? "(ida e volta)" : ""}
              </p>
              <p className="text-muted-foreground">
                {offer.airline} · {formatDate(offer.departureAt)}
                {offer.returnAt ? ` – ${formatDate(offer.returnAt)}` : ""} · {offer.cabinClass}
              </p>
            </div>
            <p className="font-semibold text-foreground">{formatCurrency(offer.totalAmount, offer.currency)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Passageiros</h2>
            <button
              type="button"
              onClick={() => router.push(`/request/passengers/${offer.id}`)}
              className="text-sm font-medium text-primary hover:underline"
            >
              editar
            </button>
          </div>
          {passengers.map((passenger) => (
            <div key={passenger.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">
                {passenger.given_name} {passenger.family_name}{" "}
                <span className="text-muted-foreground">
                  · {passenger.type === "adult" ? "Adulto" : passenger.type === "child" ? "Criança" : "Bebê"}
                </span>
              </span>
              <span className="text-muted-foreground">{formatDate(passenger.born_on)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-4 p-6">
              <h2 className="text-base font-semibold text-foreground">Contexto corporativo</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="trip_purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motivo da viagem</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(TRIP_PURPOSE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="project_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código do projeto (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: WEBSUMMIT" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="business_justification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Justificativa corporativa</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!evaluation.compliant ? (
                <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Esta oferta está fora da política corporativa:
                  </p>
                  <ul className="list-disc pl-4 text-sm text-amber-800 dark:text-amber-300">
                    {evaluation.violations.map((violation) => (
                      <li key={violation.rule_id}>{violation.message}</li>
                    ))}
                  </ul>
                  <FormField
                    control={form.control}
                    name="out_of_policy_justification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Justificativa fora de política</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="Descreva por que você precisa dela." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Ao enviar, você declara que os dados dos passageiros estão corretos. A viagem só é confirmada
                após aprovação do Travel Admin. Preços e disponibilidade podem mudar entre a solicitação e a
                reserva final.
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button type="button" variant="link" onClick={() => router.push(`/request/passengers/${offer.id}`)}>
              Voltar
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={submitting || !policyLoaded}
              className="bg-brand-gradient hover:bg-brand-gradient-hover"
            >
              {submitting ? "Enviando..." : !policyLoaded ? "Carregando política..." : "Enviar solicitação"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
