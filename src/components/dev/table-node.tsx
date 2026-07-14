"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ColumnFlag, SchemaTable } from "@/lib/dev/database-schema";

export type TableNodeType = Node<{ table: SchemaTable }, "tableNode">;

const flagBadge: Record<ColumnFlag, { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
  pk: { label: "PK", variant: "default" },
  fk: { label: "FK", variant: "info" },
  unique: { label: "UNIQUE", variant: "magic" },
};

export function TableNode({ data }: NodeProps<TableNodeType>) {
  const { table } = data;

  return (
    <div
      className={cn(
        "w-[300px] overflow-hidden rounded-sm border bg-card text-card-foreground shadow-sm",
        table.external && "border-dashed opacity-90"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2">
        <span className="font-mono text-sm font-semibold">{table.name}</span>
        <div className="flex gap-1">
          {table.rls && (
            <Badge variant="success" className="px-1.5 py-0 text-[10px]">
              RLS
            </Badge>
          )}
          {table.external && (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              external
            </Badge>
          )}
        </div>
      </div>

      {table.note && (
        <p className="border-b bg-muted/20 px-3 py-1.5 text-[11px] leading-snug text-muted-foreground">
          {table.note}
        </p>
      )}

      <div className="divide-y">
        {table.columns.map((column) => {
          const isPk = column.flags?.includes("pk");
          const isFk = column.flags?.includes("fk");

          return (
            <div key={column.name} className="relative flex flex-col gap-0.5 px-3 py-1.5">
              {isPk && (
                <Handle
                  type="target"
                  position={Position.Left}
                  id={column.name}
                  className="!left-0 !h-2 !w-2 !bg-primary"
                />
              )}
              {isFk && (
                <Handle
                  type="source"
                  position={Position.Right}
                  id={column.name}
                  className="!right-0 !h-2 !w-2 !bg-sky-500"
                />
              )}

              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">
                  {column.name}
                  <span className="ml-1.5 text-muted-foreground">{column.type}</span>
                </span>
                <div className="flex shrink-0 gap-1">
                  {column.flags?.map((flag) => {
                    const badge = flagBadge[flag];
                    return (
                      <Badge key={flag} variant={badge.variant} className="px-1.5 py-0 text-[10px]">
                        {badge.label}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {column.check && (
                <span className="text-[10px] leading-snug text-amber-700 dark:text-amber-400">
                  check: {column.check}
                </span>
              )}
              {column.note && (
                <span className="text-[10px] leading-snug text-muted-foreground">{column.note}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
