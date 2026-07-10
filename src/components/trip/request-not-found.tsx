"use client";

import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";

export function RequestNotFound({
  backHref = "/requests",
  backLabel = "Minhas solicitações",
}: {
  backHref?: string;
  backLabel?: string;
}) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-[1080px]">
      <EmptyState
        title="Solicitação não encontrada"
        description="Ela pode ter sido removida, ou você não tem acesso a ela."
        button={{ label: backLabel, onClick: () => router.push(backHref) }}
      />
    </div>
  );
}
