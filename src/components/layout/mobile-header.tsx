"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, initialsFromName } from "@/lib/utils";
import { ADMIN_NAV_ITEMS, PERSONAL_NAV_ITEMS } from "./nav-items";

export function MobileHeader({ fullName, role }: { fullName: string; role: "employee" | "admin" }) {
  const pathname = usePathname();
  const initials = initialsFromName(fullName);
  const isAdmin = role === "admin";
  const mobileNavItems = isAdmin ? [...ADMIN_NAV_ITEMS, ...PERSONAL_NAV_ITEMS] : PERSONAL_NAV_ITEMS;

  return (
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
  );
}
