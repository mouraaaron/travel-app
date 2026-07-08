"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CityAirportCombobox } from "@/components/trip/city-airport-combobox";
import { flightSearchSchema, type FlightSearchFormValues } from "@/lib/search-schema";

export const FLIGHT_CRITERIA_DEFAULTS: FlightSearchFormValues = {
  mode: "flight",
  origin: "",
  destination: "",
  departureAt: "",
  returnAt: "",
  passengerCount: 1,
  cabinClass: "economy",
  latestArrivalEnabled: false,
  latestArrivalTime: "",
  earliestReturnDepartureEnabled: false,
  earliestReturnDepartureTime: "",
};

export function FlightCriteriaStep({
  defaultValues,
  onContinue,
}: {
  defaultValues: FlightSearchFormValues;
  onContinue: (values: FlightSearchFormValues) => void;
}) {
  const form = useForm<FlightSearchFormValues>({
    // zodResolver's generics resolve `passengerCount`'s pre-coercion input
    // type as `unknown` (from `z.coerce.number()`), which otherwise
    // conflicts with `FlightSearchFormValues`'s post-coercion `number`.
    // The cast is type-level only; parsing/coercion behavior is unaffected.
    resolver: zodResolver(flightSearchSchema) as Resolver<FlightSearchFormValues>,
    defaultValues,
  });

  const hasReturn = Boolean(form.watch("returnAt"));
  const latestArrivalEnabled = form.watch("latestArrivalEnabled");
  const earliestReturnDepartureEnabled = form.watch("earliestReturnDepartureEnabled");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buscar Viagem</CardTitle>
        <CardDescription>
          Preencha os detalhes da viagem para ver as passagens disponíveis.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onContinue)} className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="origin"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <CityAirportCombobox
                        label="Origem"
                        placeholder="Digite a cidade de origem"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <CityAirportCombobox
                        label="Destino"
                        placeholder="Digite a cidade de destino"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Janela de viagem</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="departureAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ida</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="returnAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Volta (opcional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="passengerCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de passageiros</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={9} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cabinClass"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Classe</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="economy">Econômica</SelectItem>
                        <SelectItem value="premium_economy">Premium economy</SelectItem>
                        <SelectItem value="business">Executiva</SelectItem>
                        <SelectItem value="first">Primeira classe</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-3 rounded-md border border-dashed border-input p-4">
              <FormField
                control={form.control}
                name="latestArrivalEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Sugerir horário limite de chegada
                    </FormLabel>
                  </FormItem>
                )}
              />
              {latestArrivalEnabled ? (
                <FormField
                  control={form.control}
                  name="latestArrivalTime"
                  render={({ field }) => (
                    <FormItem className="max-w-[200px]">
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {hasReturn ? (
                <>
                  <FormField
                    control={form.control}
                    name="earliestReturnDepartureEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Sugerir horário mínimo de partida na volta
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  {earliestReturnDepartureEnabled ? (
                    <FormField
                      control={form.control}
                      name="earliestReturnDepartureTime"
                      render={({ field }) => (
                        <FormItem className="max-w-[200px]">
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                className="bg-brand-gradient hover:bg-brand-gradient-hover text-white"
              >
                Avançar
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
