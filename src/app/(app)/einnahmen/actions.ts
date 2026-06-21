"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { parseEuroToCents } from "@/lib/format";
import { isValidMonth } from "@/lib/month";
import { Constants } from "@/lib/supabase/database.types";
import type { Database } from "@/lib/supabase/database.types";

type Status = Database["public"]["Enums"]["income_status"];

export type FormState = { error?: string; ok?: boolean };

export async function createIncome(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const monthRaw = String(formData.get("month") ?? "");
  if (!isValidMonth(monthRaw)) return { error: "Ungültiger Monat." };

  let source = String(formData.get("source") ?? "").trim();
  if (source === "__custom__") {
    source = String(formData.get("custom_source") ?? "").trim();
  }
  if (!source) return { error: "Bitte eine Quelle wählen oder eingeben." };

  const status = String(formData.get("status") ?? "") as Status;
  if (!Constants.public.Enums.income_status.includes(status)) {
    return { error: "Ungültiger Status." };
  }

  let amount_cents: number;
  try {
    amount_cents = parseEuroToCents(String(formData.get("amount") ?? ""));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Betrag ungültig." };
  }
  if (amount_cents <= 0) return { error: "Der Betrag muss größer als 0 sein." };

  const receiptRaw = String(formData.get("receipt_date") ?? "").trim();
  const receipt_date = receiptRaw === "" ? null : receiptRaw;

  const supabase = await requireUser();
  const { error } = await supabase.from("income_entries").insert({
    source,
    status,
    amount_cents,
    month: `${monthRaw}-01`,
    receipt_date,
  });
  if (error) return { error: "Speichern fehlgeschlagen: " + error.message };

  revalidatePath("/einnahmen");
  return { ok: true };
}

export async function updateIncomeDate(id: string, date: string | null) {
  const value = date && date.trim() !== "" ? date.trim() : null;
  const supabase = await requireUser();
  await supabase.from("income_entries").update({ receipt_date: value }).eq("id", id);
  revalidatePath("/einnahmen");
}

export async function setIncomeStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as Status;
  if (!Constants.public.Enums.income_status.includes(status)) return;
  const supabase = await requireUser();
  await supabase.from("income_entries").update({ status }).eq("id", id);
  revalidatePath("/einnahmen");
}

export async function deleteIncome(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await requireUser();
  await supabase.from("income_entries").delete().eq("id", id);
  revalidatePath("/einnahmen");
}
