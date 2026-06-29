"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Übersicht" },
  { href: "/fixe-ausgaben", label: "Fixe Ausgaben" },
  { href: "/variable-ausgaben", label: "Variable Ausgaben" },
  { href: "/offene-rechnungen", label: "Offene Rechnungen" },
  { href: "/bankbewegungen", label: "Bankbewegungen" },
  { href: "/einnahmen", label: "Einnahmen" },
  { href: "/scannen", label: "Belege scannen" },
  { href: "/posteingang", label: "Posteingang" },
  { href: "/belege", label: "Belege" },
  { href: "/kunden", label: "Kunden" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-neutral-900 text-white"
                : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
