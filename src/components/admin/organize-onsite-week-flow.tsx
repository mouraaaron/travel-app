"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SECTOR_LABELS, SECTORS, type Sector } from "@/lib/badge-variants";
import type { OnsiteWeekPreviewEmployee } from "@/lib/onsite-weeks";

type Step = "form" | "review";

function formatDateBR(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year.slice(2)}`;
}

export function OrganizeOnsiteWeekFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [sector, setSector] = useState<Sector>("engineering");
  const [weekStartDate, setWeekStartDate] = useState("");
  const [weekEndDate, setWeekEndDate] = useState("");
  const [employees, setEmployees] = useState<OnsiteWeekPreviewEmployee[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handlePreview() {
    if (!weekStartDate || !weekEndDate) {
      toast.error("Escolha as datas de ida e de volta.");
      return;
    }
    if (weekEndDate < weekStartDate) {
      toast.error("A data de volta não pode ser antes da data de ida.");
      return;
    }

    setLoadingPreview(true);
    try {
      const response = await fetch("/api/admin/onsite-weeks/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sector }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error ?? "Não foi possível carregar os funcionários do setor.");
        return;
      }
      const previewEmployees = body.employees as OnsiteWeekPreviewEmployee[];
      setEmployees(previewEmployees);
      setSelected(
        Object.fromEntries(previewEmployees.map((employee) => [employee.id, employee.default_checked]))
      );
      setStep("review");
    } catch {
      toast.error("Não foi possível carregar os funcionários do setor.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleConfirm() {
    const employeeIds = Object.entries(selected)
      .filter(([, checked]) => checked)
      .map(([id]) => id);

    if (employeeIds.length === 0) {
      toast.error("Selecione ao menos um funcionário.");
      return;
    }

    setConfirming(true);
    try {
      const response = await fetch("/api/admin/onsite-weeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sector,
          week_start_date: weekStartDate,
          week_end_date: weekEndDate,
          employee_ids: employeeIds,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409 && body?.existing_onsite_week_id) {
          toast.error(body.error);
          router.push(`/admin/onsite-weeks/${body.existing_onsite_week_id}`);
          return;
        }
        toast.error(body?.error ?? "Não foi possível organizar a semana presencial.");
        return;
      }
      toast.success("Semana presencial organizada.");
      router.push(`/admin/onsite-weeks/${body.onsite_week.id}`);
    } catch {
      toast.error("Não foi possível organizar a semana presencial.");
    } finally {
      setConfirming(false);
    }
  }

  if (step === "form") {
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
        <h1 className="text-xl font-semibold text-foreground">Organizar semana presencial</h1>
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-1.5">
              <Label>Setor</Label>
              <Select value={sector} onValueChange={(value) => setSector(value as Sector)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SECTOR_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Data de ida</Label>
                <Input type="date" value={weekStartDate} onChange={(e) => setWeekStartDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Data de volta</Label>
                <Input type="date" value={weekEndDate} onChange={(e) => setWeekEndDate(e.target.value)} />
              </div>
            </div>
            <Button loading={loadingPreview} onClick={handlePreview} className="w-fit">
              Avançar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">
        Revisar funcionários — {SECTOR_LABELS[sector]}
      </h1>
      <p className="text-sm text-muted-foreground">
        {formatDateBR(weekStartDate)} a {formatDateBR(weekEndDate)}. Desmarque quem não deve viajar.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead />
            <TableHead>Funcionário</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => {
            const eligible = employee.eligibility.status === "ok";
            return (
              <TableRow key={employee.id}>
                <TableCell>
                  <Checkbox
                    checked={selected[employee.id] ?? false}
                    disabled={!eligible}
                    onCheckedChange={(checked) =>
                      setSelected((prev) => ({ ...prev, [employee.id]: checked === true }))
                    }
                  />
                </TableCell>
                <TableCell className="text-foreground">{employee.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{employee.origin_airport_code ?? "—"}</TableCell>
                <TableCell>
                  {employee.eligibility.status === "ok" ? (
                    <Badge variant="success">Ok</Badge>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <Badge variant="warning">Perfil incompleto</Badge>
                      <a
                        href={`/admin/employees/${employee.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Faltam: {employee.eligibility.missingFields.join(", ")}
                      </a>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between">
        <Button variant="link" onClick={() => setStep("form")}>
          Voltar
        </Button>
        <Button loading={confirming} onClick={handleConfirm}>
          Confirmar e buscar voos
        </Button>
      </div>
    </div>
  );
}
