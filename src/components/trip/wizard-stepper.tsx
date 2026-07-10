import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "criteria", label: "Critérios" },
  { key: "passengers", label: "Passageiros" },
  { key: "review", label: "Revisão" },
] as const;

export type WizardStepKey = (typeof STEPS)[number]["key"];

export function WizardStepper({ current }: { current: WizardStepKey }) {
  const currentIndex = STEPS.findIndex((step) => step.key === current);

  return (
    <ol className="mx-auto flex w-full max-w-md items-center justify-center gap-2">
      {STEPS.map((step, index) => {
        const state = index < currentIndex ? "done" : index === currentIndex ? "active" : "upcoming";
        return (
          <li key={step.key} className="flex flex-1 items-center gap-2 last:flex-none">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                state === "active" && "bg-primary text-primary-foreground",
                state === "done" && "border border-primary text-primary",
                state === "upcoming" && "border border-border text-muted-foreground"
              )}
            >
              {state === "done" ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                state === "upcoming" ? "text-muted-foreground" : "text-foreground"
              )}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 ? <span className="mx-1 h-px flex-1 bg-border" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
