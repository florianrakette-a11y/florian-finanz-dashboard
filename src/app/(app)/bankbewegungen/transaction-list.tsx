"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/format";
import {
  addToVariableExpenses,
  addToFixedExpenses,
  addToIncome,
  type BulkResult,
} from "./bulk-actions";

type Row = {
  id: string;
  date: string;
  counterpart: string | null;
  purpose: string | null;
  amount_cents: number;
  bb_account: string | null;
  match_status: string;
};

export function TransactionList({
  rows,
  footerLabel,
}: {
  rows: Row[];
  footerLabel: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const total = rows.reduce((s, r) => s + r.amount_cents, 0);
  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function run(action: (ids: string[]) => Promise<BulkResult>) {
    const ids = [...selected];
    startTransition(async () => {
      const res = await action(ids);
      setMessage(res.message);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {/* Aktionsleiste */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-900 bg-neutral-900 px-4 py-3 text-white">
          <span className="text-sm font-medium">{selected.size} ausgewählt</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => run(addToVariableExpenses)}
              disabled={isPending}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-50"
            >
              Zu variablen Ausgaben
            </button>
            <button
              onClick={() => run(addToFixedExpenses)}
              disabled={isPending}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-50"
            >
              Zu fixen Ausgaben
            </button>
            <button
              onClick={() => run(addToIncome)}
              disabled={isPending}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-50"
            >
              Zu Einnahmen
            </button>
          </div>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-sm text-neutral-300 hover:text-white"
          >
            Auswahl aufheben
          </button>
        </div>
      )}

      {message && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-neutral-300"
                  aria-label="Alle auswählen"
                />
              </th>
              <th className="px-4 py-3 font-medium">Datum</th>
              <th className="px-4 py-3 font-medium">Konto</th>
              <th className="px-4 py-3 font-medium">Gegenseite</th>
              <th className="px-4 py-3 font-medium">Verwendungszweck</th>
              <th className="px-4 py-3 text-right font-medium">Betrag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((t) => (
              <tr key={t.id} className={selected.has(t.id) ? "bg-neutral-50" : ""}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggle(t.id)}
                    className="h-4 w-4 rounded border-neutral-300"
                    aria-label="Zeile auswählen"
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap tabular-nums">{t.date}</td>
                <td className="px-4 py-3">
                  {t.bb_account && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        t.bb_account === "PayPal"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {t.bb_account}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {t.counterpart}
                  {t.match_status === "matched" && (
                    <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                      erfasst
                    </span>
                  )}
                </td>
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
              <td className="px-4 py-3 font-medium" colSpan={5}>
                {footerLabel} ({rows.length} Bewegungen)
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
    </div>
  );
}
