"use client";

import { useActionState, useMemo, useState } from "react";
import { formatCents, parseEuroToCents } from "@/lib/format";
import { UNIT_LABELS } from "@/lib/invoice";
import type { Database } from "@/lib/supabase/database.types";
import type { FormState } from "./actions";

type Customer = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  "id" | "company_name" | "first_name" | "last_name" | "street" | "zip_code" | "city" | "company_id"
>;
type Company = Database["public"]["Tables"]["companies"]["Row"];

export type PositionInput = {
  description: string;
  details: string;
  quantity: string;
  price: string; // Euro-String
  unit: string;
  vatRate: number;
};

export type InvoiceInitial = {
  customer_id: number;
  company_id: number | null;
  invoice_number: string;
  invoice_date: string;
  service_start_date: string;
  service_end_date: string;
  payment_term_days: number;
  is_reverse_charge: boolean;
  status: string;
  notes: string;
  positions: PositionInput[];
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  open: "Offen",
  paid: "Bezahlt",
  overdue: "Überfällig",
  cancelled: "Storniert",
};

const dashed = "bg-transparent border-b border-dashed border-neutral-300 focus:outline-none focus:border-blue-500 py-0.5";
const emptyRow: PositionInput = { description: "", details: "", quantity: "1", price: "", unit: "stunden", vatRate: 19 };

function safeCents(qty: string, price: string): number {
  try {
    const q = Number(qty.replace(",", "."));
    if (!Number.isFinite(q)) return 0;
    return Math.round(q * parseEuroToCents(price));
  } catch {
    return 0;
  }
}

