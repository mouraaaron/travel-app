"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SECTOR_LABELS } from "@/lib/badge-variants";
import type { PolicyRuleRow } from "@/lib/policy-rules";

function SectorPolicyCard({ rule }: { rule: PolicyRuleRow }) {
  const router = useRouter();
  const [values, setValues] = useState({
    domesticCapBRL: rule.domestic_cap_brl,
    internationalCapBRL: rule.international_cap_brl,
    longHaulCabinHours: rule.long_haul_cabin_hours,
    costFlagBRL: rule.cost_flag_brl,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/policy-rules/${rule.sector}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error ?? "Não foi possível salvar a política.");
        return;
      }
      toast.success("Política atualizada.");
      router.refresh();
    } catch {
      toast.error("Não foi possível salvar a política.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{SECTOR_LABELS[rule.sector]}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Teto doméstico (R$)</Label>
            <Input
              type="number"
              min={0}
              value={values.domesticCapBRL}
              onChange={(e) => setValues((v) => ({ ...v, domesticCapBRL: Number(e.target.value) }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Teto internacional (R$)</Label>
            <Input
              type="number"
              min={0}
              value={values.internationalCapBRL}
              onChange={(e) => setValues((v) => ({ ...v, internationalCapBRL: Number(e.target.value) }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Horas mín. p/ classe executiva</Label>
            <Input
              type="number"
              min={0}
              value={values.longHaulCabinHours}
              onChange={(e) => setValues((v) => ({ ...v, longHaulCabinHours: Number(e.target.value) }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Sinalizar custo elevado acima de (R$)</Label>
            <Input
              type="number"
              min={0}
              value={values.costFlagBRL}
              onChange={(e) => setValues((v) => ({ ...v, costFlagBRL: Number(e.target.value) }))}
            />
          </div>
        </div>
        <Button size="sm" className="w-fit" loading={saving} onClick={handleSave}>
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}

export function PolicyRulesForm({ rules }: { rules: PolicyRuleRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {rules.map((rule) => (
        <SectorPolicyCard key={rule.sector} rule={rule} />
      ))}
    </div>
  );
}
