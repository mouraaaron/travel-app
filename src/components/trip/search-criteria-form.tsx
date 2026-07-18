"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CityAirportCombobox } from "@/components/trip/city-airport-combobox";
import { TripDatesPopover } from "@/components/trip/trip-dates-popover";
import { parseFormDate } from "@/components/trip/trip-dates-popover-utils";
import { WizardStepper } from "@/components/trip/wizard-stepper";
import { tripSearchSchema, tripSearchToCriteria, type TripSearchFormValues } from "@/lib/search-schema";
import { useTripFlow } from "@/lib/trip-flow-store";

const TODAY = new Date().toISOString().slice(0, 10);

const DEFAULT_VALUES: TripSearchFormValues = {
  tripType: "round_trip",
  slices: [{ origin: "", destination: "", departureDate: "" }],
  returnDate: "",
  adults: 1,
  children: 0,
  infants: 0,
  cabinClass: "economy",
  maxConnections: 1,
  arriveByOutboundEnabled: false,
  arriveByOutboundTime: "",
  departAfterReturnEnabled: false,
  departAfterReturnTime: "",
};

function CounterStepper({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="w-4 text-center text-sm font-medium">{value}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onChange(value + 1)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function SearchCriteriaForm() {
  const router = useRouter();
  const { setCriteria } = useTripFlow();
  const [isPending, startTransition] = useTransition();
  const form = useForm<TripSearchFormValues>({
    // zodResolver's generics resolve the pre-coercion input type of the
    // `z.coerce.number()` fields (adults/children/infants) as `unknown`, which
    // otherwise conflicts with `TripSearchFormValues`'s post-coercion `number`.
    // Casting to the form value type mirrors the pattern in flight-criteria-step.
    resolver: zodResolver(tripSearchSchema) as Resolver<TripSearchFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "slices" });
  const tripType = form.watch("tripType");
  const adults = form.watch("adults");
  const children = form.watch("children");
  const infants = form.watch("infants");
  const totalPassengers = adults + children + infants;
  const arriveByOutboundEnabled = form.watch("arriveByOutboundEnabled");
  const departAfterReturnEnabled = form.watch("departAfterReturnEnabled");

  function onSubmit(values: TripSearchFormValues) {
    startTransition(() => {
      setCriteria(tripSearchToCriteria(values));
      router.push("/results");
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-[688px] flex-col gap-6">
      <WizardStepper current="criteria" />
      <Card>
        <CardContent className="flex flex-col gap-6 p-8">
          <h1 className="text-2xl font-semibold text-foreground">Nova viagem</h1>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
              <FormField
                control={form.control}
                name="tripType"
                render={({ field }) => (
                  <FormItem>
                    <ToggleGroup
                      type="single"
                      pill
                      value={field.value}
                      onValueChange={(next) => {
                        if (!next) return;
                        field.onChange(next);
                        if (next !== "multi_city") {
                          const first = form.getValues("slices")[0];
                          form.setValue("slices", [first]);
                        }
                      }}
                      className="justify-start"
                    >
                      <ToggleGroupItem value="round_trip">Ida e volta</ToggleGroupItem>
                      <ToggleGroupItem value="one_way">Só ida</ToggleGroupItem>
                      <ToggleGroupItem value="multi_city">Multi-cidade</ToggleGroupItem>
                    </ToggleGroup>
                  </FormItem>
                )}
              />

              {fields.map((field, index) => (
                <div key={field.id} className="flex flex-col gap-3">
                  {tripType === "multi_city" ? (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Trecho {index + 1}</span>
                      {index > 0 ? (
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(index)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name={`slices.${index}.origin`}
                      render={({ field: originField }) => (
                        <FormItem>
                          <FormControl>
                            <CityAirportCombobox
                              value={originField.value}
                              onChange={originField.onChange}
                              label="De onde você sai?"
                              placeholder="Cidade ou aeroporto"
                              autoFocus={index === 0}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`slices.${index}.destination`}
                      render={({ field: destinationField }) => (
                        <FormItem>
                          <FormControl>
                            <CityAirportCombobox
                              value={destinationField.value}
                              onChange={destinationField.onChange}
                              label="Para onde?"
                              placeholder="Cidade ou aeroporto"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {tripType === "multi_city" ? (
                      <FormField
                        control={form.control}
                        name={`slices.${index}.departureDate`}
                        render={({ field: dateField }) => (
                          <FormItem>
                            <FormLabel>Data de ida</FormLabel>
                            <FormControl>
                              <TripDatesPopover
                                mode="single"
                                date={dateField.value}
                                onChange={dateField.onChange}
                                minDate={
                                  parseFormDate(
                                    index === 0
                                      ? TODAY
                                      : form.watch(`slices.${index - 1}.departureDate`) || TODAY
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <FormItem>
                        <Label>{tripType === "round_trip" ? "Ida e volta" : "Data de ida"}</Label>
                        <TripDatesPopover
                          mode="range"
                          departureDate={form.watch(`slices.${index}.departureDate`)}
                          returnDate={tripType === "round_trip" ? form.watch("returnDate") : undefined}
                          onChangeDeparture={(value) =>
                            form.setValue(`slices.${index}.departureDate`, value, { shouldValidate: true })
                          }
                          onChangeReturn={(value) =>
                            form.setValue("returnDate", value ?? "", { shouldValidate: true })
                          }
                          minDate={parseFormDate(TODAY)}
                          allowRange={tripType === "round_trip"}
                        />
                        {form.formState.errors.slices?.[index]?.departureDate?.message ? (
                          <p className="text-xs text-destructive">
                            {form.formState.errors.slices[index]?.departureDate?.message}
                          </p>
                        ) : null}
                        {tripType === "round_trip" && form.formState.errors.returnDate?.message ? (
                          <p className="text-xs text-destructive">{form.formState.errors.returnDate.message}</p>
                        ) : null}
                      </FormItem>
                    )}
                  </div>
                </div>
              ))}

              {tripType === "multi_city" && fields.length < 4 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="self-start"
                  onClick={() => append({ origin: "", destination: "", departureDate: "" })}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Trecho
                </Button>
              ) : null}

              <div className="flex flex-col gap-2">
                <CounterStepper
                  label="Passageiros"
                  value={totalPassengers}
                  min={1}
                  onChange={(next) =>
                    form.setValue("adults", Math.max(1, next > totalPassengers ? adults + 1 : adults - 1))
                  }
                />
                <details className="text-sm">
                  <summary className="cursor-pointer text-primary">Detalhar tipos</summary>
                  <div className="mt-3 flex flex-col gap-2">
                    <CounterStepper label="Adultos" value={adults} min={1} onChange={(v) => form.setValue("adults", v)} />
                    <CounterStepper
                      label="Crianças (2–11)"
                      value={children}
                      min={0}
                      onChange={(v) => form.setValue("children", v)}
                    />
                    <CounterStepper
                      label="Bebês (colo)"
                      value={infants}
                      min={0}
                      onChange={(v) => form.setValue("infants", v)}
                    />
                    {infants > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Cada bebê precisa de exatamente um adulto responsável (definido na tela de passageiros).
                      </p>
                    ) : null}
                  </div>
                </details>
                {form.formState.errors.adults?.message ? (
                  <p className="text-xs text-destructive">{form.formState.errors.adults.message}</p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="cabinClass"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Classe de cabine</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="economy">Econômica</SelectItem>
                          <SelectItem value="premium_economy">Premium Econômica</SelectItem>
                          <SelectItem value="business">Executiva</SelectItem>
                          <SelectItem value="first">Primeira</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxConnections"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Escalas máximas</FormLabel>
                      <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">Sem escalas</SelectItem>
                          <SelectItem value="1">Até 1 escala</SelectItem>
                          <SelectItem value="2">Até 2 escalas</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <details className="rounded-md border border-border p-4 text-sm">
                <summary className="cursor-pointer font-medium text-foreground">Preferências</summary>
                <div className="mt-4 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="arrive-by-outbound"
                      checked={arriveByOutboundEnabled}
                      onCheckedChange={(checked) => form.setValue("arriveByOutboundEnabled", Boolean(checked))}
                    />
                    <Label htmlFor="arrive-by-outbound">Chegar até um horário (ida)</Label>
                    {arriveByOutboundEnabled ? (
                      <Input
                        type="time"
                        className="w-32"
                        {...form.register("arriveByOutboundTime")}
                      />
                    ) : null}
                  </div>
                  {tripType === "round_trip" ? (
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="depart-after-return"
                        checked={departAfterReturnEnabled}
                        onCheckedChange={(checked) => form.setValue("departAfterReturnEnabled", Boolean(checked))}
                      />
                      <Label htmlFor="depart-after-return">Sair a partir de um horário (volta)</Label>
                      {departAfterReturnEnabled ? (
                        <Input
                          type="time"
                          className="w-32"
                          {...form.register("departAfterReturnTime")}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </details>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="lg"
                  loading={isPending}
                  className="bg-brand-gradient hover:bg-brand-gradient-hover"
                >
                  Buscar ofertas
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
