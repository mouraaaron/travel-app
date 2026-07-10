import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { getCurrentProfile } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  return (
    <>
      <AppSidebar fullName={profile.fullName} />
      <main className="min-h-screen lg:pl-[248px]">
        <div className="px-6 pb-16 pt-8">{children}</div>
      </main>
    </>
  );
}
