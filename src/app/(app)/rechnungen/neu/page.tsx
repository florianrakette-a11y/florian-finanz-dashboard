import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InvoiceForm } from "../invoice-form";
import { createInvoice } from "../actions";
import { suggestInvoiceNumber } from "../suggest-number";

export default async function NeueRechnungPage() {
  const supabase = await createClient();
  const [{ data: customers }, { data: companies }] = await Promise.all([
    supabase.from("customers")
      .select("id, company_name, first_name, last_name, street, zip_code, city, company_id")
      .order("customer_number"),
    supabase.from("companies").select("*").order("name"),
  ]);

  const suggestedNumber = await suggestInvoiceNumber(supabase);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/rechnungen" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Zurück zu Rechnungen
        </Link>
        <h2 className="mt-2 text-2xl font-semibold text-neutral-900">Neue Rechnung</h2>
      </div>

      <InvoiceForm
        action={createInvoice}
        customers={customers ?? []}
        companies={companies ?? []}
        suggestedNumber={suggestedNumber}
        submitLabel="Rechnung speichern"
      />
    </div>
  );
}
