"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BulkResult = { ok: boolean; message: string };

async function getAuthedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return supabase;
}

async function loadTxns(
  supabase: Awaited<ReturnType<typeof getAuthedClient>>,
  ids: string[],
) {
  const { data } = await supabase.from("bank_transactions").select("*").in("id", ids);
  return data ?? [];
}

function refreshTargets(...paths: string[]) {
  revalidatePath("/bankbewegungen");
  for (const p of paths) revalidatePath(p);
}

/** Ausgewählte Bewegungen als variable Ausgaben übernehmen (Standard-Kategorie „privat"). */
export async function addToVariableExpenses(ids: string[]): Promise<BulkResult> {
  if (ids.length === 0) return { ok: false, message: "Nichts ausgewählt." };
  const supabase = await getAuthedClient();
  const txns = await loadTxns(supabase, ids);

  let created = 0;
  for (const t of txns) {
    const { data: ins, error } = await supabase
      .from("variable_expenses")
      .insert({
        date: t.date,
        amount_cents: Math.abs(t.amount_cents),
        category: "privat",
        description: t.counterpart,
        source: "bank_match",
        bank_transaction_id: t.id,
      })
      .select("id")
      .single();
    if (!error && ins) {
      created++;
      await supabase
        .from("bank_transactions")
        .update({ match_status: "matched", matched_variable_expense_id: ins.id })
        .eq("id", t.id);
    }
  }

  refreshTargets("/variable-ausgaben");
  return {
    ok: true,
    message: `${created} zu variablen Ausgaben hinzugefügt (Kategorie „privat" – bei Bedarf anpassen).`,
  };
}

/** Ausgewählte Bewegungen als fixe Ausgaben übernehmen (Standard: monatlich). */
export async function addToFixedExpenses(ids: string[]): Promise<BulkResult> {
  if (ids.length === 0) return { ok: false, message: "Nichts ausgewählt." };
  const supabase = await getAuthedClient();
  const txns = await loadTxns(supabase, ids);

  let created = 0;
  for (const t of txns) {
    const { data: ins, error } = await supabase
      .from("fixed_expenses")
      .insert({
        name: t.counterpart ?? "Unbenannt",
        amount_cents: Math.abs(t.amount_cents),
        category: "Sonstiger Betriebsbedarf",
        due_day_of_month: Number(t.date.slice(8, 10)),
        frequency: "monthly",
        start_date: t.date,
        active: true,
      })
      .select("id")
      .single();
    if (!error && ins) {
      created++;
      await supabase
        .from("bank_transactions")
        .update({ match_status: "matched", matched_fixed_expense_id: ins.id })
        .eq("id", t.id);
    }
  }

  refreshTargets("/fixe-ausgaben");
  return {
    ok: true,
    message: `${created} zu fixen Ausgaben hinzugefügt (monatlich, Kategorie „Sonstiger Betriebsbedarf" – bei Bedarf anpassen).`,
  };
}

/** Ausgewählte GELDEINGÄNGE (positiv) als Einnahmen übernehmen. */
export async function addToIncome(ids: string[]): Promise<BulkResult> {
  if (ids.length === 0) return { ok: false, message: "Nichts ausgewählt." };
  const supabase = await getAuthedClient();
  const txns = await loadTxns(supabase, ids);

  let created = 0;
  let skipped = 0;
  for (const t of txns) {
    if (t.amount_cents <= 0) {
      skipped++;
      continue;
    }
    const { error } = await supabase.from("income_entries").insert({
      source: "elysium_or_other",
      month: `${t.date.slice(0, 7)}-01`,
      amount_cents: t.amount_cents,
      status: "received",
    });
    if (!error) {
      created++;
      await supabase
        .from("bank_transactions")
        .update({ match_status: "matched" })
        .eq("id", t.id);
    }
  }

  refreshTargets("/einnahmen");
  const skipMsg = skipped > 0 ? ` ${skipped} übersprungen (keine Eingänge).` : "";
  return {
    ok: true,
    message: `${created} zu Einnahmen hinzugefügt (Quelle „Sonstige" – bei Bedarf anpassen).${skipMsg}`,
  };
}
