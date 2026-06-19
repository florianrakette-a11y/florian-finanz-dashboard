"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  fetchTransactions,
  bbAmountToCents,
  bbDateOnly,
} from "@/lib/buchhaltungsbutler";

/** Erster Tag des aktuellen Monats als 'YYYY-MM-DD' (lokale Zeit). */
function firstOfCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export type SyncState = { ok?: boolean; message?: string };

export async function syncBankTransactions(
  _prev: SyncState,
  _formData: FormData,
): Promise<SyncState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Nicht angemeldet." };

  const dateFrom = firstOfCurrentMonth();
  let transactions;
  try {
    transactions = await fetchTransactions({ dateFrom });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Abruf fehlgeschlagen." };
  }

  if (transactions.length === 0) {
    return { ok: true, message: "Keine Transaktionen im aktuellen Monat gefunden." };
  }

  const rows = transactions.map((t) => ({
    bb_transaction_id: String(t.id_by_customer),
    date: bbDateOnly(t.booking_date),
    amount_cents: bbAmountToCents(t.amount),
    counterpart: t.to_from ?? null,
    purpose: t.purpose ?? null,
    raw_payload: t,
  }));

  // Vorhandene zählen, um "neu" zu ermitteln (Dedup über bb_transaction_id).
  const { count: before } = await supabase
    .from("bank_transactions")
    .select("*", { count: "exact", head: true });

  // ON CONFLICT DO NOTHING: bestehende Bewegungen (inkl. Abgleich-Status) bleiben unangetastet.
  const { error } = await supabase
    .from("bank_transactions")
    .upsert(rows, { onConflict: "bb_transaction_id", ignoreDuplicates: true });
  if (error) return { ok: false, message: "Speichern fehlgeschlagen: " + error.message };

  const { count: after } = await supabase
    .from("bank_transactions")
    .select("*", { count: "exact", head: true });

  const neu = (after ?? 0) - (before ?? 0);
  revalidatePath("/bankbewegungen");
  return {
    ok: true,
    message: `Aktueller Monat: ${transactions.length} Transaktionen abgerufen, ${neu} neu gespeichert.`,
  };
}
