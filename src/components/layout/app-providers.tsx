"use client";

import type { ReactNode } from "react";
import { RequestsProvider } from "@/lib/requests-store";
import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <RequestsProvider>
      {children}
      <Toaster position="top-right" />
    </RequestsProvider>
  );
}
