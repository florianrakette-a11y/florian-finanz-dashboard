import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/format";
import { formatInvoiceDate } from "@/lib/invoice";
import { UploadForm } from "./upload-form";

const STATUS: Record<string, string> = { open: "Offen", paid: "Bezahlt", reminded: "Angemahnt" };

export default async function EingangsbelegPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("open_invoices")
    .select("*, receipt_files(id, storage_path)")
    .eq("id", id)
    .maybeSingle();

  if (!inv) notFound();
  const hasFile = Boolean(inv.receipt_files?.storage_path);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/belege?tab=eingang" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Zurück zu Belegen
        </Link>
        <h2 className="mt-2 text-2xl font-semibold text-neutral-900">{inv.recipient}</h2>
        <p className="text-sm text-neutral-500">Eingangsbeleg</p>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-2xl border border-neutral-200 bg-white p-6 text-sm">
        <div><span className="text-neutral-500">Betrag:</span> <span className="font-medium tabular-nums">{formatCents(inv.amount_cents)}</span></div>
        <div><span className="text-neutral-500">Status:</span> {STATUS[inv.status] ?? inv.status}</div>
        <div><span className="text-neutral-500">Fällig:</span> {inv.due_date ? formatInvoiceDate(inv.due_date) : "—"}</div>
        {inv.iban && <div><span className="text-neutral-500">IBAN:</span> {inv.iban}</div>}
        {inv.purpose && <div className="col-span-2"><span className="text-neutral-500">Verwendungszweck:</span> {inv.purpose}</div>}
        {inv.description && <div className="col-span-2"><span className="text-neutral-500">Notiz:</span> {inv.description}</div>}
      </div>

      <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-6">
        <h3 className="text-base font-semibold text-neutral-900">Datei</h3>
        {hasFile ? (
          <div className="flex flex-wrap gap-3">
            <a href={`/belege/eingang/${id}/datei`} target="_blank" rel="noopener"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
              Datei ansehen
            </a>
            <a href={`/belege/eingang/${id}/datei?download=1`}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
              Herunterladen
            </a>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Noch keine Datei (Foto/PDF) hinterlegt.</p>
        )}
        <div className="border-t border-neutral-100 pt-3">
          <UploadForm openInvoiceId={id} hasFile={hasFile} />
        </div>
      </div>
    </div>
  );
}
