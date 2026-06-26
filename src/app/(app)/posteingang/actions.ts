"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { parseEuroToCents } from "@/lib/format";
import { uploadReceipt } from "@/lib/buchhaltungsbutler";

export type InboxState = { error?: string };

const VAT_TO_BB: Record<string, string> = { "19": "19.00", "7": "7.00", "0": "0", "": "" };

async function loadImport(id: string) {
  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("email_imports")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error("Beleg nicht gefunden.");
  return { supabase, imp: data };
}

/** Lädt die gespeicherte PDF und schiebt sie an Buchhaltungsbutler. Fehler nicht-fatal. */
async function pushToBB(
  supabase: Awaited<ReturnType<typeof requireUser>>,
  storagePath: string,
  counterparty: string,
  amountCents: number,
  date: string | null,
  vatRaw: string,
) {
  const { data: file } = await supabase.storage.from("belege").download(storagePath);
  if (!file) return;
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  await uploadReceipt({
    fileBase64: base64,
    fileName: storagePath.split("/").pop() || "beleg.pdf",
    type: "invoice inbound",
    amount: amountCents / 100,
    date: date || undefined,
    counterparty: counterparty || undefined,
    vatRate: VAT_TO_BB[vatRaw] ?? "",
  });
}

export async function confirmAsExpense(_prev: InboxState, formData: FormData): Promise<InboxState> {
  const id = String(formData.get("id") ?? "");
  const category = String(formData.get("category") ?? "").trim() || "Sonstiges";
  const date = String(formData.get("date") ?? "").trim();
  const vat = String(formData.get("vat_rate") ?? "");
  let amountCents: number;
  try {
    amountCents = parseEuroToCents(String(formData.get("amount") ?? ""));
  } catch {
    return { error: "Betrag ungültig." };
  }
  if (amountCents <= 0) return { error: "Betrag muss größer 0 sein." };

  const { supabase, imp } = await loadImport(id);

  const { data: rf, error: rfErr } = await supabase
    .from("receipt_files")
    .insert({ storage_path: imp.storage_path, source: "email_attachment" })
    .select("id")
    .single();
  if (rfErr || !rf) return { error: "Beleg-Datei speichern fehlgeschlagen." };

  const { error } = await supabase.from("variable_expenses").insert({
    date: date || (imp.received_at ? imp.received_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
    amount_cents: amountCents,
    category,
    description: imp.sender || imp.subject || null,
    source: "manual",
    receipt_file_id: rf.id,
  });
  if (error) return { error: "Ausgabe speichern fehlgeschlagen: " + error.message };

  try {
    await pushToBB(supabase, imp.storage_path, imp.sender || "", amountCents, date || (imp.received_at?.slice(0, 10) ?? null), vat);
  } catch {
    /* BB-Fehler ignorieren – Beleg ist gespeichert */
  }

  await supabase.from("email_imports").update({ status: "confirmed" }).eq("id", id);
  revalidatePath("/posteingang");
  revalidatePath("/variable-ausgaben");
  return {};
}

export async function confirmAsInvoice(_prev: InboxState, formData: FormData): Promise<InboxState> {
  const id = String(formData.get("id") ?? "");
  const date = String(formData.get("date") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim();
  const vat = String(formData.get("vat_rate") ?? "");
  let amountCents: number;
  try {
    amountCents = parseEuroToCents(String(formData.get("amount") ?? ""));
  } catch {
    return { error: "Betrag ungültig." };
  }
  if (amountCents <= 0) return { error: "Betrag muss größer 0 sein." };

  const { supabase, imp } = await loadImport(id);

  const { data: rf, error: rfErr } = await supabase
    .from("receipt_files")
    .insert({ storage_path: imp.storage_path, source: "email_attachment" })
    .select("id")
    .single();
  if (rfErr || !rf) return { error: "Beleg-Datei speichern fehlgeschlagen." };

  const { error } = await supabase.from("open_invoices").insert({
    recipient: imp.sender || "Unbekannt",
    amount_cents: amountCents,
    due_date: date || null,
    purpose: purpose || imp.subject || null,
    status: "open",
    source: "email",
    receipt_file_id: rf.id,
    email_message_id: imp.message_id,
  });
  if (error) return { error: "Offene Rechnung speichern fehlgeschlagen: " + error.message };

  try {
    await pushToBB(supabase, imp.storage_path, imp.sender || "", amountCents, date || null, vat);
  } catch {
    /* BB-Fehler ignorieren */
  }

  await supabase.from("email_imports").update({ status: "confirmed" }).eq("id", id);
  revalidatePath("/posteingang");
  revalidatePath("/offene-rechnungen");
  return {};
}

export async function rejectImport(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const supabase = await requireUser();
  await supabase.from("email_imports").update({ status: "rejected" }).eq("id", id);
  revalidatePath("/posteingang");
}
