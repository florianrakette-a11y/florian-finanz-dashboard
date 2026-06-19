import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/format";
import { SyncButton } from "./sync-button";

export default async function BankbewegungenPage() {
  const supabase = await createClient();
  const { data: txns, error } = await supabase
    .from("bank_transactions")
    .select("*")
    .order("date", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        Fehler beim Laden: {error.message}
      </p>
    );
  }

  const rows = txns ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Bankbewegungen</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Aus Buchhaltungsbutler (Kontist & PayPal). Abruf nur lesend.
        </p>
      </div>

      <SyncButton />

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          Noch keine Bankbewegungen. Klick oben auf den Button, um sie aus
          Buchhaltungsbutler zu holen.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Datum</th>
                <th className="px-4 py-3 font-medium">Gegenseite</th>
                <th className="px-4 py-3 font-medium">Verwendungszweck</th>
                <th className="px-4 py-3 text-right font-medium">Betrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">{t.date}</td>
                  <td className="px-4 py-3">{t.counterpart}</td>
                  <td className="px-4 py-3 text-neutral-500">
                    <span className="line-clamp-1">{t.purpose}</span>
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums ${
                      t.amount_cents < 0 ? "text-red-600" : "text-green-700"
                    }`}
                  >
                    {formatCents(t.amount_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length === 200 && (
        <p className="text-xs text-neutral-400">
          Es werden die neuesten 200 Bewegungen angezeigt.
        </p>
      )}
    </div>
  );
}
