"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseEuroToCents } from "@/lib/format";
import { Constants } from "@/lib/supabase/database.types";
import type { Database } from "@/lib/supabase/database.types";

type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];

export type FormState = { error?: string; ok?: boolean };

async function getAuthedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return supabase;
}

export async function createInvoice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const recipient = String(formData.get("recipient") ?? "").trim();
  if (!recipient) return { error: "Bitte einen Empfänger angeben." };

  let amount_cents: number;
  try {
    amount_cents = parseEuroToCents(String(formData.get("amount") ?? ""));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Betrag ungültig." };
  }
  if (amount_cents <= 0) return { error: "Der Betrag muss größer als 0 sein." };

  const dueRaw = String(formData.get("due_date") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const iban = String(formData.get("iban") ?? "").trim() || null;

  const supabase = await getAuthedClient();
  const { error } = await supabase.from("open_invoices").insert({
    recipient,
    amount_cents,
    due_date: dueRaw === "" ? null : dueRaw,
    description,
    iban,
    status: "open",
    source: "manual",
  });
  if (error) return { error: "Speichern fehlgeschlagen: " + error.message };

  revalidatePath("/offene-rechnungen");
  return { ok: true };
}

export async function updateInvoiceDescription(id: string, text: string) {
  const value = text.trim() === "" ? null : text.trim();
  const supabase = await getAuthedClient();
  await supabase.from("open_invoices").update({ description: value }).eq("id", id);
  revalidatePath("/offene-rechnungen");
}

export async function setInvoiceStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as InvoiceStatus;
  if (!Constants.public.Enums.invoice_status.includes(status)) return;

  const supabase = await getAuthedClient();
  await supabase.from("open_invoices").update({ status }).eq("id", id);
  revalidatePath("/offene-rechnungen");
}

export async function deleteInvoice(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await getAuthedClient();
  await supabase.from("open_invoices").delete().eq("id", id);
  revalidatePath("/offene-rechnungen");
}

/** Übernimmt eine erkannte fehlgeschlagene Abbuchung als offene Rechnung. */
export async function createInvoiceFromFailedDebit(formData: FormData) {
  const recipient = String(formData.get("recipient") ?? "").trim();
  const amount_cents = Number(formData.get("amount_cents"));
  const due_date = String(formData.get("due_date") ?? "").trim() || null;
  const purpose = String(formData.get("purpose") ?? "").trim() || null;
  if (!recipient || !Number.isFinite(amount_cents) || amount_cents <= 0) return;

  const supabase = await getAuthedClient();
  const { error } = await supabase.from("open_invoices").insert({
    recipient,
    amount_cents,
    due_date,
    purpose,
    status: "open",
    source: "manual",
  });
  if (!error) revalidatePath("/offene-rechnungen");
}
