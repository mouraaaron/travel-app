"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn, initialsFromName } from "@/lib/utils";
import { ADMIN_NAV_ITEMS, PERSONAL_NAV_ITEMS, type NavItem } from "./nav-items";
import { SignOutButton } from "./sign-out-button";

export function DesktopSidebar({ fullName, role }: { fullName: string; role: "employee" | "admin" }) {
  const pathname = usePathname();
  const initials = initialsFromName(fullName);
  const isAdmin = role === "admin";
  const [open, setOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const transition = { duration: shouldReduceMotion ? 0 : 0.2, ease: "easeInOut" as const };

  function renderLink(item: NavItem) {
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
        <Icon className="h-4 w-4 shrink-0" />
        <motion.span animate={{ opacity: open ? 1 : 0 }} transition={transition} className="whitespace-nowrap">
          {item.label}
        </motion.span>
      </Link>
    );
  }

  return (
    <motion.aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      animate={{ width: open ? 248 : 64 }}
      transition={transition}
      className="sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground lg:flex"
    >
      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
        <img src="/paggo-icon.svg" alt="Paggo" className="h-6 w-6 shrink-0" />
        <AnimatePresence>
          {open && (
            <motion.img
              key="full-logo"
              src="/paggo-logo-light.svg"
              alt="Paggo"
              className="h-[18px] w-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition}
            />
          )}
        </AnimatePresence>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {isAdmin ? (
          <>
            {ADMIN_NAV_ITEMS.map(renderLink)}
            <motion.p
              animate={{ opacity: open ? 1 : 0 }}
              transition={transition}
              className="mt-4 whitespace-nowrap px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/40"
            >
              Pessoal
            </motion.p>
            {PERSONAL_NAV_ITEMS.map(renderLink)}
          </>
        ) : (
          PERSONAL_NAV_ITEMS.map(renderLink)
        )}
      </nav>
      <div className="flex flex-col gap-3 border-t border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </span>
          <motion.span
            animate={{ opacity: open ? 1 : 0 }}
            transition={transition}
            style={{ pointerEvents: open ? "auto" : "none" }}
            className="whitespace-nowrap text-sm font-medium"
          >
            {fullName}
          </motion.span>
        </div>
        <motion.div
          animate={{ opacity: open ? 1 : 0 }}
          transition={transition}
          style={{ pointerEvents: open ? "auto" : "none" }}
        >
          <SignOutButton />
        </motion.div>
      </div>
    </motion.aside>
  );
}
