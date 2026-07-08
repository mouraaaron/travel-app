import { z } from "zod";

export const flightSearchSchema = z
  .object({
    mode: z.literal("flight"),
    origin: z.string().trim().length(3, "Use o código IATA de 3 letras (ex: GRU)"),
    destination: z
      .string()
      .trim()
      .length(3, "Use o código IATA de 3 letras (ex: JFK)"),
    departureAt: z.string().min(1, "Informe a data de ida"),
    returnAt: z.string().optional(),
    cabinClass: z.enum(["economy", "premium_economy", "business", "first"]),
  })
  .refine(
    (data) => data.origin.toUpperCase() !== data.destination.toUpperCase(),
    { message: "Origem e destino não podem ser iguais", path: ["destination"] }
  )
  .refine((data) => !data.returnAt || data.returnAt >= data.departureAt, {
    message: "A volta não pode ser antes da ida",
    path: ["returnAt"],
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
