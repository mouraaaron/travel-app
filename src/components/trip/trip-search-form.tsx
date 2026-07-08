"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  flightSearchSchema,
  staySearchSchema,
  type FlightSearchFormValues,
  type StaySearchFormValues,
} from "@/lib/search-schema";

const FLIGHT_DEFAULTS: FlightSearchFormValues = {
  mode: "flight",
  origin: "",
  destination: "",
  departureAt: "",
  returnAt: "",
  cabinClass: "economy",
};

const STAY_DEFAULTS: StaySearchFormValues = {
  mode: "stay",
  city: "",
  checkIn: "",
  checkOut: "",
};

function FlightSearchFields() {
  const router = useRouter();
  const form = useForm<FlightSearchFormValues>({
    resolver: zodResolver(flightSearchSchema),
    defaultValues: FLIGHT_DEFAULTS,
  });

  function onSubmit(values: FlightSearchFormValues) {
    const query = new URLSearchParams({
      mode: "flight",
      origin: values.origin.toUpperCase(),
      destination: values.destination.toUpperCase(),
      departureAt: values.departureAt,
      returnAt: values.returnAt ?? "",
      cabinClass: values.cabinClass,
    });
    router.push(`/search/results?${query.toString()}`);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="origin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Origem (IATA)</FormLabel>
              <FormControl>
                <Input placeholder="GRU" maxLength={3} {...field} />
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
              <FormLabel>Destino (IATA)</FormLabel>
              <FormControl>
                <Input placeholder="JFK" maxLength={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
        <div className="flex items-end sm:col-span-2">
          <Button type="submit" className="bg-brand-gradient hover:bg-brand-gradient-hover text-white">
            Buscar passagens
          </Button>
        </div>
      </form>
    </Form>
  );
}

function StaySearchFields() {
  const router = useRouter();
  const form = useForm<StaySearchFormValues>({
    resolver: zodResolver(staySearchSchema),
    defaultValues: STAY_DEFAULTS,
  });

  function onSubmit(values: StaySearchFormValues) {
    const query = new URLSearchParams({
      mode: "stay",
      city: values.city,
      checkIn: values.checkIn,
      checkOut: values.checkOut,
    });
    router.push(`/search/results?${query.toString()}`);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Cidade</FormLabel>
              <FormControl>
                <Input placeholder="Rio de Janeiro" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="checkIn"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Check-in</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="checkOut"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Check-out</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-end sm:col-span-2">
          <Button type="submit" className="bg-brand-gradient hover:bg-brand-gradient-hover text-white">
            Buscar hospedagem
          </Button>
        </div>
      </form>
    </Form>
  );
}

export function TripSearchForm() {
  const [mode, setMode] = useState<"flight" | "stay">("flight");

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={mode} onValueChange={(value) => setMode(value as "flight" | "stay")}>
        <TabsList>
          <TabsTrigger value="flight">Passagens</TabsTrigger>
          <TabsTrigger value="stay">Hospedagem</TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === "flight" ? <FlightSearchFields /> : <StaySearchFields />}
    </div>
  );
}
