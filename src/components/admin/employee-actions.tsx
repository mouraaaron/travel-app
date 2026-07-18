"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SECTOR_LABELS, SECTORS, type EmployeeRole, type EmployeeStatus, type Sector } from "@/lib/badge-variants";
import { mutateWithToast } from "@/lib/client-mutation";

interface EmployeeActionsProps {
  employeeId: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  costCenter: Sector;
  isSelf: boolean;
}

export function EmployeeActions({ employeeId, role, status, costCenter, isSelf }: EmployeeActionsProps) {
  const router = useRouter();
  const [savingRole, setSavingRole] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingSector, setSavingSector] = useState(false);

  async function handleRoleChange(nextRole: EmployeeRole) {
    setSavingRole(true);
    const { ok } = await mutateWithToast(
      `/api/admin/employees/${employeeId}/role`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      },
      { success: "Função atualizada.", error: "Não foi possível alterar a função." }
    );
    if (ok) router.refresh();
    setSavingRole(false);
  }

  async function handleStatusToggle(checked: boolean) {
    const nextStatus: EmployeeStatus = checked ? "active" : "inactive";
    setSavingStatus(true);
    const { ok } = await mutateWithToast(
      `/api/admin/employees/${employeeId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      },
      {
        success: nextStatus === "active" ? "Acesso ativado." : "Acesso desativado.",
        error: "Não foi possível alterar o status.",
      }
    );
    if (ok) router.refresh();
    setSavingStatus(false);
  }

  async function handleSectorChange(nextSector: Sector) {
    setSavingSector(true);
    const { ok } = await mutateWithToast(
      `/api/admin/employees/${employeeId}/cost-center`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cost_center: nextSector }),
      },
      { success: "Setor atualizado.", error: "Não foi possível alterar o setor." }
    );
    if (ok) router.refresh();
    setSavingSector(false);
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-5">
      <div className="flex flex-col gap-1.5">
        <Label>Função</Label>
        <Select
          value={role}
          disabled={isSelf || savingRole}
          onValueChange={(value) => handleRoleChange(value as EmployeeRole)}
        >
          <SelectTrigger
            className="w-[200px]"
            title={isSelf ? "Você não pode alterar sua própria função" : undefined}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="employee">Funcionário</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Setor</Label>
        <Select
          value={costCenter}
          disabled={savingSector}
          onValueChange={(value) => handleSectorChange(value as Sector)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SECTORS.map((sector) => (
              <SelectItem key={sector} value={sector}>
                {SECTOR_LABELS[sector]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={status === "active"}
          disabled={isSelf || savingStatus}
          onCheckedChange={handleStatusToggle}
          title={isSelf ? "Você não pode desativar sua própria conta" : undefined}
        />
        <Label>{status === "active" ? "Acesso ativo" : "Acesso desativado"}</Label>
      </div>
    </div>
  );
}
