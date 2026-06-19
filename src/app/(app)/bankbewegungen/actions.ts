"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  fetchAccounts,
  fetchTransactions,
  bbAmountToCents,
  bbDateOnly,
  type BBTransaction,
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

  // Konten ermitteln und Kontist + PayPal getrennt abrufen, um die Herkunft zu kennen.
  const rows: {
    bb_transaction_id: string;
    date: string;
    amount_cents: number;
    counterpart: string | null;
    purpose: string | null;
    raw_payload: BBTransaction;
    bb_account: string;
  }[] = [];

  try {
    const accounts = await fetchAccounts();
    const kontist = accounts.find((a) => /kontist/i.test(a.name));
    const paypal = accounts.find((a) => a.name === "PayPal");

    const sources = [
      { label: "Kontist", number: kontist?.postingaccount_number },
      { label: "PayPal", number: paypal?.postingaccount_number },
    ].filter((s): s is { label: string; number: string } => Boolean(s.number));

    for (const src of sources) {
      const tx = await fetchTransactions({
        dateFrom: from,
        dateTo: to,
        account: Number(src.number),
      });
      for (const t of tx) {
        rows.push({
          bb_transaction_id: String(t.id_by_customer),
          date: bbDateOnly(t.booking_date),
          amount_cents: bbAmountToCents(t.amount),
          counterpart: t.to_from ?? null,
          purpose: t.purpose ?? null,
          raw_payload: t,
          bb_account: src.label,
        });
      }
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Abruf fehlgeschlagen." };
  }

  if (rows.length === 0) {
    return { ok: true, message: `${monthLabel(month)}: keine Transaktionen gefunden.` };
  }

  // Vorhandene zählen, um "neu" zu ermitteln (Dedup über bb_transaction_id).
  const { count: before } = await supabase
    .from("bank_transactions")
    .select("*", { count: "exact", head: true });

  // Upsert (merge): aktualisiert auch das Herkunftskonto bestehender Zeilen.
  // match_status ist nicht im Payload und bleibt dadurch erhalten.
  const { error } = await supabase
    .from("bank_transactions")
    .upsert(rows, { onConflict: "bb_transaction_id" });
  if (error) return { ok: false, message: "Speichern fehlgeschlagen: " + error.message };

  const { count: after } = await supabase
    .from("bank_transactions")
    .select("*", { count: "exact", head: true });

  const neu = (after ?? 0) - (before ?? 0);
  revalidatePath("/bankbewegungen");
  return {
    ok: true,
    message: `${monthLabel(month)}: ${rows.length} Transaktionen abgerufen, ${neu} neu gespeichert.`,
  };
}
