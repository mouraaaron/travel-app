import { z } from "zod";

export const passengerSchema = z.object({
  firstName: z.string().trim().min(1, "Informe o nome"),
  lastName: z.string().trim().min(1, "Informe o sobrenome"),
  dateOfBirth: z.string().min(1, "Informe a data de nascimento"),
  gender: z.enum(["f", "m"], { error: "Selecione o sexo" }),
  email: z.string().trim().email("E-mail inválido"),
  phone: z.string().trim().min(8, "Informe um telefone válido"),
});

export type PassengerFormValues = z.infer<typeof passengerSchema>;

export const passengersSchema = z.object({
  passengers: z.array(passengerSchema).min(1, "Informe ao menos um passageiro"),
});

export type PassengersFormValues = z.infer<typeof passengersSchema>;

export function buildEmptyPassenger(): PassengerFormValues {
  return {
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "f",
    email: "",
    phone: "",
  };
}
