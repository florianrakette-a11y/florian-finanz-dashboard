import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomerForm } from "../customer-form";
import { updateCustomer } from "../actions";

export default async function KundeBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) notFound();

  const supabase = await createClient();
  const [{ data: customer }, { data: companies }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", customerId).single(),
    supabase.from("companies").select("id, name").order("name"),
  ]);

  if (!customer) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/kunden" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Zurück zu Kunden
        </Link>
        <h2 className="mt-2 text-2xl font-semibold text-neutral-900">
          Kunde bearbeiten <span className="text-neutral-400">#{customer.customer_number}</span>
        </h2>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <CustomerForm
          action={updateCustomer.bind(null, customerId)}
          initial={customer}
          companies={companies ?? []}
          submitLabel="Änderungen speichern"
        />
      </div>
    </div>
  );
}
