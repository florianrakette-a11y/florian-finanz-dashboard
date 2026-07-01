import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/format";
import {
  customerDisplayName,
  formatInvoiceDate,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_CLASSES,
  UNIT_LABELS,
} from "@/lib/invoice";
import { DeleteButton } from "@/components/delete-button";
import { setInvoiceStatus, deleteInvoice } from "../actions";
import { EmailForm } from "./email-form";

export default async function RechnungDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoiceId = Number(id);
  if (!Number.isFinite(invoiceId)) notFound();

  const supabase = await createClient();
  const [{ data: invoice }, { data: items }, { data: settings }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, customers(*)")
      .eq("id", invoiceId)
      .single(),
    supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("position", { ascending: true }),
    supabase.from("invoice_settings").select("key, value").eq("key", "emailSignature").maybeSingle(),
  ]);

  if (!invoice) notFound();
  const customer = invoice.customers;
  const lines = items ?? [];
  const signature = settings?.value ?? "";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/rechnungen" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Zurück zu Rechnungen
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h2 className="text-2xl font-semibold text-neutral-900">{invoice.invoice_number}</h2>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${INVOICE_STATUS_CLASSES[invoice.status] ?? ""}`}>
            {INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a href={`/rechnungen/${invoice.id}/pdf`} target="_blank" rel="noopener"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
          PDF ansehen
        </a>
        <a href={`/rechnungen/${invoice.id}/pdf?download=1`}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
          PDF herunterladen
        </a>
        <Link href={`/rechnungen/${invoice.id}/bearbeiten`}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
          Bearbeiten
        </Link>
        {invoice.status !== "paid" && (
          <form action={setInvoiceStatus}>
            <input type="hidden" name="id" value={invoice.id} />
            <input type="hidden" name="status" value="paid" />
            <button className="rounded-lg border border-green-300 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50">
              Als bezahlt markieren
            </button>
          </form>
        )}
        {invoice.status === "draft" && (
          <form action={setInvoiceStatus}>
            <input type="hidden" name="id" value={invoice.id} />
            <input type="hidden" name="status" value="open" />
            <button className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
              Festschreiben (offen)
            </button>
          </form>
        )}
        {invoice.status !== "cancelled" && (
          <form action={setInvoiceStatus}>
            <input type="hidden" name="id" value={invoice.id} />
            <input type="hidden" name="status" value="cancelled" />
            <button className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
              Stornieren
            </button>
          </form>
        )}
        <DeleteButton action={deleteInvoice} id={String(invoice.id)} name={`Rechnung ${invoice.invoice_number}`} />
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-2xl border border-neutral-200 bg-white p-6 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">Kunde</div>
          <div className="mt-1 font-medium">{customerDisplayName(customer)}</div>
          {customer && (
            <div className="text-neutral-600">
              {customer.street && <div>{customer.street}</div>}
              <div>{[customer.zip_code, customer.city].filter(Boolean).join(" ")}</div>
            </div>
          )}
        </div>
        <div className="space-y-1 text-right">
          <div><span className="text-neutral-500">Rechnungsdatum:</span> {formatInvoiceDate(invoice.invoice_date)}</div>
          <div><span className="text-neutral-500">Fällig:</span> {formatInvoiceDate(invoice.due_date)}</div>
          {invoice.is_reverse_charge && (
            <div className="text-amber-700">Reverse Charge (Steuerschuldnerschaft des Leistungsempfängers)</div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Position</th>
              <th className="px-4 py-3 text-right font-medium">Menge</th>
              <th className="px-4 py-3 text-right font-medium">Einzelpreis</th>
              <th className="px-4 py-3 text-right font-medium">Gesamt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {lines.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-neutral-500">Keine Positionen.</td></tr>
            ) : (
              lines.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{it.description}</div>
                    {it.details && <div className="text-xs text-neutral-500">{it.details}</div>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {Number(it.quantity)} {UNIT_LABELS[it.unit] ?? it.unit}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCents(it.unit_price)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCents(it.total)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t border-neutral-200 text-sm">
            <tr>
              <td colSpan={3} className="px-4 py-2 text-right text-neutral-500">Zwischensumme</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCents(invoice.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="px-4 py-2 text-right text-neutral-500">
                USt. {invoice.vat_rate}%
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCents(invoice.vat_amount)}</td>
            </tr>
            <tr className="font-semibold">
              <td colSpan={3} className="px-4 py-3 text-right">Gesamtbetrag</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatCents(invoice.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {invoice.notes && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Notizen</div>
          <p className="mt-1 whitespace-pre-wrap text-neutral-700">{invoice.notes}</p>
        </div>
      )}

      <details className="rounded-2xl border border-neutral-200 bg-white p-6">
        <summary className="cursor-pointer text-base font-semibold text-neutral-900">
          Per E-Mail senden
        </summary>
        <div className="mt-4">
          <EmailForm
            invoiceId={invoice.id}
            defaultTo={customer?.email ?? ""}
            defaultSubject={`Rechnung ${invoice.invoice_number}`}
            defaultMessage={
              `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie die Rechnung ${invoice.invoice_number} als PDF.\n\n` +
              (signature || "Mit freundlichen Grüßen")
            }
          />
        </div>
      </details>
    </div>
  );
}
