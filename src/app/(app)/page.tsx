import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCents, FREQUENCY_LABELS } from "@/lib/format";
import {
  currentMonth,
  isValidMonth,
  monthBounds,
  monthLabel,
} from "@/lib/month";
import { isFixedDueInMonth } from "@/lib/fixed-expenses";
import { MonthNav } from "@/components/month-nav";

function KpiCard({
  href,
  label,
  value,
  sub,
  tone = "neutral",
}: {
  href: string;
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "green" | "red";
}) {
  const valueColor =
    tone === "green" ? "text-green-700" : tone === "red" ? "text-red-600" : "text-neutral-900";
  return (
    <Link
      href={href}
      className="rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:shadow-sm"
    >
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-neutral-400">{sub}</div>}
    </Link>
  );
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const { from, to } = monthBounds(month);
  const supabase = await createClient();

  const [fixedRes, variableRes, incomeRes, invoicesRes, bankRes] = await Promise.all([
    supabase.from("fixed_expenses").select("*"),
    supabase.from("variable_expenses").select("amount_cents, category").gte("date", from).lte("date", to),
    supabase.from("income_entries").select("amount_cents, status").eq("month", from),
    supabase.from("open_invoices").select("amount_cents, status, due_date"),
    supabase.from("bank_transactions").select("amount_cents").gte("date", from).lte("date", to),
  ]);

  const fixedAll = fixedRes.data ?? [];
  const fixedDue = fixedAll.filter((r) => isFixedDueInMonth(r, month));
  const fixedTotal = fixedDue.reduce((s, r) => s + r.amount_cents, 0);

  const variableTotal = (variableRes.data ?? []).reduce((s, r) => s + r.amount_cents, 0);

  const income = incomeRes.data ?? [];
  const incomeReceived = income.filter((r) => r.status === "received").reduce((s, r) => s + r.amount_cents, 0);
  const incomeExpected = income.filter((r) => r.status === "expected").reduce((s, r) => s + r.amount_cents, 0);
  const incomePlanned = incomeReceived + incomeExpected;

  const invoices = invoicesRes.data ?? [];
  const openInvoicesTotal = invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + i.amount_cents, 0);

  const bankSaldo = (bankRes.data ?? []).reduce((s, r) => s + r.amount_cents, 0);

  const plannedExpenses = fixedTotal + variableTotal;
  const plannedResult = incomePlanned - plannedExpenses;

  // Ausgaben nach Kategorie (fixe fällige + variable) für den Monat.
  const CATEGORY_LABELS: Record<string, string> = { tanken: "Tanken", privat: "Privat" };
  const catMap = new Map<string, number>();
  for (const r of fixedDue) catMap.set(r.category, (catMap.get(r.category) ?? 0) + r.amount_cents);
  for (const r of variableRes.data ?? [])
    catMap.set(r.category, (catMap.get(r.category) ?? 0) + r.amount_cents);
  const categoryBreakdown = [...catMap.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
  const maxCat = categoryBreakdown[0]?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Übersicht</h2>
          <p className="mt-1 text-sm text-neutral-500">Soll/Ist für {monthLabel(month)}</p>
        </div>
      </div>

      {/* Monats-Navigation */}
      <MonthNav basePath="/" month={month} />

      {/* Soll / Ist */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Geplantes Ergebnis (Soll)
          </div>
          <div
            className={`mt-1 text-3xl font-semibold tabular-nums ${
              plannedResult < 0 ? "text-red-600" : "text-green-700"
            }`}
          >
            {formatCents(plannedResult)}
          </div>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-500">Einnahmen (geplant)</dt>
              <dd className="tabular-nums text-green-700">{formatCents(incomePlanned)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Fixe Ausgaben</dt>
              <dd className="tabular-nums text-red-600">−{formatCents(fixedTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Variable Ausgaben</dt>
              <dd className="tabular-nums text-red-600">−{formatCents(variableTotal)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Bank-Saldo (Ist)
          </div>
          <div
            className={`mt-1 text-3xl font-semibold tabular-nums ${
              bankSaldo < 0 ? "text-red-600" : "text-green-700"
            }`}
          >
            {formatCents(bankSaldo)}
          </div>
          <p className="mt-4 text-sm text-neutral-400">
            Tatsächliche Bewegungen auf Kontist, PayPal + Finom in {monthLabel(month)}.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          href={`/einnahmen?month=${month}`}
          label="Einnahmen erhalten"
          value={formatCents(incomeReceived)}
          sub={incomeExpected > 0 ? `+ ${formatCents(incomeExpected)} erwartet` : undefined}
          tone="green"
        />
        <KpiCard
          href={`/fixe-ausgaben?month=${month}`}
          label="Fixe Ausgaben"
          value={formatCents(fixedTotal)}
          sub={`${fixedDue.length} fällig`}
        />
        <KpiCard
          href={`/variable-ausgaben?month=${month}`}
          label="Variable Ausgaben"
          value={formatCents(variableTotal)}
        />
        <KpiCard
          href={`/offene-rechnungen?month=${month}`}
          label="Offene Rechnungen"
          value={formatCents(openInvoicesTotal)}
          tone="red"
        />
      </div>

      {/* Ausgaben nach Kategorie */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h3 className="text-base font-semibold text-neutral-900">
          Ausgaben nach Kategorie in {monthLabel(month)}
        </h3>
        <p className="mt-1 text-xs text-neutral-400">
          Fixe (in diesem Monat fällige) und variable Ausgaben zusammengefasst.
        </p>
        {categoryBreakdown.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">Keine Ausgaben in diesem Monat.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {categoryBreakdown.map((c) => (
              <li key={c.category}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-neutral-800">
                    {CATEGORY_LABELS[c.category] ?? c.category}
                  </span>
                  <span className="tabular-nums">{formatCents(c.total)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded bg-neutral-100">
                  <div
                    className="h-full rounded bg-neutral-800"
                    style={{ width: `${maxCat > 0 ? (c.total / maxCat) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Anstehende Fälligkeiten */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h3 className="text-base font-semibold text-neutral-900">
          Anstehende Fälligkeiten in {monthLabel(month)}
        </h3>
        {fixedDue.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">Keine fixen Ausgaben fällig.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100">
            {[...fixedDue]
              .sort((a, b) => a.due_day_of_month - b.due_day_of_month)
              .map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <span className="text-neutral-400 tabular-nums">{r.due_day_of_month}. </span>
                    {r.frequency !== "monthly" && <span title="Nicht monatlich">⚠️ </span>}
                    <span className="font-medium text-neutral-900">{r.name}</span>
                    {r.frequency !== "monthly" && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                        {FREQUENCY_LABELS[r.frequency]}
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums">{formatCents(r.amount_cents)}</span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
