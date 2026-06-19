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
import {
  IncomeForm,
  INCOME_SOURCE_LABELS,
  INCOME_STATUS_LABELS,
} from "./income-form";
import { DeleteButton } from "./delete-button";
import { deleteIncome, setIncomeStatus } from "./actions";

export default async function EinnahmenPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const { from } = monthBounds(month);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("income_entries")
    .select("*")
    .eq("month", from)
    .order("amount_cents", { ascending: false });

  const rows = data ?? [];
  const received = rows.filter((r) => r.status === "received").reduce((s, r) => s + r.amount_cents, 0);
  const expected = rows.filter((r) => r.status === "expected").reduce((s, r) => s + r.amount_cents, 0);

  // Bekannte Quellen fürs Dropdown: Standardwerte + bereits verwendete (inkl. eigener).
  const { data: allSources } = await supabase.from("income_entries").select("source");
  const sourceValues = Array.from(
    new Set([
      ...Object.keys(INCOME_SOURCE_LABELS),
      ...(allSources ?? []).map((r) => r.source),
    ]),
  );
  const knownSources = sourceValues.map((value) => ({
    value,
    label: INCOME_SOURCE_LABELS[value] ?? value,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-semibold text-neutral-900">Einnahmen</h2>
        <div className="flex gap-3">
          <div className="rounded-2xl bg-green-700 px-4 py-3 text-right text-white">
            <div className="text-xs text-green-100">Erhalten</div>
            <div className="text-lg font-semibold">{formatCents(received)}</div>
          </div>
          <div className="rounded-2xl bg-neutral-900 px-4 py-3 text-right text-white">
            <div className="text-xs text-neutral-300">Erwartet</div>
            <div className="text-lg font-semibold">{formatCents(expected)}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3">
        <Link
          href={`/einnahmen?month=${shiftMonth(month, -1)}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
        >
          ← {monthLabel(shiftMonth(month, -1))}
        </Link>
        <div className="text-base font-semibold text-neutral-900">{monthLabel(month)}</div>
        <Link
          href={`/einnahmen?month=${shiftMonth(month, 1)}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
        >
          {monthLabel(shiftMonth(month, 1))} →
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Fehler beim Laden: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          Keine Einnahmen in {monthLabel(month)}. Unten kannst du welche erfassen.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Quelle</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Betrag</th>
                <th className="px-4 py-3 text-right font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium">
                    {INCOME_SOURCE_LABELS[r.source] ?? r.source}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        r.status === "received"
                          ? "bg-green-100 text-green-700"
                          : "bg-neutral-200 text-neutral-700"
                      }`}
                    >
                      {INCOME_STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCents(r.amount_cents)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <form action={setIncomeStatus}>
                        <input type="hidden" name="id" value={r.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={r.status === "received" ? "expected" : "received"}
                        />
                        <button className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
                          {r.status === "received" ? "Als erwartet" : "Als erhalten"}
                        </button>
                      </form>
                      <DeleteButton action={deleteIncome} id={r.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details
        className="rounded-2xl border border-neutral-200 bg-white p-6"
        open={rows.length === 0}
      >
        <summary className="cursor-pointer text-base font-semibold text-neutral-900">
          Neue Einnahme erfassen
        </summary>
        <div className="mt-6">
          <IncomeForm month={month} knownSources={knownSources} />
        </div>
      </details>
    </div>
  );
}
