"use client";

import { useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  MarkerType,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { TableNode, type TableNodeType } from "@/components/dev/table-node";
import { schemaEdges, schemaTables } from "@/lib/dev/database-schema";

const nodeTypes = { tableNode: TableNode };

const positions: Record<string, { x: number; y: number }> = {
  "auth.users": { x: 40, y: 40 },
  organizations: { x: 620, y: 40 },
  profiles: { x: 40, y: 320 },
  requests: { x: 620, y: 340 },
  policy_rules: { x: 1140, y: 340 },
};

export default function DatabaseSchemaPage() {
  const nodes = useMemo<TableNodeType[]>(
    () =>
      schemaTables.map((table) => ({
        id: table.id,
        type: "tableNode",
        position: positions[table.id] ?? { x: 0, y: 0 },
        data: { table },
      })),
    []
  );

  const edges = useMemo<Edge[]>(
    () =>
      schemaEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourceColumn,
        target: edge.target,
        targetHandle: edge.targetColumn,
        label: edge.label,
        animated: false,
        style: edge.dashed ? { strokeDasharray: 5 } : undefined,
        markerEnd: { type: MarkerType.ArrowClosed },
      })),
    []
  );

  return (
    <div className="h-screen w-screen bg-background">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.3}>
        <Background />
        <MiniMap zoomable pannable />
        <Controls />
      </ReactFlow>
    </div>
  );
}
