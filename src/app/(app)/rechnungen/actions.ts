"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { parseEuroToCents } from "@/lib/format";
import type { Database } from "@/lib/supabase/database.types";
import { loadInvoicePdfData } from "@/lib/pdf/load-invoice";
import { generateInvoicePdf } from "@/lib/pdf/invoice-pdf";
import { sendMail } from "@/lib/email";

export type FormState = { error?: string; ok?: boolean };

const UNITS = ["stueck", "stunden", "pauschal", "tage", "km"] as const;
const STATUSES = ["draft", "open", "paid", "overdue", "cancelled"] as const;

type ParsedPosition = {
  description: string;
  details: string | null;
  quantity: number;
  unit: string;
  unit_price: number; // Cent
  vat_rate: number; // % pro Position
  line_total: number; // Cent, gerundet
};

/** "13,5" / "13.5" -> 13.5; wirft bei Unsinn. */
function parseQuantity(input: string): number {
  const s = input.trim().replace(",", ".");
  const v = Number(s);
  if (!Number.isFinite(v) || v <= 0) throw new Error("Menge muss eine Zahl größer 0 sein.");
  return v;
}

/** Liest die als JSON übergebenen Positionen und parst Menge/Preis. */
function parsePositions(raw: string): ParsedPosition[] {
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    throw new Error("Positionen konnten nicht gelesen werden.");
  }
  if (!Array.isArray(arr) || arr.length === 0) throw new Error("Mindestens eine Position angeben.");

  return arr.map((p, i) => {
    const o = p as Record<string, string>;
    const description = String(o.description ?? "").trim();
    if (!description) throw new Error(`Position ${i + 1}: Beschreibung fehlt.`);
    const quantity = parseQuantity(String(o.quantity ?? ""));
    const unit_price = parseEuroToCents(String(o.price ?? ""));
    const unit = (UNITS as readonly string[]).includes(o.unit) ? o.unit : "stueck";
    const rate = Number(o.vatRate);
    const vat_rate = [0, 7, 19].includes(rate) ? rate : 19;
    return {
      description,
      details: String(o.details ?? "").trim() || null,
      quantity,
      unit,
      unit_price,
      vat_rate,
      line_total: Math.round(quantity * unit_price),
    };
  });
}

type NewCustomer = {
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  street: string | null;
  zip_code: string | null;
  city: string | null;
  email: string | null;
};

type InvoiceInput = {
  customer_id: number | null;
  newCustomer: NewCustomer | null;
  company_id: number | null;
  invoice_number: string;
  invoice_date: string;
  service_start_date: string | null;
  service_end_date: string | null;
  payment_term_days: number;
  vat_rate: number; // repräsentativ (für invoices.vat_rate); USt. wird pro Position gerechnet
  is_reverse_charge: boolean;
  status: string;
  notes: string | null;
  positions: ParsedPosition[];
};

function readForm(formData: FormData): InvoiceInput {
  const str = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };

  const isNew = formData.get("new_customer") === "1";
  let customer_id: number | null = null;
  let newCustomer: NewCustomer | null = null;
  if (isNew) {
    const company_name = str("nc_company_name");
    const last_name = str("nc_last_name");
    if (!company_name && !last_name) throw new Error("Neuer Kunde: Firmenname oder Nachname nötig.");
    newCustomer = {
      company_name,
      first_name: str("nc_first_name"),
      last_name,
      street: str("nc_street"),
      zip_code: str("nc_zip_code"),
      city: str("nc_city"),
      email: str("nc_email"),
    };
  } else {
    customer_id = Number(formData.get("customer_id"));
    if (!Number.isFinite(customer_id) || customer_id <= 0) throw new Error("Bitte einen Kunden wählen.");
  }

  const invoice_number = str("invoice_number");
  if (!invoice_number) throw new Error("Rechnungsnummer fehlt.");

  const invoice_date = str("invoice_date");
  if (!invoice_date) throw new Error("Rechnungsdatum fehlt.");

  const status = String(formData.get("status") ?? "draft");
  const positions = parsePositions(String(formData.get("positions") ?? ""));

  return {
    customer_id,
    newCustomer,
    company_id: str("company_id") ? Number(formData.get("company_id")) : null,
    invoice_number,
    invoice_date,
    service_start_date: str("service_start_date"),
    service_end_date: str("service_end_date"),
    payment_term_days: Number(formData.get("payment_term_days") ?? 7) || 7,
    vat_rate: positions[0]?.vat_rate ?? 19,
    is_reverse_charge: formData.get("is_reverse_charge") === "on",
    status: (STATUSES as readonly string[]).includes(status) ? status : "draft",
    notes: str("notes"),
    positions,
  };
}

