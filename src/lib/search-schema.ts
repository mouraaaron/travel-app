import { z } from "zod";
import type { SearchCriteria } from "./types";

export const flightSearchSchema = z
  .object({
    mode: z.literal("flight"),
    origin: z.string().trim().length(3, "Selecione uma origem na lista"),
    destination: z.string().trim().length(3, "Selecione um destino na lista"),
    departureAt: z.string().min(1, "Informe a data de ida"),
    returnAt: z.string().optional(),
    passengerCount: z.coerce
      .number({ error: "Informe o número de passageiros" })
      .int()
      .min(1, "Mínimo 1 passageiro")
      .max(9, "Máximo 9 passageiros"),
    cabinClass: z.enum(["economy", "premium_economy", "business", "first"]),
    latestArrivalEnabled: z.boolean(),
    latestArrivalTime: z.string().optional(),
    earliestReturnDepartureEnabled: z.boolean(),
    earliestReturnDepartureTime: z.string().optional(),
  })
  .refine(
    (data) => data.origin.toUpperCase() !== data.destination.toUpperCase(),
    { message: "Origem e destino não podem ser iguais", path: ["destination"] }
  )
  .refine((data) => !data.returnAt || data.returnAt >= data.departureAt, {
    message: "A volta não pode ser antes da ida",
    path: ["returnAt"],
  })
  .refine((data) => !data.latestArrivalEnabled || Boolean(data.latestArrivalTime), {
    message: "Informe o horário limite de chegada",
    path: ["latestArrivalTime"],
  })
  .refine(
    (data) => !data.earliestReturnDepartureEnabled || Boolean(data.earliestReturnDepartureTime),
    {
      message: "Informe o horário mínimo de partida da volta",
      path: ["earliestReturnDepartureTime"],
    }
  )
  .refine((data) => !data.earliestReturnDepartureEnabled || Boolean(data.returnAt), {
    message: "Defina a data de volta antes de configurar esse horário",
    path: ["earliestReturnDepartureTime"],
  });

export type FlightSearchFormValues = z.infer<typeof flightSearchSchema>;

export const staySearchSchema = z
  .object({
    mode: z.literal("stay"),
    city: z.string().trim().min(2, "Informe a cidade"),
    checkIn: z.string().min(1, "Informe a data de check-in"),
    checkOut: z.string().min(1, "Informe a data de check-out"),
  })
  .refine((data) => data.checkOut > data.checkIn, {
    message: "Check-out deve ser depois do check-in",
    path: ["checkOut"],
  });

export type StaySearchFormValues = z.infer<typeof staySearchSchema>;

export const sliceSchema = z
  .object({
    origin: z.string().trim().length(3, "Selecione uma origem na lista"),
    destination: z.string().trim().length(3, "Selecione um destino na lista"),
    departureDate: z.string().min(1, "Informe a data"),
  })
  .refine((d) => d.origin.toUpperCase() !== d.destination.toUpperCase(), {
    message: "Origem e destino não podem ser iguais",
    path: ["destination"],
  });

export type SliceFormValues = z.infer<typeof sliceSchema>;

export const tripSearchSchema = z
  .object({
    tripType: z.enum(["round_trip", "one_way", "multi_city"]),
    slices: z.array(sliceSchema).min(1, "Informe ao menos um trecho").max(4, "Máximo 4 trechos"),
    returnDate: z.string().optional(),
    adults: z.coerce.number().int().min(1, "Pelo menos 1 adulto é obrigatório"),
    children: z.coerce.number().int().min(0),
    infants: z.coerce.number().int().min(0),
    cabinClass: z.enum(["economy", "premium_economy", "business", "first"]),
    maxConnections: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    arriveByOutboundEnabled: z.boolean(),
    arriveByOutboundTime: z.string().optional(),
    departAfterReturnEnabled: z.boolean(),
    departAfterReturnTime: z.string().optional(),
  })
  .refine((d) => d.adults + d.children + d.infants <= 9, {
    message: "Máximo 9 passageiros no total",
    path: ["adults"],
  })
  .refine((d) => d.tripType !== "round_trip" || Boolean(d.returnDate), {
    message: "Informe a data de volta",
    path: ["returnDate"],
  })
  .refine(
    (d) => !d.returnDate || d.slices.length === 0 || d.returnDate >= d.slices[0].departureDate,
    { message: "A volta não pode ser antes da ida", path: ["returnDate"] }
  )
  .refine((d) => !d.arriveByOutboundEnabled || Boolean(d.arriveByOutboundTime), {
    message: "Informe o horário limite de chegada",
    path: ["arriveByOutboundTime"],
  })
  .refine((d) => !d.departAfterReturnEnabled || Boolean(d.departAfterReturnTime), {
    message: "Informe o horário mínimo de partida da volta",
    path: ["departAfterReturnTime"],
  });

export type TripSearchFormValues = z.infer<typeof tripSearchSchema>;

export function tripSearchToCriteria(values: TripSearchFormValues): SearchCriteria {
  const slices =
    values.tripType === "round_trip"
      ? [
          {
            origin: values.slices[0].origin,
            destination: values.slices[0].destination,
            departure_date: values.slices[0].departureDate,
          },
          {
            origin: values.slices[0].destination,
            destination: values.slices[0].origin,
            departure_date: values.returnDate ?? values.slices[0].departureDate,
          },
        ]
      : values.slices.map((slice) => ({
          origin: slice.origin,
          destination: slice.destination,
          departure_date: slice.departureDate,
        }));

  const passengers = [
    ...Array.from({ length: values.adults }, () => ({ type: "adult" as const })),
    ...Array.from({ length: values.children }, () => ({ type: "child" as const })),
    ...Array.from({ length: values.infants }, () => ({ type: "infant_without_seat" as const })),
  ];

  const preferences: SearchCriteria["preferences"] = {};
  if (values.arriveByOutboundEnabled && values.arriveByOutboundTime) {
    preferences.arrive_by_outbound = values.arriveByOutboundTime;
  }
  if (values.departAfterReturnEnabled && values.departAfterReturnTime) {
    preferences.depart_after_return = values.departAfterReturnTime;
  }

  return {
    slices,
    passengers,
    cabin_class: values.cabinClass,
    max_connections: values.maxConnections,
    ...(Object.keys(preferences).length > 0 ? { preferences } : {}),
  };
}
