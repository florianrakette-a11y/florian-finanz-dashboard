"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { parseEuroToCents } from "@/lib/format";
import { imagesToPdf } from "@/lib/pdf/images-to-pdf";
import { uploadReceipt } from "@/lib/buchhaltungsbutler";

export type ScanState = { error?: string; ok?: boolean; info?: string };

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const m = /^data:.+?;base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return Buffer.from(m[1], "base64");
}

const VAT_TO_BB: Record<string, string> = { "19": "19.00", "7": "7.00", "0": "0", "": "" };

/**
 * Speichert einen Scan: Bilder -> PDF -> Storage + DB (bezahlte Ausgabe ODER offene Rechnung),
 * und lädt das PDF immer zu Buchhaltungsbutler hoch.
 */
export async function saveScan(_prev: ScanState, formData: FormData): Promise<ScanState> {
  const kind = String(formData.get("kind") ?? ""); // "paid" | "open"
  if (kind !== "paid" && kind !== "open") return { error: "Bitte wählen: bezahlt oder offene Rechnung." };

  const counterparty = String(formData.get("counterparty") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim(); // YYYY-MM-DD
  const category = String(formData.get("category") ?? "").trim() || "Sonstiges";
  const purpose = String(formData.get("purpose") ?? "").trim();
  const vatRaw = String(formData.get("vat_rate") ?? "");

  let amountCents: number;
  try {
    amountCents = parseEuroToCents(String(formData.get("amount") ?? ""));
  } catch {
    return { error: "Betrag ungültig." };
  }
  if (amountCents <= 0) return { error: "Betrag muss größer 0 sein." };

  let images: string[];
  try {
    images = JSON.parse(String(formData.get("images") ?? "[]"));
  } catch {
    return { error: "Bilder konnten nicht gelesen werden." };
  }
  const buffers = images.map(dataUrlToBuffer).filter((b): b is Buffer => b !== null);
  if (buffers.length === 0) return { error: "Mindestens ein Foto aufnehmen." };

  // 1) PDF bauen
  let pdf: Buffer;
  try {
    pdf = await imagesToPdf(buffers);
  } catch (e) {
    return { error: "PDF-Erzeugung fehlgeschlagen: " + (e instanceof Error ? e.message : "unbekannt") };
  }

  const supabase = await requireUser();

  // 2) PDF in Storage
  const fileName = `${counterparty.replace(/[^\w.-]+/g, "_") || "beleg"}-${Date.now()}.pdf`;
  const path = `scans/${fileName}`;
  const { error: upErr } = await supabase.storage
    .from("belege")
    .upload(path, pdf, { contentType: "application/pdf", upsert: false });
  if (upErr) return { error: "Speichern fehlgeschlagen: " + upErr.message };

  const { data: rf, error: rfErr } = await supabase
    .from("receipt_files")
    .insert({ storage_path: path, source: "photo_upload" })
    .select("id")
    .single();
  if (rfErr || !rf) return { error: "Beleg-Datei speichern fehlgeschlagen: " + (rfErr?.message ?? "?") };

  // 3) DB-Eintrag je nach Art
  if (kind === "paid") {
    const { error } = await supabase.from("variable_expenses").insert({
      date: dateStr || new Date().toISOString().slice(0, 10),
      amount_cents: amountCents,
      category,
      description: counterparty || purpose || null,
      source: "manual",
      receipt_file_id: rf.id,
    });
    if (error) return { error: "Ausgabe speichern fehlgeschlagen: " + error.message };
  } else {
    const { error } = await supabase.from("open_invoices").insert({
      recipient: counterparty || "Unbekannt",
      amount_cents: amountCents,
      due_date: dateStr || null,
      purpose: purpose || null,
      status: "open",
      source: "photo",
      receipt_file_id: rf.id,
    });
    if (error) return { error: "Offene Rechnung speichern fehlgeschlagen: " + error.message };
  }

  // 4) Immer: an Buchhaltungsbutler
  let bbInfo = "";
  try {
    const { fileName: bbName } = await uploadReceipt({
      fileBase64: pdf.toString("base64"),
      fileName,
      type: "invoice inbound",
      amount: amountCents / 100,
      date: dateStr || undefined,
      counterparty: counterparty || undefined,
      vatRate: VAT_TO_BB[vatRaw] ?? "",
    });
    bbInfo = `An Buchhaltungsbutler übertragen (${bbName || "ok"}).`;
  } catch (e) {
    // DB-Eintrag bleibt bestehen; BB-Fehler melden, nicht alles zurückrollen.
    bbInfo = "⚠️ Gespeichert, aber Buchhaltungsbutler-Upload fehlgeschlagen: " + (e instanceof Error ? e.message : "unbekannt");
  }

  revalidatePath("/belege");
  revalidatePath(kind === "paid" ? "/variable-ausgaben" : "/offene-rechnungen");
  return { ok: true, info: bbInfo };
}
