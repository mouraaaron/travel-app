"use client";

import type { ReactNode } from "react";
import { RequestsProvider, TravelRequestsProvider } from "@/lib/requests-store";
import { TripFlowProvider } from "@/lib/trip-flow-store";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TravelRequestsProvider>
      <RequestsProvider>
        <TripFlowProvider>
          <TooltipProvider delayDuration={150}>
            {children}
            <Toaster position="bottom-center" />
          </TooltipProvider>
        </TripFlowProvider>
      </RequestsProvider>
    </TravelRequestsProvider>
  );
}
