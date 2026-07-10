import { z } from "zod";
import type { TripPurpose } from "./types";

export const corporateContextSchema = z
  .object({
    trip_purpose: z.enum(["client_meeting", "conference", "internal_meeting", "training", "other"], {
      error: "Selecione o motivo da viagem",
    }),
    cost_center: z.string().min(1, "Selecione o centro de custo"),
    project_code: z.string().optional(),
    business_justification: z.string().trim().min(20, "Mínimo 20 caracteres"),
    isOutOfPolicy: z.boolean(),
    out_of_policy_justification: z.string().optional(),
  })
  .refine((d) => !d.isOutOfPolicy || (d.out_of_policy_justification?.trim().length ?? 0) >= 50, {
    message: "Mínimo 50 caracteres explicando por que a oferta fora da política é necessária",
    path: ["out_of_policy_justification"],
  });

export type CorporateContextFormValues = z.infer<typeof corporateContextSchema>;

export const COST_CENTERS: string[] = ["Engenharia", "Vendas", "Produto", "Operações", "Diretoria"];

export const TRIP_PURPOSE_LABELS: Record<TripPurpose, string> = {
  client_meeting: "Reunião com cliente",
  conference: "Conferência",
  internal_meeting: "Reunião interna",
  training: "Treinamento",
  other: "Outro",
};
