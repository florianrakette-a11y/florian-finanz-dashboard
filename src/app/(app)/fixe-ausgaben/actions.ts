"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseEuroToCents } from "@/lib/format";
import { Constants } from "@/lib/supabase/database.types";
import type { Database } from "@/lib/supabase/database.types";

type Category = Database["public"]["Enums"]["fixed_expense_category"];
type Frequency = Database["public"]["Enums"]["expense_frequency"];

export type FormState = { error?: string; ok?: boolean };

/** Stellt sicher, dass ein Nutzer angemeldet ist (Server Actions sind per POST direkt erreichbar). */
async function getAuthedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return supabase;
}

/** Liest und validiert die Formularfelder einer fixen Ausgabe. */
function parseForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Bitte einen Namen angeben.");

  const amount_cents = parseEuroToCents(String(formData.get("amount") ?? ""));
  if (amount_cents <= 0) throw new Error("Der Betrag muss größer als 0 sein.");

  const category = String(formData.get("category") ?? "") as Category;
  if (!Constants.public.Enums.fixed_expense_category.includes(category)) {
    throw new Error("Ungültige Kategorie.");
  }

  const frequency = String(formData.get("frequency") ?? "") as Frequency;
  if (!Constants.public.Enums.expense_frequency.includes(frequency)) {
    throw new Error("Ungültiger Turnus.");
  }

  const due_day_of_month = Number(formData.get("due_day_of_month"));
  if (
    !Number.isInteger(due_day_of_month) ||
    due_day_of_month < 1 ||
    due_day_of_month > 31
  ) {
    throw new Error("Fälligkeitstag muss zwischen 1 und 31 liegen.");
  }

  const endRaw = String(formData.get("end_date") ?? "").trim();
  const end_date = endRaw === "" ? null : endRaw;

  const active = formData.get("active") != null;

  return { name, amount_cents, category, frequency, due_day_of_month, end_date, active };
}

export async function createFixedExpense(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let values;
  try {
    values = parseForm(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eingabe ungültig." };
  }

  const supabase = await getAuthedClient();
  const { error } = await supabase.from("fixed_expenses").insert(values);
  if (error) return { error: "Speichern fehlgeschlagen: " + error.message };

  revalidatePath("/fixe-ausgaben");
  return { ok: true };
}

export async function updateFixedExpense(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let values;
  try {
    values = parseForm(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eingabe ungültig." };
  }

  const supabase = await getAuthedClient();
  const { error } = await supabase
    .from("fixed_expenses")
    .update(values)
    .eq("id", id);
  if (error) return { error: "Speichern fehlgeschlagen: " + error.message };

  revalidatePath("/fixe-ausgaben");
  redirect("/fixe-ausgaben");
}

export async function deleteFixedExpense(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await getAuthedClient();
  await supabase.from("fixed_expenses").delete().eq("id", id);
  revalidatePath("/fixe-ausgaben");
}

export async function toggleFixedExpenseActive(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  const supabase = await getAuthedClient();
  await supabase.from("fixed_expenses").update({ active: !active }).eq("id", id);
  revalidatePath("/fixe-ausgaben");
}
