import type { Database } from "@/lib/supabase/database.types";

type Frequency = Database["public"]["Enums"]["expense_frequency"];

/** Cent-Betrag als deutscher Währungsstring, z. B. 17200 -> "172,00 €". */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

/** Cent-Betrag als reine Zahl fürs Eingabefeld, z. B. 17200 -> "172,00". */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Wandelt eine Benutzereingabe ("172", "172,00", "1.234,56", "45,97 €")
 * in ganze Cent um. Wirft bei ungültiger Eingabe.
 */
export function parseEuroToCents(input: string): number {
  let s = input.trim().replace(/[€\s]/g, "");
  if (s === "") throw new Error("Betrag fehlt.");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Punkt = Tausendertrennzeichen, Komma = Dezimaltrennzeichen
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  // nur Punkt oder nur Ziffern: bereits dezimal-tauglich

  const value = Number(s);
  if (!Number.isFinite(value)) throw new Error("Betrag ist keine gültige Zahl.");
  if (value < 0) throw new Error("Betrag darf nicht negativ sein.");

  return Math.round(value * 100);
}

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  monthly: "Monatlich",
  quarterly: "Vierteljährlich",
  biannual: "Halbjährlich",
  yearly: "Jährlich",
};
