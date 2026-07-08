"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";
import { OfferCard } from "@/components/trip/offer-card";
import { JustificationDialog } from "@/components/trip/justification-dialog";
import { evaluateOffer } from "@/lib/policy";
import { MOCK_OFFERS, ORGANIZATION_POLICY } from "@/lib/mock-data";
import { searchOffers, type SearchParams } from "@/lib/search-offers";
import { useRequests } from "@/lib/requests-store";
import type { Offer, PolicyEvaluation } from "@/lib/types";

function parseSearchParams(params: URLSearchParams): SearchParams | null {
  const mode = params.get("mode");
  if (mode === "flight") {
    const origin = params.get("origin");
    const destination = params.get("destination");
    if (!origin || !destination) return null;
    return { mode: "flight", origin, destination };
  }
  if (mode === "stay") {
    const city = params.get("city");
    if (!city) return null;
    return { mode: "stay", city };
  }
  return null;
}

function SearchResultsContent() {
  const router = useRouter();
  const rawParams = useSearchParams();
  const { addRequest } = useRequests();
  const [pendingOffer, setPendingOffer] = useState<{
    offer: Offer;
    evaluation: PolicyEvaluation;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const params = useMemo(() => parseSearchParams(rawParams), [rawParams]);

  const results = useMemo(() => {
    if (!params) return [];
    return searchOffers(params, MOCK_OFFERS).map((offer) => ({
      offer,
      evaluation: evaluateOffer(offer, ORGANIZATION_POLICY),
    }));
  }, [params]);

  function submitRequest(offer: Offer, evaluation: PolicyEvaluation, justification?: string) {
    if (submitting) return;
    setSubmitting(true);
    addRequest({
      id: `req-${offer.id}-${offer.mode === "flight" ? offer.departureAt : offer.checkIn}`,
      createdAt: new Date(2026, 6, 8).toISOString(),
      offer,
      evaluation,
      status: "pending_review",
      justification,
    });
    toast.success("Solicitação enviada para aprovação.");
    router.push("/");
  }

  function handleSelect(offer: Offer, evaluation: PolicyEvaluation) {
    if (evaluation.compliant) {
      submitRequest(offer, evaluation);
    } else {
      setPendingOffer({ offer, evaluation });
    }
  }

  if (!params) {
    return (
      <EmptyState
        title="Nenhuma busca informada"
        description="Volte para a busca e informe origem/destino ou uma cidade."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Resultados</h1>
      {results.length === 0 ? (
        <EmptyState title="Nenhuma oferta encontrada" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {results.map(({ offer, evaluation }) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              evaluation={evaluation}
              onSelect={() => handleSelect(offer, evaluation)}
            />
          ))}
        </div>
      )}
      <JustificationDialog
        open={pendingOffer !== null}
        onOpenChange={(open) => {
          if (!open) setPendingOffer(null);
        }}
        onConfirm={(justification) => {
          if (pendingOffer) {
            submitRequest(pendingOffer.offer, pendingOffer.evaluation, justification);
          }
          setPendingOffer(null);
        }}
      />
    </div>
  );
}

export default function SearchResultsPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Carregando resultados...</p>}
    >
      <SearchResultsContent />
    </Suspense>
  );
}
