"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/requests", label: "Minhas Solicitações" },
  { href: "/", label: "Buscar Viagem" },
];

export function TopBar() {
  const pathname = usePathname();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-[#333131] px-14">
      <span className="text-lg font-semibold text-white">Travel App</span>
      <nav className="flex items-center gap-6">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "text-sm font-medium text-white/70 transition-colors hover:text-white",
              pathname === item.href && "text-white"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
