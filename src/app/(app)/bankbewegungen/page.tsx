import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/format";
import {
  currentMonth,
  isValidMonth,
  monthBounds,
  monthLabel,
  shiftMonth,
} from "@/lib/month";
import { SyncButton } from "./sync-button";

export default async function BankbewegungenPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = isValidMonth(monthParam) ? monthParam : currentMonth();
  const { from, to } = monthBounds(month);

  const supabase = await createClient();
  const { data: txns, error } = await supabase
    .from("bank_transactions")
    .select("*")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false });

  const rows = txns ?? [];
  const total = rows.reduce((sum, t) => sum + t.amount_cents, 0);
  const isCurrent = month === currentMonth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Bankbewegungen</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Aus Buchhaltungsbutler (Kontist & PayPal). Abruf nur lesend.
        </p>
      </div>

      {/* Monats-Navigation */}
      <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3">
        <Link
          href={`/bankbewegungen?month=${shiftMonth(month, -1)}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          aria-label="Vorheriger Monat"
        >
          ← {monthLabel(shiftMonth(month, -1))}
        </Link>

        <div className="text-center">
          <div className="text-base font-semibold text-neutral-900">
            {monthLabel(month)}
          </div>
          {!isCurrent && (
            <Link
              href="/bankbewegungen"
              className="text-xs text-neutral-500 hover:text-neutral-900"
            >
              → zum aktuellen Monat
            </Link>
          )}
        </div>

        <Link
          href={`/bankbewegungen?month=${shiftMonth(month, 1)}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          aria-label="Nächster Monat"
        >
          {monthLabel(shiftMonth(month, 1))} →
        </Link>
      </div>

      <SyncButton month={month} />

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Fehler beim Laden: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          Keine Bankbewegungen für {monthLabel(month)}. Klick oben auf den Button,
          um diesen Monat aus Buchhaltungsbutler zu holen.
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
            <tfoot className="border-t border-neutral-200 bg-neutral-50">
              <tr>
                <td className="px-4 py-3 font-medium" colSpan={3}>
                  Saldo {monthLabel(month)} ({rows.length} Bewegungen)
                </td>
                <td
                  className={`px-4 py-3 text-right font-semibold tabular-nums ${
                    total < 0 ? "text-red-600" : "text-green-700"
                  }`}
                >
                  {formatCents(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
