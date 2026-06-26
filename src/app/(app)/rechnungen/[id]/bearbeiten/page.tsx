import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { centsToInput } from "@/lib/format";
import { InvoiceForm, type PositionInput } from "../../invoice-form";
import { updateInvoice } from "../../actions";

export default async function RechnungBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoiceId = Number(id);
  if (!Number.isFinite(invoiceId)) notFound();

  const supabase = await createClient();
  const [{ data: invoice }, { data: items }, { data: customers }, { data: companies }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", invoiceId).single(),
    supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("position"),
    supabase.from("customers")
      .select("id, company_name, first_name, last_name, street, zip_code, city, company_id")
      .order("customer_number"),
    supabase.from("companies").select("*").order("name"),
  ]);

  if (!invoice) notFound();

  const positions: PositionInput[] = (items ?? []).map((it) => ({
    description: it.description,
    details: it.details ?? "",
    quantity: String(Number(it.quantity)),
    price: centsToInput(it.unit_price),
    unit: it.unit,
    vatRate: it.vat_rate,
  }));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href={`/rechnungen/${invoiceId}`} className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Zurück zur Rechnung
        </Link>
        <h2 className="mt-2 text-2xl font-semibold text-neutral-900">
          Rechnung bearbeiten <span className="text-neutral-400">{invoice.invoice_number}</span>
        </h2>
      </div>

      <InvoiceForm
        action={updateInvoice.bind(null, invoiceId)}
        customers={customers ?? []}
        companies={companies ?? []}
        suggestedNumber={invoice.invoice_number}
        initial={{
          customer_id: invoice.customer_id,
          company_id: invoice.company_id,
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date.slice(0, 10),
          service_start_date: invoice.service_start_date?.slice(0, 10) ?? "",
          service_end_date: invoice.service_end_date?.slice(0, 10) ?? "",
          payment_term_days: invoice.payment_term_days,
          is_reverse_charge: invoice.is_reverse_charge,
          status: invoice.status,
          notes: invoice.notes ?? "",
          positions: positions.length ? positions : [],
        }}
        submitLabel="Änderungen speichern"
      />
    </div>
  );
}
