"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseEuroToCents } from "@/lib/format";

export type FormState = { error?: string; ok?: boolean };

async function getAuthedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return supabase;
}

export async function createVariableExpense(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const date = String(formData.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Bitte ein gültiges Datum wählen." };

  let amount_cents: number;
  try {
    amount_cents = parseEuroToCents(String(formData.get("amount") ?? ""));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Betrag ungültig." };
  }
  if (amount_cents <= 0) return { error: "Der Betrag muss größer als 0 sein." };

  let category = String(formData.get("category") ?? "").trim();
  if (category === "__custom__") category = String(formData.get("custom_category") ?? "").trim();
  if (!category) return { error: "Bitte eine Kategorie wählen oder eingeben." };

  const description = String(formData.get("description") ?? "").trim() || null;

  const supabase = await getAuthedClient();
  const { error } = await supabase.from("variable_expenses").insert({
    date,
    amount_cents,
    category,
    description,
    source: "manual",
  });
  if (error) return { error: "Speichern fehlgeschlagen: " + error.message };

  revalidatePath("/variable-ausgaben");
  return { ok: true };
}

export async function updateVariableExpenseCategory(id: string, category: string) {
  const c = category.trim();
  if (!c) return;
  const supabase = await getAuthedClient();
  await supabase.from("variable_expenses").update({ category: c }).eq("id", id);
  revalidatePath("/variable-ausgaben");
}

export async function deleteVariableExpense(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await getAuthedClient();
  await supabase.from("variable_expenses").delete().eq("id", id);
  revalidatePath("/variable-ausgaben");
}
