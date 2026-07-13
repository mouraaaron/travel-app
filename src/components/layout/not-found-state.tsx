"use client";

import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";

interface NotFoundStateProps {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
}

export function NotFoundState({ title, description, backHref, backLabel }: NotFoundStateProps) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-[1080px]">
      <EmptyState
        title={title}
        description={description}
        button={{ label: backLabel, onClick: () => router.push(backHref) }}
      />
    </div>
  );
}
