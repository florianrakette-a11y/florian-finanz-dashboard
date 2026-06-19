import type { Database } from "@/lib/supabase/database.types";

type Row = Database["public"]["Tables"]["fixed_expenses"]["Row"];
type Frequency = Database["public"]["Enums"]["expense_frequency"];

const INTERVAL: Record<Frequency, number> = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  yearly: 12,
};

function ym(date: string): string {
  return date.slice(0, 7); // "YYYY-MM"
}

function monthsBetween(aYM: string, bYM: string): number {
  const [ay, am] = aYM.split("-").map(Number);
  const [by, bm] = bYM.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

/**
 * Ist die fixe Ausgabe im angegebenen Monat ("YYYY-MM") fällig?
 * Anker ist start_date; ab dort wiederholt sie sich im Turnus-Rhythmus,
 * bis (optional) end_date erreicht ist.
 */
export function isFixedDueInMonth(expense: Row, month: string): boolean {
  if (!expense.active) return false;
  const interval = INTERVAL[expense.frequency];

  // Ohne Anker: monatliche immer fällig (Altbestand), andere mangels Anker auch zeigen.
  if (!expense.start_date) return true;

  const anchor = ym(expense.start_date);
  if (month < anchor) return false; // vor der ersten Zahlung
  if (expense.end_date && month > ym(expense.end_date)) return false; // nach Ende
  return monthsBetween(anchor, month) % interval === 0;
}
