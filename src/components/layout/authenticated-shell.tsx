import { DesktopSidebar } from "./desktop-sidebar";
import { MobileHeader } from "./mobile-header";

export function AuthenticatedShell({
  fullName,
  role,
  children,
}: {
  fullName: string;
  role: "employee" | "admin";
  children: React.ReactNode;
}) {
  return (
    <>
      <MobileHeader fullName={fullName} role={role} />
      <div className="flex">
        <DesktopSidebar fullName={fullName} role={role} />
        <main className="min-h-screen min-w-0 flex-1">
          <div className="px-6 pb-16 pt-8">{children}</div>
        </main>
      </div>
    </>
  );
}
