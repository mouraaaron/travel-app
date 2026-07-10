import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { SignOutButton } from "@/components/layout/sign-out-button";

export default async function AdminPlaceholderPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <img src="/paggo-icon.svg" alt="Paggo" className="h-10 w-10" />
      <h1 className="text-xl font-semibold text-foreground">Admin Panel em construção</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Olá, {profile.fullName}. A aprovação de solicitações e o painel do Travel Admin ainda não
        foram implementados nesta fase do projeto.
      </p>
      <SignOutButton />
    </div>
  );
}