/** Summen serverseitig berechnen (autoritativ). USt. pro Position, Reverse Charge = 0%. */
function computeTotals(input: InvoiceInput) {
  const subtotal = input.positions.reduce((s, p) => s + p.line_total, 0);
  const vat_amount = input.positions.reduce((s, p) => {
    const rate = input.is_reverse_charge ? 0 : p.vat_rate;
    return s + Math.round((p.line_total * rate) / 100);
  }, 0);
  return { subtotal, vat_amount, total: subtotal + vat_amount };
}

/** Legt einen neuen Kunden an und gibt die ID zurück (auto. Kundennummer ab 10001). */
async function createCustomerReturningId(
  supabase: Awaited<ReturnType<typeof requireUser>>,
  nc: NewCustomer,
  companyId: number | null,
): Promise<number> {
  const { data: existing } = await supabase.from("customers").select("customer_number");
  const max = (existing ?? []).reduce((m, r) => {
    const n = parseInt(r.customer_number, 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 10000);
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...nc, customer_number: String(max + 1), company_id: companyId })
    .select("id")
    .single();
  if (error || !data) throw new Error("Kunde anlegen fehlgeschlagen: " + (error?.message ?? "unbekannt"));
  return data.id;
}

function dueDateFrom(invoiceDate: string, days: number): string {
  const d = new Date(invoiceDate);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function createInvoice(_prev: FormState, formData: FormData): Promise<FormState> {
  let input: InvoiceInput;
  try {
    input = readForm(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eingabe ungültig." };
  }

  const { subtotal, vat_amount, total } = computeTotals(input);
  const supabase = await requireUser();

  let customerId = input.customer_id;
  if (input.newCustomer) {
    try {
      customerId = await createCustomerReturningId(supabase, input.newCustomer, input.company_id);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Kunde anlegen fehlgeschlagen." };
    }
  }

  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({
      invoice_number: input.invoice_number,
      customer_id: customerId!,
      company_id: input.company_id,
      invoice_date: input.invoice_date,
      service_start_date: input.service_start_date,
      service_end_date: input.service_end_date,
      due_date: dueDateFrom(input.invoice_date, input.payment_term_days),
      payment_term_days: input.payment_term_days,
      status: input.status,
      vat_rate: input.vat_rate,
      is_reverse_charge: input.is_reverse_charge,
      subtotal,
      vat_amount,
      total,
      notes: input.notes,
    })
    .select("id")
    .single();

  if (error || !inv) {
    if (error?.code === "23505") return { error: "Diese Rechnungsnummer gibt es schon." };
    return { error: "Speichern fehlgeschlagen: " + (error?.message ?? "unbekannt") };
  }

  const itemRows = input.positions.map((p, i) => ({
    invoice_id: inv.id,
    position: i + 1,
    description: p.description,
    details: p.details,
    quantity: p.quantity,
    unit: p.unit,
    unit_price: p.unit_price,
    vat_rate: input.is_reverse_charge ? 0 : p.vat_rate,
    total: p.line_total,
  }));
  const { error: itemErr } = await supabase.from("invoice_items").insert(itemRows);
  if (itemErr) {
    // Rechnung ohne Positionen wäre kaputt -> zurückrollen.
    await supabase.from("invoices").delete().eq("id", inv.id);
    return { error: "Positionen speichern fehlgeschlagen: " + itemErr.message };
  }

  revalidatePath("/rechnungen");
  redirect(`/rechnungen/${inv.id}`);
}

export async function updateInvoice(id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  let input: InvoiceInput;
  try {
    input = readForm(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eingabe ungültig." };
  }

  const { subtotal, vat_amount, total } = computeTotals(input);
  const supabase = await requireUser();

  const { error } = await supabase
    .from("invoices")
    .update({
      invoice_number: input.invoice_number,
      customer_id: input.customer_id ?? undefined,
      company_id: input.company_id,
      invoice_date: input.invoice_date,
      service_start_date: input.service_start_date,
      service_end_date: input.service_end_date,
      due_date: dueDateFrom(input.invoice_date, input.payment_term_days),
      payment_term_days: input.payment_term_days,
      status: input.status,
      vat_rate: input.vat_rate,
      is_reverse_charge: input.is_reverse_charge,
      subtotal,
      vat_amount,
      total,
      notes: input.notes,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { error: "Diese Rechnungsnummer gibt es schon." };
    return { error: "Speichern fehlgeschlagen: " + error.message };
  }

  // Positionen komplett ersetzen (einfacher als Diff). ponytail: bei wenigen Zeilen ok.
  await supabase.from("invoice_items").delete().eq("invoice_id", id);
  const itemRows = input.positions.map((p, i) => ({
    invoice_id: id,
    position: i + 1,
    description: p.description,
    details: p.details,
    quantity: p.quantity,
    unit: p.unit,
    unit_price: p.unit_price,
    vat_rate: input.is_reverse_charge ? 0 : p.vat_rate,
    total: p.line_total,
  }));
  const { error: itemErr } = await supabase.from("invoice_items").insert(itemRows);
  if (itemErr) return { error: "Positionen speichern fehlgeschlagen: " + itemErr.message };

  revalidatePath("/rechnungen");
  revalidatePath(`/rechnungen/${id}`);
  redirect(`/rechnungen/${id}`);
}

export async function setInvoiceStatus(formData: FormData) {
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  if (!(STATUSES as readonly string[]).includes(status)) return;
  const supabase = await requireUser();
  const patch: Database["public"]["Tables"]["invoices"]["Update"] = { status };
  if (status === "paid") patch.paid_date = new Date().toISOString();
  await supabase.from("invoices").update(patch).eq("id", id);
  revalidatePath("/rechnungen");
  revalidatePath(`/rechnungen/${id}`);
}

export async function deleteInvoice(formData: FormData) {
  const id = Number(formData.get("id"));
  const supabase = await requireUser();
  await supabase.from("invoices").delete().eq("id", id); // invoice_items via ON DELETE CASCADE
  revalidatePath("/rechnungen");
  revalidatePath("/belege");
  redirect("/belege");
}

/** Versendet die Rechnung als PDF-Anhang per E-Mail. */
export async function sendInvoiceEmail(
  invoiceId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const to = String(formData.get("to") ?? "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (to.length === 0) return { error: "Bitte mindestens eine Empfänger-Adresse angeben." };

  const subject = String(formData.get("subject") ?? "").trim() || "Rechnung";
  const message = String(formData.get("message") ?? "").trim();

  const supabase = await requireUser();
  const loaded = await loadInvoicePdfData(supabase, invoiceId);
  if (!loaded) return { error: "Rechnung nicht gefunden." };

  try {
    const pdf = await generateInvoicePdf(loaded.data, loaded.settings);
    await sendMail({
      to,
      subject,
      text: message,
      attachments: [{ filename: `${loaded.invoiceNumber.replace(/[^\w.-]+/g, "_")}.pdf`, content: pdf }],
    });
  } catch (e) {
    return { error: "Versand fehlgeschlagen: " + (e instanceof Error ? e.message : "unbekannt") };
  }

  revalidatePath(`/rechnungen/${invoiceId}`);
  return { ok: true };
}

/** Dupliziert eine Rechnung als Entwurf (neue Nummer, heutiges Datum) und öffnet den Editor. */
export async function duplicateInvoice(formData: FormData) {
  const id = Number(formData.get("id"));
  const supabase = await requireUser();

  const { data: inv } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (!inv) redirect("/belege");
  const { data: items } = await supabase
    .from("invoice_items").select("*").eq("invoice_id", id).order("position");

  const today = new Date().toISOString();
  const base = {
    customer_id: inv.customer_id,
    company_id: inv.company_id,
    invoice_date: today,
    service_start_date: inv.service_start_date,
    service_end_date: inv.service_end_date,
    due_date: dueDateFrom(today, inv.payment_term_days),
    payment_term_days: inv.payment_term_days,
    status: "draft",
    vat_rate: inv.vat_rate,
    is_reverse_charge: inv.is_reverse_charge,
    subtotal: inv.subtotal,
    vat_amount: inv.vat_amount,
    total: inv.total,
    notes: inv.notes,
  };

  let number = `${inv.invoice_number}-Kopie`;
  let res = await supabase.from("invoices").insert({ ...base, invoice_number: number }).select("id").single();
  if (res.error?.code === "23505") {
    number = `${inv.invoice_number}-Kopie-${Date.now() % 100000}`;
    res = await supabase.from("invoices").insert({ ...base, invoice_number: number }).select("id").single();
  }
  if (res.error || !res.data) redirect("/belege");
  const newId = res.data.id;

  if (items && items.length) {
    await supabase.from("invoice_items").insert(
      items.map((it) => ({
        invoice_id: newId,
        position: it.position,
        description: it.description,
        details: it.details,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate,
        total: it.total,
      })),
    );
  }

  revalidatePath("/belege");
  redirect(`/rechnungen/${newId}/bearbeiten`);
}