export function InvoiceForm({
  action,
  customers,
  companies,
  suggestedNumber,
  initial,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  customers: Customer[];
  companies: Company[];
  suggestedNumber: string;
  initial?: InvoiceInitial;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(action, {});

  const [companyId, setCompanyId] = useState<number | "">(
    initial?.company_id ?? companies.find((c) => c.is_default)?.id ?? companies[0]?.id ?? "",
  );
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerId, setCustomerId] = useState<number | "">(initial?.customer_id ?? "");
  const [nc, setNc] = useState({ company_name: "", first_name: "", last_name: "", street: "", zip_code: "", city: "", email: "" });
  const [positions, setPositions] = useState<PositionInput[]>(
    initial?.positions.length ? initial.positions : [{ ...emptyRow }],
  );
  const [reverseCharge, setReverseCharge] = useState<boolean>(initial?.is_reverse_charge ?? false);

  const company = companies.find((c) => c.id === companyId);
  const customer = customers.find((c) => c.id === customerId);

  const totals = useMemo(() => {
    const subtotal = positions.reduce((s, p) => s + safeCents(p.quantity, p.price), 0);
    const byRate: Record<number, number> = {};
    if (!reverseCharge) {
      positions.forEach((p) => {
        const lt = safeCents(p.quantity, p.price);
        byRate[p.vatRate] = (byRate[p.vatRate] || 0) + Math.round((lt * p.vatRate) / 100);
      });
    }
    const vat = Object.values(byRate).reduce((s, v) => s + v, 0);
    return { subtotal, byRate, vat, total: subtotal + vat };
  }, [positions, reverseCharge]);

  const setRow = (i: number, patch: Partial<PositionInput>) =>
    setPositions((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setPositions((rows) => [...rows, { ...emptyRow }]);
  const removeRow = (i: number) => setPositions((rows) => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows));

  const today = new Date().toISOString().slice(0, 10);
  const recipientName = isNewCustomer
    ? nc.company_name || [nc.first_name, nc.last_name].filter(Boolean).join(" ")
    : customer?.company_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "";

  return (
    <form action={formAction} className="space-y-4">
      {/* versteckte Felder für die Server-Action */}
      <input type="hidden" name="positions" value={JSON.stringify(positions)} />
      <input type="hidden" name="new_customer" value={isNewCustomer ? "1" : "0"} />
      <input type="hidden" name="company_id" value={companyId} />
      {!isNewCustomer && <input type="hidden" name="customer_id" value={customerId} />}
      <input type="hidden" name="is_reverse_charge" value={reverseCharge ? "on" : ""} />

      {/* Absender + Status (außerhalb des Blatts) */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-neutral-500">Absender:</span>
          <select value={companyId} onChange={(e) => setCompanyId(Number(e.target.value))}
            className="rounded border border-neutral-300 px-2 py-1">
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-neutral-500">Status:</span>
          <select name="status" defaultValue={initial?.status ?? "draft"}
            className="rounded border border-neutral-300 px-2 py-1">
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      {/* ===== A4-Rechnungsblatt ===== */}
      <div className="mx-auto w-full max-w-3xl rounded-lg border border-neutral-200 bg-white p-10 text-neutral-900 shadow-xl">
        {/* Kopf */}
        <div className="mb-8 flex items-start justify-between">
          <div className="w-56">
            {company?.logo_url
              ? <img src={company.logo_url} alt="Logo" className="max-h-24 max-w-full object-contain" />
              : <div className="text-sm italic text-neutral-400">Kein Logo</div>}
          </div>
          <div className="text-right text-sm">
            <div className="mb-3 text-2xl font-bold">Rechnung</div>
            <table className="ml-auto text-xs">
              <tbody>
                <tr>
                  <td className="pr-4 text-left text-neutral-500">Rechnungsnr.:</td>
                  <td className="text-right"><input name="invoice_number" defaultValue={initial?.invoice_number ?? suggestedNumber}
                    className={`${dashed} text-right text-xs w-28`} /></td>
                </tr>
                <tr>
                  <td className="pr-4 text-left text-neutral-500">Datum:</td>
                  <td className="text-right"><input type="date" name="invoice_date" defaultValue={initial?.invoice_date ?? today}
                    className={`${dashed} text-right text-xs`} /></td>
                </tr>
                <tr>
                  <td className="pr-4 text-left text-neutral-500">Leistung von:</td>
                  <td className="text-right"><input type="date" name="service_start_date" defaultValue={initial?.service_start_date ?? ""}
                    className={`${dashed} text-right text-xs`} /></td>
                </tr>
                <tr>
                  <td className="pr-4 text-left text-neutral-500">Leistung bis:</td>
                  <td className="text-right"><input type="date" name="service_end_date" defaultValue={initial?.service_end_date ?? ""}
                    className={`${dashed} text-right text-xs`} /></td>
                </tr>
                <tr>
                  <td className="pr-4 text-left text-neutral-500">Zahlungsfrist:</td>
                  <td className="text-right"><input type="number" name="payment_term_days" min={0} defaultValue={initial?.payment_term_days ?? 7}
                    className={`${dashed} w-10 text-right text-xs`} /> Tage</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-4 space-y-0.5 text-xs text-neutral-600">
              <div className="font-semibold text-neutral-800">{company?.name}</div>
              <div>{company?.street}</div>
              <div>{company?.zip_code} {company?.city}</div>
              {company?.phone && <div>Tel.: {company.phone}</div>}
              {company?.email && <div>{company.email}</div>}
            </div>
          </div>
        </div>

        {/* Empfänger */}
        <div className="mb-8">
          <div className="mb-3 flex gap-3">
            <button type="button" onClick={() => setIsNewCustomer(false)}
              className={`rounded-full border px-3 py-1 text-xs ${!isNewCustomer ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-600 hover:border-neutral-500"}`}>
              Bestehender Kunde
            </button>
            <button type="button" onClick={() => setIsNewCustomer(true)}
              className={`rounded-full border px-3 py-1 text-xs ${isNewCustomer ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-600 hover:border-neutral-500"}`}>
              + Neuer Kunde
            </button>
          </div>

          {!isNewCustomer ? (
            <div>
              <select value={customerId} onChange={(e) => setCustomerId(Number(e.target.value))}
                className="w-72 rounded border border-neutral-300 px-2 py-1.5 text-sm">
                <option value="">Kunde auswählen…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ")}</option>
                ))}
              </select>
              {customer && (
                <div className="mt-2 space-y-0.5 text-sm font-medium">
                  <div>{recipientName}</div>
                  <div>{customer.street}</div>
                  <div>{[customer.zip_code, customer.city].filter(Boolean).join(" ")}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid max-w-sm grid-cols-2 gap-2">
              <input name="nc_company_name" placeholder="Firmenname *" value={nc.company_name}
                onChange={(e) => setNc({ ...nc, company_name: e.target.value })} className={`col-span-2 text-sm font-medium ${dashed}`} />
              <input name="nc_first_name" placeholder="Vorname" value={nc.first_name}
                onChange={(e) => setNc({ ...nc, first_name: e.target.value })} className={`text-sm ${dashed}`} />
              <input name="nc_last_name" placeholder="Nachname" value={nc.last_name}
                onChange={(e) => setNc({ ...nc, last_name: e.target.value })} className={`text-sm ${dashed}`} />
              <input name="nc_street" placeholder="Straße & Hausnr." value={nc.street}
                onChange={(e) => setNc({ ...nc, street: e.target.value })} className={`col-span-2 text-sm ${dashed}`} />
              <input name="nc_zip_code" placeholder="PLZ" value={nc.zip_code}
                onChange={(e) => setNc({ ...nc, zip_code: e.target.value })} className={`text-sm ${dashed}`} />
              <input name="nc_city" placeholder="Ort" value={nc.city}
                onChange={(e) => setNc({ ...nc, city: e.target.value })} className={`text-sm ${dashed}`} />
              <input name="nc_email" type="email" placeholder="E-Mail (optional)" value={nc.email}
                onChange={(e) => setNc({ ...nc, email: e.target.value })} className={`col-span-2 text-sm ${dashed}`} />
            </div>
          )}
        </div>

        {/* Positionen */}
        <div className="mb-6">
          <div className="grid rounded-t border border-neutral-300 bg-neutral-100 px-2 py-2 text-xs font-semibold text-neutral-700"
            style={{ gridTemplateColumns: "2rem 1fr 4rem 4.5rem 6rem 6rem 2rem" }}>
            <div>Pos.</div><div>Bezeichnung</div><div className="text-right">Menge</div>
            <div className="text-center">Einheit</div><div className="text-right">Einzel</div><div className="text-right">Gesamt</div><div />
          </div>
          {positions.map((p, i) => (
            <div key={i} className="border-x border-b border-neutral-300">
              <div className="grid items-start gap-1 px-2 py-2" style={{ gridTemplateColumns: "2rem 1fr 4rem 4.5rem 6rem 6rem 2rem" }}>
                <div className="pt-1 text-xs text-neutral-500">{i + 1}</div>
                <div>
                  <input placeholder="Bezeichnung *" value={p.description} onChange={(e) => setRow(i, { description: e.target.value })}
                    className={`w-full text-sm font-medium ${dashed}`} />
                  <textarea placeholder="Details (optional)" value={p.details} onChange={(e) => setRow(i, { details: e.target.value })}
                    rows={1} className={`mt-1 w-full resize-none text-xs text-neutral-500 ${dashed} border-neutral-200`} />
                  <div className="mt-1 flex items-center gap-1">
                    <span className="text-xs text-neutral-400">MwSt:</span>
                    <select value={p.vatRate} onChange={(e) => setRow(i, { vatRate: Number(e.target.value) })} disabled={reverseCharge}
                      className="rounded border border-neutral-200 px-1 text-xs">
                      <option value={19}>19%</option><option value={7}>7%</option><option value={0}>0%</option>
                    </select>
                  </div>
                </div>
                <div><input inputMode="decimal" value={p.quantity} onChange={(e) => setRow(i, { quantity: e.target.value })}
                  className={`w-full text-right text-sm ${dashed}`} /></div>
                <div>
                  <select value={p.unit} onChange={(e) => setRow(i, { unit: e.target.value })}
                    className={`w-full text-center text-xs ${dashed}`}>
                    {Object.entries(UNIT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="flex items-center border-b border-dashed border-neutral-300">
                  <input inputMode="decimal" value={p.price} onChange={(e) => setRow(i, { price: e.target.value })}
                    placeholder="0,00" className="w-full bg-transparent py-0.5 text-right text-sm focus:outline-none" />
                  <span className="ml-0.5 text-xs text-neutral-500">€</span>
                </div>
                <div className="pt-0.5 text-right text-sm font-medium">{formatCents(safeCents(p.quantity, p.price))}</div>
                <div>{positions.length > 1 && (
                  <button type="button" onClick={() => removeRow(i)} className="pt-0.5 text-neutral-300 hover:text-red-500">✕</button>
                )}</div>
              </div>
            </div>
          ))}
          <button type="button" onClick={addRow}
            className="flex w-full items-center justify-center gap-1 rounded-b border border-dashed border-neutral-300 py-2 text-xs text-neutral-400 hover:border-neutral-400 hover:text-neutral-600">
            + Position hinzufügen
          </button>
        </div>

        {/* Summen */}
        <div className="mb-8 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between text-neutral-600"><span>Zwischensumme (netto)</span><span>{formatCents(totals.subtotal)}</span></div>
            {reverseCharge ? (
              <div className="text-xs italic text-neutral-500">Reverse Charge – Steuerschuld geht auf den Leistungsempfänger über</div>
            ) : (
              Object.entries(totals.byRate).filter(([r]) => Number(r) > 0).map(([r, amt]) => (
                <div key={r} className="flex justify-between text-neutral-600"><span>Umsatzsteuer {r}%</span><span>{formatCents(amt)}</span></div>
              ))
            )}
            <div className="flex justify-between border-t border-neutral-300 pt-1 text-base font-bold"><span>Gesamtbetrag</span><span>{formatCents(totals.total)}</span></div>
          </div>
        </div>

        {/* Optionen */}
        <div className="space-y-3 border-t border-neutral-100 pt-4">
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input type="checkbox" checked={reverseCharge} onChange={(e) => setReverseCharge(e.target.checked)} className="h-4 w-4" />
            Reverse Charge (Steuerschuld auf Leistungsempfänger)
          </label>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Interne Notizen (nicht auf der Rechnung)</label>
            <textarea name="notes" rows={2} defaultValue={initial?.notes ?? ""}
              className="w-full resize-none rounded border border-neutral-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
          </div>
        </div>

        {/* Footer-Vorschau */}
        <div className="mt-8 grid grid-cols-3 gap-4 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
          <div>
            <div className="font-medium text-neutral-700">{company?.name}</div>
            <div>{company?.street}</div>
            <div>{company?.zip_code} {company?.city}</div>
            {company?.phone && <div>Tel.: {company.phone}</div>}
            {company?.email && <div>{company.email}</div>}
          </div>
          <div>
            {company?.vat_id && <div>USt-IdNr.: {company.vat_id}</div>}
            {company?.tax_number && <div>Steuernr.: {company.tax_number}</div>}
          </div>
          <div>
            {company?.iban && <div>IBAN: {company.iban}</div>}
            {company?.bic && <div>BIC: {company.bic}</div>}
            {company?.bank_name && <div>{company.bank_name}</div>}
          </div>
        </div>
      </div>

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={isPending}
          className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50">
          {isPending ? "Speichern…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
