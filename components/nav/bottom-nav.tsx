"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Vaste onderbalk uit het Claude Design-prototype: nu · inzichten · tools.
 * - "nu"        → home (het incheck-scherm)
 * - "inzichten" → placeholder tot de inzichten gemigreerd zijn
 * - "tools"     → tools-overzicht; ook actief binnen de planner-flow
 *
 * Actief = licht (#E9EBEA), inactief = gedempt (#6C7377). Respecteert
 * env(safe-area-inset-bottom) voor iOS.
 */
const TABS = [
  { href: "/", label: "nu", isActive: (p: string) => p === "/" },
  {
    href: "/inzichten",
    label: "inzichten",
    isActive: (p: string) => p.startsWith("/inzichten"),
  },
  {
    href: "/tools",
    label: "tools",
    isActive: (p: string) =>
      p.startsWith("/tools") ||
      p.startsWith("/planner") ||
      p.startsWith("/inbox"),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="font-plex-mono flex h-16 flex-none items-center justify-center gap-7 pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`px-3 py-3 text-[12.5px] ${
            tab.isActive(pathname) ? "text-[#E9EBEA]" : "text-[#6C7377]"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
