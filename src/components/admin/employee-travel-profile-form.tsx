"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PassengerGender, PassengerTitle } from "@/lib/types";
import type { TravelProfileFields } from "@/lib/onsite-weeks";

const TITLE_LABELS: Record<PassengerTitle, string> = {
  mr: "Sr.",
  mrs: "Sra.",
  ms: "Sra. (Ms)",
  miss: "Srta.",
  dr: "Dr(a).",
};

interface EmployeeTravelProfileFormProps {
  employeeId: string;
  profile: TravelProfileFields;
}

export function EmployeeTravelProfileForm({ employeeId, profile }: EmployeeTravelProfileFormProps) {
  const router = useRouter();
  const [values, setValues] = useState({
    origin_airport_code: profile.origin_airport_code ?? "",
    given_name: profile.given_name ?? "",
    family_name: profile.family_name ?? "",
    born_on: profile.born_on ?? "",
    gender: (profile.gender ?? "f") as PassengerGender,
    title: (profile.title ?? "ms") as PassengerTitle,
    phone_number: profile.phone_number ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/employees/${employeeId}/travel-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error ?? "Não foi possível salvar o perfil de viagem.");
        return;
      }
      toast.success("Perfil de viagem atualizado.");
      router.refresh();
    } catch {
      toast.error("Não foi possível salvar o perfil de viagem.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">Perfil de viagem</h2>
      <p className="text-xs text-muted-foreground">
        Necessário para incluir este funcionário numa Semana Presencial.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Aeroporto de origem (IATA)</Label>
          <Input
            value={values.origin_airport_code}
            maxLength={3}
            placeholder="Ex: GRU"
            onChange={(e) =>
              setValues((v) => ({ ...v, origin_airport_code: e.target.value.toUpperCase() }))
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Telefone</Label>
          <Input
            value={values.phone_number}
            onChange={(e) => setValues((v) => ({ ...v, phone_number: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Nome</Label>
          <Input
            value={values.given_name}
            onChange={(e) => setValues((v) => ({ ...v, given_name: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Sobrenome</Label>
          <Input
            value={values.family_name}
            onChange={(e) => setValues((v) => ({ ...v, family_name: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Data de nascimento</Label>
          <Input
            type="date"
            value={values.born_on}
            onChange={(e) => setValues((v) => ({ ...v, born_on: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Título</Label>
          <Select value={values.title} onValueChange={(value) => setValues((v) => ({ ...v, title: value as PassengerTitle }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TITLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Gênero</Label>
          <Select value={values.gender} onValueChange={(value) => setValues((v) => ({ ...v, gender: value as PassengerGender }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="f">Feminino</SelectItem>
              <SelectItem value="m">Masculino</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button size="sm" className="w-fit" disabled={saving} onClick={handleSave}>
        {saving ? "Salvando..." : "Salvar perfil de viagem"}
      </Button>
    </div>
  );
}
