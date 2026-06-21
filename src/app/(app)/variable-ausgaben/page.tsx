import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/format";
import {
  currentMonth,
  isValidMonth,
  monthBounds,
  monthLabel,
} from "@/lib/month";
import { VariableExpenseForm } from "./variable-expense-form";
import { DeleteButton } from "@/components/delete-button";
import { deleteVariableExpense, updateVariableExpenseCategory } from "./actions";
import { CategoryCell } from "@/components/category-cell";
import { MonthNav } from "@/components/month-nav";
import { getKnownCategories, CATEGORY_LABELS } from "@/lib/categories";

export default async function VariableAusgabenPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const { from, to } = monthBounds(month);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variable_expenses")
    .select("*")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false });

  const rows = data ?? [];
  const total = rows.reduce((s, r) => s + r.amount_cents, 0);

  // Gemeinsame, synchronisierte Kategorienliste (fix + variabel).
  const knownCategories = await getKnownCategories(supabase);
  // Default-Datum fürs Formular: heute, aber im gewählten Monat sinnvoll bleiben.
  const today = new Date().toISOString().slice(0, 10);
  const defaultDate = today.startsWith(month) ? today : `${month}-01`;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-semibold text-neutral-900">Variable Ausgaben</h2>
        <div className="rounded-2xl bg-neutral-900 px-5 py-3 text-right text-white">
          <div className="text-xs text-neutral-300">Summe {monthLabel(month)}</div>
          <div className="text-xl font-semibold">{formatCents(total)}</div>
        </div>
      </div>

      <MonthNav basePath="/variable-ausgaben" month={month} />

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Fehler beim Laden: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          Keine variablen Ausgaben in {monthLabel(month)}. Unten kannst du welche erfassen.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Datum</th>
                <th className="px-4 py-3 font-medium">Kategorie</th>
                <th className="px-4 py-3 font-medium">Beschreibung</th>
                <th className="px-4 py-3 text-right font-medium">Betrag</th>
                <th className="px-4 py-3 text-right font-medium">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">{r.date}</td>
                  <td className="px-4 py-3">
                    <CategoryCell
                      value={r.category}
                      options={knownCategories}
                      labels={CATEGORY_LABELS}
                      action={updateVariableExpenseCategory.bind(null, r.id)}
                    />
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{r.description}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCents(r.amount_cents)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <DeleteButton action={deleteVariableExpense} id={r.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-neutral-200 bg-neutral-50">
              <tr>
                <td className="px-4 py-3 font-medium" colSpan={3}>
                  Summe {monthLabel(month)} ({rows.length})
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {formatCents(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <details
        className="rounded-2xl border border-neutral-200 bg-white p-6"
        open={rows.length === 0}
      >
        <summary className="cursor-pointer text-base font-semibold text-neutral-900">
          Neue variable Ausgabe erfassen
        </summary>
        <div className="mt-6">
          <VariableExpenseForm defaultDate={defaultDate} knownCategories={knownCategories} />
        </div>
      </details>
    </div>
  );
}
