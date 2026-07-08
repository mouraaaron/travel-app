"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function JustificationDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (justification: string) => void;
}) {
  const [justification, setJustification] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setJustification("");
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Justifique esta solicitação</DialogTitle>
          <DialogDescription>
            Esta oferta está fora da política da empresa. Explique o motivo para o
            Travel Admin avaliar.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
          placeholder="Ex: única opção compatível com o horário do evento em Lisboa."
          rows={4}
        />
        <DialogFooter>
          <Button
            disabled={justification.trim().length === 0}
            onClick={() => {
              onConfirm(justification.trim());
              setJustification("");
            }}
          >
            Enviar solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
