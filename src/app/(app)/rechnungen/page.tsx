import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/format";
import {
  customerDisplayName,
  formatInvoiceDate,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_CLASSES,
} from "@/lib/invoice";

export default async function RechnungenPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*, customers(company_name, first_name, last_name)")
    .order("invoice_date", { ascending: false });

  if (error) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        Fehler beim Laden: {error.message}
      </p>
    );
  }

  const rows = data ?? [];
  const openTotal = rows
    .filter((r) => r.status === "open" || r.status === "overdue")
    .reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-semibold text-neutral-900">Rechnungen</h2>
        <div className="rounded-2xl bg-neutral-900 px-5 py-3 text-right text-white">
          <div className="text-xs text-neutral-300">Offen gesamt</div>
          <div className="text-xl font-semibold">{formatCents(openTotal)}</div>
        </div>
      </div>

      <div>
        <Link
          href="/rechnungen/neu"
          className="inline-block rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          + Neue Rechnung
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          Noch keine Rechnungen.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nummer</th>
                <th className="px-4 py-3 font-medium">Kunde</th>
                <th className="px-4 py-3 font-medium">Datum</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Betrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/rechnungen/${r.id}`} className="hover:underline">
                      {r.invoice_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{customerDisplayName(r.customers)}</td>
                  <td className="px-4 py-3 text-neutral-600">{formatInvoiceDate(r.invoice_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${INVOICE_STATUS_CLASSES[r.status] ?? ""}`}>
                      {INVOICE_STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCents(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
