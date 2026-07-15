"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  Plane,
  Settings,
  Users,
} from "lucide-react";
import { cn, initialsFromName } from "@/lib/utils";
import { SignOutButton } from "./sign-out-button";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const PERSONAL_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Nova viagem", icon: Plane },
  { href: "/requests", label: "Minhas solicitações", icon: ClipboardList },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Painel", icon: LayoutDashboard },
  { href: "/admin/requests", label: "Solicitações", icon: ClipboardCheck },
  { href: "/admin/onsite-weeks", label: "Semanas Presenciais", icon: CalendarRange },
  { href: "/admin/employees", label: "Funcionários", icon: Users },
  { href: "/admin/reports", label: "Relatórios", icon: FileText },
  { href: "/admin/settings", label: "Configurações", icon: Settings },
];

export function AppSidebar({ fullName, role }: { fullName: string; role: "employee" | "admin" }) {
  const pathname = usePathname();
  const initials = initialsFromName(fullName);
  const isAdmin = role === "admin";
  const mobileNavItems = isAdmin ? [...ADMIN_NAV_ITEMS, ...PERSONAL_NAV_ITEMS] : PERSONAL_NAV_ITEMS;

  function renderDesktopLink(item: NavItem) {
    const active = pathname === item.href;
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex h-8 items-center gap-3 rounded-none px-3 py-1.5 text-[13px] font-normal leading-[18px] text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          active && "bg-sidebar-accent text-sidebar-accent-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
        {item.label}
      </Link>
    );
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-14 items-center px-6">
          <img src="/paggo-logo-light.svg" alt="Paggo" className="h-[18px] w-auto" />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {isAdmin ? (
            <>
              {ADMIN_NAV_ITEMS.map(renderDesktopLink)}
              <p className="mt-4 px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/40">
                Pessoal
              </p>
              {PERSONAL_NAV_ITEMS.map(renderDesktopLink)}
            </>
          ) : (
            PERSONAL_NAV_ITEMS.map(renderDesktopLink)
          )}
        </nav>
        <div className="flex flex-col gap-3 border-t border-sidebar-border px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </span>
            <span className="text-sm font-medium">{fullName}</span>
          </div>
          <SignOutButton />
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground lg:hidden">
        <img src="/paggo-icon.svg" alt="Paggo" className="h-6 w-6" />
        <nav className="flex items-center gap-4">
          {mobileNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm font-medium text-sidebar-foreground/70",
                pathname === item.href && "text-sidebar-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials}
        </span>
      </header>
    </>
  );
}
