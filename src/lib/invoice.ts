import type { Database } from "@/lib/supabase/database.types";

type Customer = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  "company_name" | "first_name" | "last_name"
>;

/** Anzeigename eines Kunden: Firmenname, sonst Vor-/Nachname. */
export function customerDisplayName(c: Customer | null | undefined): string {
  if (!c) return "—";
  if (c.company_name) return c.company_name;
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  open: "Offen",
  paid: "Bezahlt",
  overdue: "Überfällig",
  cancelled: "Storniert",
};

export const INVOICE_STATUS_CLASSES: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  open: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-neutral-200 text-neutral-500 line-through",
};

export const UNIT_LABELS: Record<string, string> = {
  stueck: "Stück",
  stunden: "Stunden",
  pauschal: "Pauschal",
  tage: "Tage",
  km: "km",
};

/** ISO-Timestamp → "TT.MM.JJJJ" (de-DE). Leer → "". */
export function formatInvoiceDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(iso));
}
