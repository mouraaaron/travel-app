import { redirect } from "next/navigation";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { getCurrentProfile } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  return (
    <AuthenticatedShell fullName={profile.fullName} role={profile.role}>
      {children}
    </AuthenticatedShell>
  );
}
