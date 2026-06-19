import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCents, FREQUENCY_LABELS } from "@/lib/format";
import { FixedExpenseForm } from "./fixed-expense-form";
import { DeleteButton } from "./delete-button";
import {
  createFixedExpense,
  deleteFixedExpense,
  toggleFixedExpenseActive,
} from "./actions";

export default async function FixeAusgabenPage() {
  const supabase = await createClient();
  const { data: expenses, error } = await supabase
    .from("fixed_expenses")
    .select("*")
    .order("active", { ascending: false })
    .order("due_day_of_month", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        Fehler beim Laden: {error.message}
      </p>
    );
  }

  const rows = expenses ?? [];
  const activeRows = rows.filter((r) => r.active);
  const activeTotal = activeRows.reduce((sum, r) => sum + r.amount_cents, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">
            Fixe Ausgaben
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {activeRows.length} aktive {activeRows.length === 1 ? "Position" : "Positionen"}
          </p>
        </div>
        <div className="rounded-2xl bg-neutral-900 px-5 py-3 text-right text-white">
          <div className="text-xs text-neutral-300">Summe fixe Ausgaben (aktiv)</div>
          <div className="text-xl font-semibold">{formatCents(activeTotal)}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          Noch keine fixen Ausgaben erfasst. Unten kannst du die erste anlegen.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Kategorie</th>
                <th className="px-4 py-3 font-medium">Turnus</th>
                <th className="px-4 py-3 font-medium">Tag</th>
                <th className="px-4 py-3 text-right font-medium">Betrag</th>
                <th className="px-4 py-3 text-right font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => (
                <tr key={r.id} className={r.active ? "" : "bg-neutral-50 text-neutral-400"}>
                  <td className="px-4 py-3 font-medium">
                    {r.name}
                    {r.end_date && (
                      <span className="ml-2 text-xs text-neutral-400">
                        bis {r.end_date}
                      </span>
                    )}
                    {!r.active && (
                      <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-600">
                        inaktiv
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{r.category}</td>
                  <td className="px-4 py-3">{FREQUENCY_LABELS[r.frequency]}</td>
                  <td className="px-4 py-3">{r.due_day_of_month}.</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCents(r.amount_cents)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-4">
                      <Link
                        href={`/fixe-ausgaben/${r.id}`}
                        className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
                      >
                        Bearbeiten
                      </Link>
                      <form action={toggleFixedExpenseActive}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="active" value={String(r.active)} />
                        <button
                          type="submit"
                          className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
                        >
                          {r.active ? "Deaktivieren" : "Aktivieren"}
                        </button>
                      </form>
                      <DeleteButton action={deleteFixedExpense} id={r.id} name={r.name} />
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
          Neue fixe Ausgabe hinzufügen
        </summary>
        <div className="mt-6">
          <FixedExpenseForm
            action={createFixedExpense}
            submitLabel="Hinzufügen"
            resetOnSuccess
          />
        </div>
      </details>
    </div>
  );
}
