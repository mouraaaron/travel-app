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

const DUFFEL_NAME_REGEX = /^[A-Za-z\-'\s]{1,20}$/;

export const duffelPassengerSchema = z
  .object({
    id: z.string(),
    type: z.enum(["adult", "child", "infant_without_seat"]),
    title: z.enum(["mr", "mrs", "ms", "miss", "dr"], { error: "Selecione um título" }),
    given_name: z
      .string()
      .trim()
      .regex(DUFFEL_NAME_REGEX, "Sem acentos, 1–20 caracteres, apenas letras/hífen/apóstrofo"),
    family_name: z
      .string()
      .trim()
      .regex(DUFFEL_NAME_REGEX, "Sem acentos, 1–20 caracteres, apenas letras/hífen/apóstrofo"),
    born_on: z.string().min(1, "Informe a data de nascimento"),
    gender: z.enum(["m", "f"], { error: "Selecione o gênero" }),
    email: z.string().trim().email("E-mail inválido"),
    phoneCountry: z.string().min(1, "Selecione o país"),
    phoneLocalNumber: z.string().regex(/^\d{8,13}$/, "8–13 dígitos, sem espaços ou símbolos"),
    passportRequired: z.boolean(),
    passportNumber: z.string().optional(),
    passportIssuingCountry: z.string().optional(),
    passportExpiresOn: z.string().optional(),
    infantResponsibleFor: z.string().optional(),
  })
  .refine((d) => !d.passportRequired || Boolean(d.passportNumber), {
    message: "Informe o número do passaporte",
    path: ["passportNumber"],
  })
  .refine((d) => !d.passportRequired || Boolean(d.passportIssuingCountry), {
    message: "Informe o país emissor",
    path: ["passportIssuingCountry"],
  })
  .refine((d) => !d.passportRequired || Boolean(d.passportExpiresOn), {
    message: "Informe a validade do passaporte",
    path: ["passportExpiresOn"],
  });

export type DuffelPassengerFormValues = z.infer<typeof duffelPassengerSchema>;

export const duffelPassengersSchema = z
  .object({ passengers: z.array(duffelPassengerSchema).min(1, "Informe ao menos um passageiro") })
  .refine(
    (d) => {
      const infants = d.passengers.filter((p) => p.type === "infant_without_seat");
      const responsibleIds = d.passengers
        .map((p) => p.infantResponsibleFor)
        .filter((v): v is string => Boolean(v));
      const uniqueResponsible = new Set(responsibleIds);
      return (
        infants.every((inf) => responsibleIds.includes(inf.id)) &&
        uniqueResponsible.size === responsibleIds.length
      );
    },
    {
      message:
        "Cada bebê precisa de exatamente um adulto responsável, e cada adulto pode ser responsável por no máximo um bebê",
      path: ["passengers"],
    }
  );

export type DuffelPassengersFormValues = z.infer<typeof duffelPassengersSchema>;

export function toE164(dialCode: string, localNumber: string): string {
  return `+${dialCode}${localNumber}`;
}

export function buildEmptyDuffelPassenger(
  type: "adult" | "child" | "infant_without_seat",
  id: string
): DuffelPassengerFormValues {
  return {
    id,
    type,
    title: "mr",
    given_name: "",
    family_name: "",
    born_on: "",
    gender: "m",
    email: "",
    phoneCountry: "55",
    phoneLocalNumber: "",
    passportRequired: false,
    passportNumber: "",
    passportIssuingCountry: "",
    passportExpiresOn: "",
    infantResponsibleFor: undefined,
  };
}
