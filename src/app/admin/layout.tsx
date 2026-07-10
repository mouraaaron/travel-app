import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
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
    <>
      <AppSidebar fullName={profile.fullName} role="admin" />
      <main className="min-h-screen lg:pl-[248px]">
        <div className="px-6 pb-16 pt-8">{children}</div>
      </main>
    </>
  );
}
