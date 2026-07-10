"use client";

import type { ReactNode } from "react";
import { RequestsProvider } from "@/lib/requests-store";
import { TripFlowProvider } from "@/lib/trip-flow-store";
import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <RequestsProvider>
      <TripFlowProvider>
        {children}
        <Toaster position="top-right" />
      </TripFlowProvider>
    </RequestsProvider>
  );
}
