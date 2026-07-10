"use client";

import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";

export function RequestNotFound() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-[1080px]">
      <EmptyState
        title="Solicitação não encontrada"
        description="Ela pode ter sido removida, ou você não tem acesso a ela."
        button={{ label: "Minhas solicitações", onClick: () => router.push("/requests") }}
      />
    </div>
  );
}
