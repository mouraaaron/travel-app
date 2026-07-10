"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Plane } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Nova viagem", icon: Plane },
  { href: "/requests", label: "Minhas solicitações", icon: ClipboardList },
] as const;

const CURRENT_USER = { name: "Aaron Moura", initials: "AM" };

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-14 items-center px-6">
          <img src="/paggo-logo-light.svg" alt="Paggo" className="h-6 w-auto" />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 border-t border-sidebar-border px-6 py-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {CURRENT_USER.initials}
          </span>
          <span className="text-sm font-medium">{CURRENT_USER.name}</span>
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground lg:hidden">
        <img src="/paggo-icon.svg" alt="Paggo" className="h-6 w-6" />
        <nav className="flex items-center gap-4">
          {NAV_ITEMS.map((item) => (
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
          {CURRENT_USER.initials}
        </span>
      </header>
    </>
  );
}
