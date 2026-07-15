"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmployeeDetail } from "@/components/admin/employee-detail";
import { initialsFromName } from "@/lib/utils";
import type { AdminQueueRequest } from "@/lib/requests-mapper";

interface EmployeeReportPanelProps {
  employeeId: string;
  employeeName: string;
  requests: AdminQueueRequest[];
  onBack: () => void;
}

export function EmployeeReportPanel({
  employeeId,
  employeeName,
  requests,
  onBack,
}: EmployeeReportPanelProps) {
  const shouldReduceMotion = useReducedMotion();
  const backButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    backButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onBack();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col overflow-auto bg-background"
      exit={{ opacity: 0, transition: { duration: shouldReduceMotion ? 0.1 : 0.2 } }}
    >
      <div className="flex items-center gap-3 border-b p-4">
        <Button
          ref={backButtonRef}
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Voltar para a lista"
        >
          <ArrowLeft className="size-4" />
        </Button>
        {shouldReduceMotion ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-9 w-9">
              <AvatarFallback>{initialsFromName(employeeName)}</AvatarFallback>
            </Avatar>
            <span className="font-medium text-foreground">{employeeName}</span>
          </div>
        ) : (
          <motion.div
            layoutId={`employee-anchor-${employeeId}`}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex items-center gap-2"
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback>{initialsFromName(employeeName)}</AvatarFallback>
            </Avatar>
            <span className="font-medium text-foreground">{employeeName}</span>
          </motion.div>
        )}
      </div>
      <motion.div
        className="flex-1 p-6"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: {
            duration: shouldReduceMotion ? 0.1 : 0.25,
            delay: shouldReduceMotion ? 0 : 0.08,
            ease: "easeOut",
          },
        }}
        exit={{
          opacity: 0,
          y: shouldReduceMotion ? 0 : 10,
          transition: { duration: shouldReduceMotion ? 0.1 : 0.2, ease: "easeOut" },
        }}
      >
        <EmployeeDetail employeeId={employeeId} employeeName={employeeName} requests={requests} />
      </motion.div>
    </motion.div>
  );
}
