import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCents, FREQUENCY_LABELS } from "@/lib/format";
import {
  currentMonth,
  isValidMonth,
  monthLabel,
} from "@/lib/month";
import { isFixedDueInMonth } from "@/lib/fixed-expenses";
import { FixedExpenseForm } from "./fixed-expense-form";
import { DeleteButton } from "@/components/delete-button";
import {
  createFixedExpense,
  deleteFixedExpense,
  endFixedExpense,
  reactivateFixedExpense,
  updateFixedExpenseCategory,
} from "./actions";
import { CategoryCell } from "@/components/category-cell";
import { MonthNav } from "@/components/month-nav";
import { getKnownCategories, CATEGORY_LABELS } from "@/lib/categories";
import type { Database } from "@/lib/supabase/database.types";

type Row = Database["public"]["Tables"]["fixed_expenses"]["Row"];

function FixedRow({
  r,
  knownCategories,
  month,
}: {
  r: Row;
  knownCategories: string[];
  month: string;
}) {
  const nonMonthly = r.frequency !== "monthly";
  return (
    <tr className={r.active ? "" : "bg-neutral-50 text-neutral-400"}>
      <td className="px-4 py-3 font-medium">
        {nonMonthly && <span title="Nicht monatlich">⚠️ </span>}
        {r.name}
        {r.end_date && (
          <span className="ml-2 text-xs text-neutral-400">bis {r.end_date}</span>
        )}
        {!r.active && (
          <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-600">
            inaktiv
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <CategoryCell
          value={r.category}
          options={knownCategories}
          labels={CATEGORY_LABELS}
          action={updateFixedExpenseCategory.bind(null, r.id)}
        />
      </td>
      <td className="px-4 py-3">
        {nonMonthly ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
            {FREQUENCY_LABELS[r.frequency]}
          </span>
        ) : (
          <span className="text-neutral-500">{FREQUENCY_LABELS[r.frequency]}</span>
        )}
      </td>
      <td className="px-4 py-3">{r.due_day_of_month}.</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatCents(r.amount_cents)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-4">
          <Link
            href={`/fixe-ausgaben/${r.id}`}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
          >
            Bearbeiten
          </Link>
          {r.end_date ? (
            <form action={reactivateFixedExpense}>
              <input type="hidden" name="id" value={r.id} />
              <button className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
                Wieder aktivieren
              </button>
            </form>
          ) : (
            <form action={endFixedExpense}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="month" value={month} />
              <button className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
                Ab {monthLabel(month)} beenden
              </button>
            </form>
          )}
          <DeleteButton action={deleteFixedExpense} id={r.id} name={r.name} />
        </div>
      </td>
    </tr>
  );
}

function FixedTable({
  rows,
  knownCategories,
  month,
}: {
  rows: Row[];
  knownCategories: string[];
  month: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
      <table className="w-full min-w-[640px] text-sm">
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
            <FixedRow key={r.id} r={r} knownCategories={knownCategories} month={month} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function FixeAusgabenPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    neu?: string;
    name?: string;
    amount?: string;
    tag?: string;
    start?: string;
  }>;
}) {
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fixed_expenses")
    .select("*")
    .order("due_day_of_month", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        Fehler beim Laden: {error.message}
      </p>
    );
  }

  const all = data ?? [];
  const dueThisMonth = all.filter((r) => isFixedDueInMonth(r, month));
  const monthTotal = dueThisMonth.reduce((s, r) => s + r.amount_cents, 0);

  // Gemeinsame, synchronisierte Kategorienliste (fix + variabel).
  const knownCategories = await getKnownCategories(supabase);

  const prefill = sp.neu
    ? {
        name: sp.name,
        amount: sp.amount,
        due_day: sp.tag ? Number(sp.tag) : undefined,
        start_date: sp.start,
      }
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-semibold text-neutral-900">Fixe Ausgaben</h2>
        <div className="rounded-2xl bg-neutral-900 px-5 py-3 text-right text-white">
          <div className="text-xs text-neutral-300">Fällig in {monthLabel(month)}</div>
          <div className="text-xl font-semibold">{formatCents(monthTotal)}</div>
        </div>
      </div>

      <MonthNav basePath="/fixe-ausgaben" month={month} />

      {dueThisMonth.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          Keine fixen Ausgaben fällig in {monthLabel(month)}.
        </div>
      ) : (
        <FixedTable rows={dueThisMonth} knownCategories={knownCategories} month={month} />
      )}

      <details className="rounded-2xl border border-neutral-200 bg-white p-6">
        <summary className="cursor-pointer text-base font-semibold text-neutral-900">
          Alle fixen Ausgaben verwalten ({all.length})
        </summary>
        <div className="mt-6">
          <FixedTable rows={all} knownCategories={knownCategories} month={month} />
        </div>
      </details>

      <details
        className="rounded-2xl border border-neutral-200 bg-white p-6"
        open={Boolean(prefill) || all.length === 0}
      >
        <summary className="cursor-pointer text-base font-semibold text-neutral-900">
          Neue fixe Ausgabe hinzufügen
        </summary>
        <div className="mt-6">
          <FixedExpenseForm
            action={createFixedExpense}
            prefill={prefill}
            knownCategories={knownCategories}
            submitLabel="Hinzufügen"
            resetOnSuccess
          />
        </div>
      </details>
    </div>
  );
}
