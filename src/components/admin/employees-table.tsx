"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getEmployeeStatusBadge,
  getRoleBadge,
  getSectorBadge,
  SECTOR_LABELS,
  SECTORS,
  type EmployeeRole,
  type EmployeeStatus,
  type Sector,
} from "@/lib/badge-variants";
import type { Employee } from "@/lib/employees";
import { initialsFromName } from "@/lib/utils";

type RoleFilter = "all" | EmployeeRole;
type StatusFilter = "all" | EmployeeStatus;
type SectorFilter = "all" | Sector;

export function EmployeesTable({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sectorFilter, setSectorFilter] = useState<SectorFilter>("all");

  const filtered = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesQuery =
        loweredQuery.length === 0 ||
        employee.full_name.toLowerCase().includes(loweredQuery) ||
        employee.email.toLowerCase().includes(loweredQuery);
      const matchesRole = roleFilter === "all" || employee.role === roleFilter;
      const matchesStatus = statusFilter === "all" || employee.status === statusFilter;
      const matchesSector = sectorFilter === "all" || employee.cost_center === sectorFilter;
      return matchesQuery && matchesRole && matchesStatus && matchesSector;
    });
  }, [employees, query, roleFilter, statusFilter, sectorFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-[280px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className="pl-8"
          />
        </div>
        <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Função" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as funções</SelectItem>
            <SelectItem value="employee">Funcionário</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sectorFilter} onValueChange={(value) => setSectorFilter(value as SectorFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {SECTORS.map((sector) => (
              <SelectItem key={sector} value={sector}>
                {SECTOR_LABELS[sector]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum funcionário encontrado" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funcionário</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((employee) => {
              const roleBadge = getRoleBadge(employee.role);
              const statusBadge = getEmployeeStatusBadge(employee.status);
              const sectorBadge = getSectorBadge(employee.cost_center);
              return (
                <TableRow
                  key={employee.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/employees/${employee.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback>{initialsFromName(employee.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{employee.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{employee.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleBadge.variant}>{roleBadge.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={sectorBadge.variant}>{sectorBadge.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
