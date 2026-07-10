"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PencilLine, SearchX, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { OfferCard } from "@/components/trip/offer-card";
import { generateOffers } from "@/lib/mock-data";
import { formatDate } from "@/lib/offer-format";
import { evaluateDuffelOffer } from "@/lib/policy";
import { useTripFlow } from "@/lib/trip-flow-store";
import type { FlightOffer } from "@/lib/types";

type SortKey = "price" | "duration" | "departure";

const CABIN_LABELS: Record<string, string> = {
  economy: "Econômica",
  premium_economy: "Premium Econômica",
  business: "Executiva",
  first: "Primeira",
};

interface FiltersPanelProps {
  sortKey: SortKey;
  onSortKeyChange: (key: SortKey) => void;
  carriers: string[];
  carrierFilter: Set<string>;
  onCarrierFilterChange: (next: Set<string>) => void;
  priceCeiling: number;
  effectiveMaxPrice: number;
  onMaxPriceChange: (value: number) => void;
  onlyInPolicy: boolean;
  onOnlyInPolicyChange: (value: boolean) => void;
}

function FiltersPanel({
  sortKey,
  onSortKeyChange,
  carriers,
  carrierFilter,
  onCarrierFilterChange,
  priceCeiling,
  effectiveMaxPrice,
  onMaxPriceChange,
  onlyInPolicy,
  onOnlyInPolicyChange,
}: FiltersPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Ordenar por</p>
        <div className="flex flex-col gap-1.5 text-sm">
          {(["price", "duration", "departure"] as const).map((key) => (
            <label key={key} className="flex items-center gap-2">
              <input type="radio" name="sort" checked={sortKey === key} onChange={() => onSortKeyChange(key)} />
              {key === "price" ? "Preço" : key === "duration" ? "Duração" : "Horário de partida"}
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Companhias</p>
        <div className="flex flex-col gap-1.5 text-sm">
          {carriers.map((carrier) => (
            <label key={carrier} className="flex items-center gap-2">
              <Checkbox
                checked={carrierFilter.size === 0 || carrierFilter.has(carrier)}
                onCheckedChange={(checked) => {
                  const next = new Set(carrierFilter.size === 0 ? carriers : carrierFilter);
                  if (checked) next.add(carrier);
                  else next.delete(carrier);
                  onCarrierFilterChange(next);
                }}
              />
              {carrier}
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Preço até</p>
        <Slider
          min={0}
          max={priceCeiling || 1}
          step={50}
          value={[effectiveMaxPrice]}
          onValueChange={([value]) => onMaxPriceChange(value)}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="only-in-policy" className="text-sm">
          Somente dentro da política
        </Label>
        <Switch id="only-in-policy" checked={onlyInPolicy} onCheckedChange={onOnlyInPolicyChange} />
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const { criteria, offers, loadingOffers, setOffers, startLoadingOffers, selectOffer } = useTripFlow();

  const [sortKey, setSortKey] = useState<SortKey>("price");
  const [carrierFilter, setCarrierFilter] = useState<Set<string>>(new Set());
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [onlyInPolicy, setOnlyInPolicy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!criteria) return;
    startLoadingOffers();
    const timeout = setTimeout(() => {
      setOffers(generateOffers(criteria));
    }, 1200);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria]);

  const carriers = useMemo(() => Array.from(new Set(offers.map((o) => o.airline))), [offers]);
  const priceCeiling = useMemo(() => offers.reduce((max, o) => Math.max(max, o.totalAmount), 0), [offers]);
  const effectiveMaxPrice = maxPrice ?? priceCeiling;

  const filtered = useMemo(() => {
    let list = offers;
    if (carrierFilter.size > 0) list = list.filter((o) => carrierFilter.has(o.airline));
    list = list.filter((o) => o.totalAmount <= effectiveMaxPrice);
    if (onlyInPolicy) list = list.filter((o) => evaluateDuffelOffer(o).compliant);

    return [...list].sort((a, b) => {
      if (sortKey === "price") return a.totalAmount - b.totalAmount;
      if (sortKey === "duration") return (a.longestSegmentHours ?? 0) - (b.longestSegmentHours ?? 0);
      return new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime();
    });
  }, [offers, carrierFilter, effectiveMaxPrice, onlyInPolicy, sortKey]);

  const expiringSoon = offers.some(
    (o) => o.expiresAt && new Date(o.expiresAt).getTime() - Date.now() < 10 * 60 * 1000
  );

  if (!criteria) {
    return (
      <div className="mx-auto max-w-[1080px]">
        <EmptyState
          title="Nenhuma busca informada"
          description="Volte para a busca e informe origem, destino e datas."
          button={{ label: "Editar busca", onClick: () => router.push("/") }}
        />
      </div>
    );
  }

  const firstSlice = criteria.slices[0];
  const lastSlice = criteria.slices[criteria.slices.length - 1];
  const passengerCount = criteria.passengers.length;

  function handleSelect(offer: FlightOffer) {
    selectOffer(offer.id);
    router.push(`/request/passengers/${offer.id}`);
  }

  function handleViewDetails(offer: FlightOffer) {
    selectOffer(offer.id);
    router.push(`/offer/${offer.id}`);
  }

  const filtersPanelProps: FiltersPanelProps = {
    sortKey,
    onSortKeyChange: setSortKey,
    carriers,
    carrierFilter,
    onCarrierFilterChange: setCarrierFilter,
    priceCeiling,
    effectiveMaxPrice,
    onMaxPriceChange: setMaxPrice,
    onlyInPolicy,
    onOnlyInPolicyChange: setOnlyInPolicy,
  };

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {firstSlice.origin} → {lastSlice.destination}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(firstSlice.departure_date)}
            {criteria.slices.length > 1 ? ` — ${formatDate(lastSlice.departure_date)}` : ""} ·{" "}
            {passengerCount} passageiro{passengerCount > 1 ? "s" : ""} · {CABIN_LABELS[criteria.cabin_class]}
          </p>
        </div>
        <Button variant="secondary" onClick={() => router.push("/")}>
          <PencilLine className="mr-1.5 h-4 w-4" /> Editar busca
        </Button>
      </div>

      {expiringSoon ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Algumas ofertas expiram em breve. Preços podem mudar após a expiração.
        </div>
      ) : null}

      <div className="lg:hidden">
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <SlidersHorizontal className="mr-1.5 h-4 w-4" /> Filtros
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <FiltersPanel {...filtersPanelProps} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[224px_1fr]">
        <aside className="hidden lg:sticky lg:top-20 lg:flex lg:h-fit lg:flex-col">
          <FiltersPanel {...filtersPanelProps} />
        </aside>

        <div className="flex flex-col gap-3.5">
          {loadingOffers ? (
            Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Nenhuma oferta encontrada"
              description="Tente ajustar as datas ou a cidade."
              button={{ label: "Editar busca", onClick: () => router.push("/"), hierarchy: "secondary" }}
            />
          ) : (
            filtered.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                onSelect={() => handleSelect(offer)}
                onViewDetails={() => handleViewDetails(offer)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
