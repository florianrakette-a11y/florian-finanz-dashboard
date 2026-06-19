"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  fetchTransactions,
  bbAmountToCents,
  bbDateOnly,
} from "@/lib/buchhaltungsbutler";
import { currentMonth, isValidMonth, monthBounds, monthLabel } from "@/lib/month";

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

  const monthRaw = String(_formData.get("month") ?? "");
  const month = isValidMonth(monthRaw) ? monthRaw : currentMonth();
  const { from, to } = monthBounds(month);

  let transactions;
  try {
    transactions = await fetchTransactions({ dateFrom: from, dateTo: to });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Abruf fehlgeschlagen." };
  }

  if (transactions.length === 0) {
    return { ok: true, message: `${monthLabel(month)}: keine Transaktionen gefunden.` };
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
    message: `${monthLabel(month)}: ${transactions.length} Transaktionen abgerufen, ${neu} neu gespeichert.`,
  };
}
