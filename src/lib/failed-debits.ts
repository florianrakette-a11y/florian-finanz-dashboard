import type { Database } from "@/lib/supabase/database.types";

type Txn = Database["public"]["Tables"]["bank_transactions"]["Row"];

export type FailedDebit = {
  counterpart: string;
  amount_cents: number; // positiver Betrag (das, was offen ist)
  attempts: number; // Anzahl Abbuchung+Rückbuchung-Paare
  last_debit_date: string;
  purpose: string | null;
};

/**
 * Erkennt fehlgeschlagene Abbuchungen: Beträge, die abgebucht (negativ) UND
 * vom selben Empfänger wieder zurückgebucht (positiv, gleicher Betrag) wurden.
 * Solche Beträge sind faktisch offene Rechnungen.
 */
export function detectFailedDebits(txns: Txn[]): FailedDebit[] {
  const groups = new Map<string, { debits: Txn[]; credits: Txn[] }>();

  for (const t of txns) {
    if (!t.counterpart) continue;
    const key = `${t.counterpart}|${Math.abs(t.amount_cents)}`;
    const g = groups.get(key) ?? { debits: [], credits: [] };
    if (t.amount_cents < 0) g.debits.push(t);
    else if (t.amount_cents > 0) g.credits.push(t);
    groups.set(key, g);
  }

  const result: FailedDebit[] = [];
  for (const g of groups.values()) {
    if (g.debits.length === 0 || g.credits.length === 0) continue;
    const amount = Math.abs(g.debits[0].amount_cents);
    if (amount === 0) continue;
    const lastDebit = g.debits.reduce((a, b) => (a.date >= b.date ? a : b));
    result.push({
      counterpart: g.debits[0].counterpart as string,
      amount_cents: amount,
      attempts: Math.min(g.debits.length, g.credits.length),
      last_debit_date: lastDebit.date,
      purpose: lastDebit.purpose,
    });
  }

  return result.sort((a, b) => b.amount_cents - a.amount_cents);
}
