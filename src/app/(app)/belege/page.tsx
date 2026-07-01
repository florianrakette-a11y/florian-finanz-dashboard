import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/format";
import {
  customerDisplayName,
  formatInvoiceDate,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_CLASSES,
} from "@/lib/invoice";
import { DeleteButton } from "@/components/delete-button";
import { deleteInvoice, duplicateInvoice } from "../rechnungen/actions";

type Tab = "alle" | "ausgang" | "eingang";

const IN_STATUS: Record<string, string> = { open: "Offen", paid: "Bezahlt", reminded: "Angemahnt" };

const menuItem = "block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50";

function RowActions({ b }: { b: Beleg }) {
  return (
    <details className="relative inline-block text-left">
      <summary className="cursor-pointer list-none rounded px-2 py-1 text-neutral-500 hover:bg-neutral-100">⋯</summary>
      <div className="fixed inset-x-0 bottom-0 z-20 w-full overflow-hidden rounded-t-2xl border-t border-neutral-200 bg-white shadow-lg sm:absolute sm:inset-auto sm:right-0 sm:bottom-auto sm:mt-1 sm:w-48 sm:rounded-lg sm:border">
        {b.kind === "out" ? (
          <>
            <a href={`/rechnungen/${b.rid}`} className={menuItem}>Ansehen</a>
            <a href={`/rechnungen/${b.rid}/pdf`} target="_blank" rel="noopener" className={menuItem}>PDF ansehen</a>
            <a href={`/rechnungen/${b.rid}/pdf?download=1`} className={menuItem}>PDF herunterladen</a>
            <a href={`/rechnungen/${b.rid}/bearbeiten`} className={menuItem}>Bearbeiten</a>
            <form action={duplicateInvoice}>
              <input type="hidden" name="id" value={b.rid} />
              <button className={menuItem}>Duplizieren</button>
            </form>
            <div className="border-t border-neutral-100">
              <DeleteButton action={deleteInvoice} id={String(b.rid)} name={b.title} />
            </div>
          </>
        ) : (
          <a href={`/belege/eingang/${b.rid}`} className={menuItem}>Öffnen / Datei</a>
        )}
      </div>
    </details>
  );
}

type Beleg = {
  key: string;
  rid: string | number;
  kind: "out" | "in";
  title: string;
  meta: string;
  date: string; // ISO/Datum für Sortierung
  dateLabel: string;
  statusLabel: string;
  statusClass: string;
  amount: number;
  direction: string; // "zu erhalten" / "zu bezahlen"
  href: string;
};

export default async function BelegePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab: Tab = sp.tab === "ausgang" || sp.tab === "eingang" ? sp.tab : "alle";

  const supabase = await createClient();
  const [{ data: invoices }, { data: openInvoices }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, status, total, customers(company_name, first_name, last_name)")
      .order("invoice_date", { ascending: false }),
    supabase
      .from("open_invoices")
      .select("id, recipient, due_date, status, amount_cents, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const out: Beleg[] = (invoices ?? []).map((r) => ({
    key: "out-" + r.id,
    rid: r.id,
    kind: "out",
    title: customerDisplayName(r.customers),
    meta: `Rechnung · ${r.invoice_number}`,
    date: r.invoice_date,
    dateLabel: formatInvoiceDate(r.invoice_date),
    statusLabel: INVOICE_STATUS_LABELS[r.status] ?? r.status,
    statusClass: INVOICE_STATUS_CLASSES[r.status] ?? "",
    amount: r.total,
    direction: "zu erhalten",
    href: `/rechnungen/${r.id}`,
  }));

  const incoming: Beleg[] = (openInvoices ?? []).map((r) => ({
    key: "in-" + r.id,
    rid: r.id,
    kind: "in",
    title: r.recipient,
    meta: "Eingangsbeleg",
    date: r.due_date ?? r.created_at,
    dateLabel: r.due_date ? formatInvoiceDate(r.due_date) : "—",
    statusLabel: IN_STATUS[r.status] ?? r.status,
    statusClass: r.status === "paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700",
    amount: r.amount_cents,
    direction: "zu bezahlen",
    href: "/offene-rechnungen",
  }));

  const rows = tab === "ausgang" ? out : tab === "eingang" ? incoming : [...out, ...incoming];
  rows.sort((a, b) => (a.date < b.date ? 1 : -1));

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "alle", label: "Alle Belege", count: out.length + incoming.length },
    { id: "ausgang", label: "Ausgangsbelege", count: out.length },
    { id: "eingang", label: "Eingangsbelege", count: incoming.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-neutral-900">Belege</h2>
        <Link href="/rechnungen/neu"
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
          + Neuer Beleg
        </Link>
      </div>

      <div className="flex gap-1 border-b border-neutral-200">
        {tabs.map((t) => (
          <Link key={t.id} href={t.id === "alle" ? "/belege" : `/belege?tab=${t.id}`}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}>
            {t.label} <span className="text-neutral-400">({t.count})</span>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          Keine Belege.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => (
                <tr key={r.key} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={r.href} className="font-medium hover:underline">{r.title}</Link>
                    <div className="text-xs text-neutral-500">{r.meta} · {r.dateLabel}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${r.statusClass}`}>{r.statusLabel}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-medium tabular-nums">{formatCents(r.amount)}</div>
                    <div className={`text-xs ${r.kind === "out" ? "text-green-600" : "text-amber-600"}`}>{r.direction}</div>
                  </td>
                  <td className="px-2 py-3 text-right"><RowActions b={r} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
