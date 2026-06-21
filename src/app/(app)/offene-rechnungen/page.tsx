import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/format";
import {
  currentMonth,
  isValidMonth,
  monthBounds,
  monthLabel,
} from "@/lib/month";
import { detectFailedDebits } from "@/lib/failed-debits";
import { InvoiceForm } from "./invoice-form";
import { DeleteButton } from "@/components/delete-button";
import {
  createInvoiceFromFailedDebit,
  deleteInvoice,
  setInvoiceStatus,
  updateInvoiceDescription,
} from "./actions";
import { TextCell } from "@/components/text-cell";
import { MonthNav } from "@/components/month-nav";

const STATUS_LABEL: Record<string, string> = {
  open: "Offen",
  paid: "Bezahlt",
  reminded: "Angemahnt",
};

type Invoice = {
  id: string;
  recipient: string;
  amount_cents: number;
  due_date: string | null;
  purpose: string | null;
  description: string | null;
  status: string;
};

function InvoiceRow({ inv }: { inv: Invoice }) {
  return (
    <tr className={inv.status === "paid" ? "text-neutral-400" : ""}>
      <td className="px-4 py-3 font-medium">
        <div>{inv.recipient}</div>
        <div className="mt-0.5">
          <TextCell
            value={inv.description}
            action={updateInvoiceDescription.bind(null, inv.id)}
            placeholder="Beschreibung hinzufügen…"
          />
        </div>
        {inv.purpose && (
          <div className="text-[11px] font-normal text-neutral-300 line-clamp-1">
            {inv.purpose}
          </div>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap tabular-nums">
        {inv.due_date ?? "—"}
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            inv.status === "paid"
              ? "bg-green-100 text-green-700"
              : inv.status === "reminded"
                ? "bg-amber-100 text-amber-700"
                : "bg-neutral-200 text-neutral-700"
          }`}
        >
          {STATUS_LABEL[inv.status] ?? inv.status}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-medium tabular-nums">
        {formatCents(inv.amount_cents)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-3">
          {inv.status !== "paid" ? (
            <form action={setInvoiceStatus}>
              <input type="hidden" name="id" value={inv.id} />
              <input type="hidden" name="status" value="paid" />
              <button className="text-sm font-medium text-green-700 hover:text-green-800">
                Bezahlt
              </button>
            </form>
          ) : (
            <form action={setInvoiceStatus}>
              <input type="hidden" name="id" value={inv.id} />
              <input type="hidden" name="status" value="open" />
              <button className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
                Wieder offen
              </button>
            </form>
          )}
          <DeleteButton action={deleteInvoice} id={inv.id} name={inv.recipient} />
        </div>
      </td>
    </tr>
  );
}

function InvoiceTable({ rows }: { rows: Invoice[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-3 font-medium">Empfänger</th>
            <th className="px-4 py-3 font-medium">Fällig</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Betrag</th>
            <th className="px-4 py-3 text-right font-medium">Aktionen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((inv) => (
            <InvoiceRow key={inv.id} inv={inv} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function OffeneRechnungenPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const { from, to } = monthBounds(month);
  const supabase = await createClient();

  // Rechnungen des Monats (nach Fälligkeitsdatum) + undatierte (immer sichtbar).
  const [monthRes, undatedRes, allRes, txRes] = await Promise.all([
    supabase
      .from("open_invoices")
      .select("*")
      .gte("due_date", from)
      .lte("due_date", to)
      .order("due_date", { ascending: true }),
    supabase
      .from("open_invoices")
      .select("*")
      .is("due_date", null)
      .order("created_at", { ascending: true }),
    supabase.from("open_invoices").select("recipient, amount_cents"),
    supabase
      .from("bank_transactions")
      .select("*")
      .gte("date", from)
      .lte("date", to),
  ]);

  const monthInvoices = monthRes.data ?? [];
  const undatedInvoices = undatedRes.data ?? [];

  // Offene Summe (alles, was nicht bezahlt ist).
  const openTotal = [...monthInvoices, ...undatedInvoices]
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + i.amount_cents, 0);

  // Fehlgeschlagene Abbuchungen erkennen, bereits übernommene ausblenden.
  const existingKeys = new Set(
    (allRes.data ?? []).map((i) => `${i.recipient}|${i.amount_cents}`),
  );
  const suggestions = detectFailedDebits(txRes.data ?? []).filter(
    (s) => !existingKeys.has(`${s.counterpart}|${s.amount_cents}`),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-semibold text-neutral-900">Offene Rechnungen</h2>
        <div className="rounded-2xl bg-neutral-900 px-5 py-3 text-right text-white">
          <div className="text-xs text-neutral-300">Offen gesamt</div>
          <div className="text-xl font-semibold">{formatCents(openTotal)}</div>
        </div>
      </div>

      {/* Monats-Navigation */}
      <MonthNav basePath="/offene-rechnungen" month={month} />

      {/* Fehlgeschlagene Abbuchungen als Vorschläge */}
      {suggestions.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div>
            <h3 className="text-base font-semibold text-amber-900">
              Fehlgeschlagene Abbuchungen in {monthLabel(month)}
            </h3>
            <p className="text-sm text-amber-700">
              Abgebucht und wieder zurückgebucht – vermutlich offene Rechnungen.
              Prüfe und übernimm, was zutrifft.
            </p>
          </div>
          <div className="divide-y divide-amber-200">
            {suggestions.map((s) => (
              <div
                key={`${s.counterpart}-${s.amount_cents}`}
                className="flex items-center justify-between gap-4 py-2"
              >
                <div className="text-sm">
                  <span className="font-medium text-neutral-900">{s.counterpart}</span>
                  <span className="ml-2 tabular-nums">{formatCents(s.amount_cents)}</span>
                  {s.attempts > 1 && (
                    <span className="ml-2 text-xs text-amber-700">
                      {s.attempts} Versuche
                    </span>
                  )}
                </div>
                <form action={createInvoiceFromFailedDebit}>
                  <input type="hidden" name="recipient" value={s.counterpart} />
                  <input type="hidden" name="amount_cents" value={s.amount_cents} />
                  <input type="hidden" name="due_date" value={s.last_debit_date} />
                  <input type="hidden" name="purpose" value={s.purpose ?? ""} />
                  <button className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700">
                    Als offene Rechnung übernehmen
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rechnungen des Monats */}
      {monthInvoices.length > 0 ? (
        <InvoiceTable rows={monthInvoices} />
      ) : (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          Keine Rechnungen mit Fälligkeit in {monthLabel(month)}.
        </div>
      )}

      {/* Undatierte Rechnungen (immer sichtbar) */}
      {undatedInvoices.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-neutral-500">Ohne Fälligkeitsdatum</h3>
          <InvoiceTable rows={undatedInvoices} />
        </div>
      )}

      <details className="rounded-2xl border border-neutral-200 bg-white p-6">
        <summary className="cursor-pointer text-base font-semibold text-neutral-900">
          Neue offene Rechnung hinzufügen
        </summary>
        <div className="mt-6">
          <InvoiceForm />
        </div>
      </details>
    </div>
  );
}
