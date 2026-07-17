import { redirect } from "next/navigation";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { getCurrentProfile } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  if (profile.role !== "admin") {
    redirect("/");
  }

  return (
    <AuthenticatedShell fullName={profile.fullName} role="admin">
      {children}
    </AuthenticatedShell>
  );
}
