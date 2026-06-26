"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export type UploadState = { error?: string; ok?: boolean };

/** Lädt eine Datei (Foto/PDF) zu einem Eingangsbeleg hoch und verknüpft sie. */
export async function uploadReceiptFile(
  openInvoiceId: string,
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Bitte eine Datei wählen." };
  if (!ALLOWED.includes(file.type)) return { error: "Nur PDF, JPG, PNG oder HEIC erlaubt." };
  if (file.size > MAX_BYTES) return { error: "Datei zu groß (max. 10 MB)." };

  const supabase = await requireUser();
  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const path = `eingang/${openInvoiceId}/${Date.now()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from("belege")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { error: "Upload fehlgeschlagen: " + upErr.message };

  const { data: rf, error: rfErr } = await supabase
    .from("receipt_files")
    .insert({ storage_path: path, source: "manual" })
    .select("id")
    .single();
  if (rfErr || !rf) return { error: "Speichern fehlgeschlagen: " + (rfErr?.message ?? "unbekannt") };

  const { error: linkErr } = await supabase
    .from("open_invoices")
    .update({ receipt_file_id: rf.id })
    .eq("id", openInvoiceId);
  if (linkErr) return { error: "Verknüpfen fehlgeschlagen: " + linkErr.message };

  revalidatePath(`/belege/eingang/${openInvoiceId}`);
  revalidatePath("/belege");
  return { ok: true };
}
