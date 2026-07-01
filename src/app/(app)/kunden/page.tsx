import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { CustomerForm } from "./customer-form";
import { createCustomer, deleteCustomer } from "./actions";
import type { Database } from "@/lib/supabase/database.types";

type Customer = Database["public"]["Tables"]["customers"]["Row"];

export function customerName(c: Pick<Customer, "company_name" | "first_name" | "last_name">): string {
  if (c.company_name) return c.company_name;
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
}

export default async function KundenPage({
  searchParams,
}: {
  searchParams: Promise<{ neu?: string; fehler?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: customers, error }, { data: companies }] = await Promise.all([
    supabase.from("customers").select("*").order("customer_number", { ascending: true }),
    supabase.from("companies").select("id, name").order("name"),
  ]);

  if (error) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        Fehler beim Laden: {error.message}
      </p>
    );
  }

  const rows = customers ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-semibold text-neutral-900">Kunden</h2>
        <div className="rounded-2xl bg-neutral-900 px-5 py-3 text-right text-white">
          <div className="text-xs text-neutral-300">Kunden gesamt</div>
          <div className="text-xl font-semibold">{rows.length}</div>
        </div>
      </div>

      {sp.fehler && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{sp.fehler}</p>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          Noch keine Kunden angelegt.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nr.</th>
                <th className="px-4 py-3 font-medium">Kunde</th>
                <th className="px-4 py-3 font-medium">Ort</th>
                <th className="px-4 py-3 font-medium">E-Mail</th>
                <th className="px-4 py-3 text-right font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 tabular-nums text-neutral-500">{c.customer_number}</td>
                  <td className="px-4 py-3 font-medium">{customerName(c)}</td>
                  <td className="px-4 py-3 text-neutral-600">{[c.zip_code, c.city].filter(Boolean).join(" ")}</td>
                  <td className="px-4 py-3 text-neutral-600">{c.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-4">
                      <Link href={`/kunden/${c.id}`} className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
                        Bearbeiten
                      </Link>
                      <DeleteButton action={deleteCustomer} id={String(c.id)} name={customerName(c)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="rounded-2xl border border-neutral-200 bg-white p-6" open={rows.length === 0}>
        <summary className="cursor-pointer text-base font-semibold text-neutral-900">
          Neuen Kunden hinzufügen
        </summary>
        <div className="mt-6">
          <CustomerForm
            action={createCustomer}
            companies={companies ?? []}
            submitLabel="Hinzufügen"
            resetOnSuccess
          />
        </div>
      </details>
    </div>
  );
}
