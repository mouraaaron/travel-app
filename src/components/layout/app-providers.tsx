"use client";

import type { ReactNode } from "react";
import { TripFlowProvider } from "@/lib/trip-flow-store";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TripFlowProvider>
      <TooltipProvider delayDuration={150}>
        {children}
        <Toaster position="bottom-center" />
      </TooltipProvider>
    </TripFlowProvider>
  );
}
