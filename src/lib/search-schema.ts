import { z } from "zod";

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
