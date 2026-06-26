import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { CompanySettings, InvoicePdfData } from "./invoice-pdf";

function deDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE");
}

/** Firmen-/PDF-Stammdaten laden: bevorzugt aus companies (per ID), sonst aus invoice_settings (KV). */
async function loadCompanySettings(
  supabase: SupabaseClient<Database>,
  companyId: number | null,
): Promise<CompanySettings> {
  if (companyId) {
    const { data: c } = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();
    if (c) {
      return {
        companyName: c.name ?? "",
        street: c.street ?? "",
        zipCode: c.zip_code ?? "",
        city: c.city ?? "",
        phone: c.phone ?? "",
        email: c.email ?? "",
        website: c.website ?? "",
        taxNumber: c.tax_number ?? "",
        vatId: c.vat_id ?? "",
        iban: c.iban ?? "",
        bic: c.bic ?? "",
        bankName: c.bank_name ?? "",
        owner: c.owner ?? "",
        firstName: c.first_name ?? "",
        lastName: c.last_name ?? "",
        logoUrl: c.logo_url ?? "",
        invoiceIntroText: c.invoice_intro_text || "Unsere Leistungen stellen wir Ihnen wie folgt in Rechnung.",
        invoiceFooterText:
          c.invoice_footer_text ||
          "Bitte überweisen Sie den Betrag innerhalb von 7 Tagen auf das unten genannte Konto.\n\nVielen Dank für die gute Zusammenarbeit.",
      };
    }
  }

  // Fallback: KV-Einstellungen
  const { data: rows } = await supabase.from("invoice_settings").select("key, value");
  const kv: Record<string, string> = {};
  (rows ?? []).forEach((r) => {
    kv[r.key] = r.value ?? "";
  });
  return {
    companyName: kv.companyName || "Raket One / Florian Rakette",
    street: kv.street || "Rondellstr. 2",
    zipCode: kv.zipCode || "14163",
    city: kv.city || "Berlin",
    phone: kv.phone || "+49 174 9204295",
    email: kv.email || "info@raketone.com",
    website: kv.website || "www.raketone.com",
    taxNumber: kv.taxNumber || "25/484/00985",
    vatId: kv.vatId || "DE282359455",
    iban: kv.iban || "DE74 1101 0101 5702 9041 56",
    bic: kv.bic || "SOBKDEB2XXX",
    bankName: kv.bankName || "Finom Germany",
    owner: kv.owner || "Florian Rakette",
    firstName: kv.firstName || "",
    lastName: kv.lastName || "",
    logoUrl: kv.logoUrl || "",
    invoiceIntroText: kv.invoiceIntroText || "Unsere Leistungen stellen wir Ihnen wie folgt in Rechnung.",
    invoiceFooterText:
      kv.invoiceFooterText ||
      "Bitte überweisen Sie den Betrag innerhalb von 7 Tagen auf das unten genannte Konto.\n\nVielen Dank für die gute Zusammenarbeit.",
  };
}

/** Lädt Rechnung + Positionen + Kunde + Firmen-Settings und baut die PDF-Eingabe. */
export async function loadInvoicePdfData(
  supabase: SupabaseClient<Database>,
  invoiceId: number,
): Promise<{ data: InvoicePdfData; settings: CompanySettings; invoiceNumber: string } | null> {
  const [{ data: invoice }, { data: items }] = await Promise.all([
    supabase.from("invoices").select("*, customers(*)").eq("id", invoiceId).maybeSingle(),
    supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("position"),
  ]);
  if (!invoice) return null;

  const customer = invoice.customers;
  const recipientName =
    customer?.company_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "";

  const settings = await loadCompanySettings(supabase, invoice.company_id);

  const data: InvoicePdfData = {
    invoiceNumber: invoice.invoice_number,
    customerNumber: customer?.customer_number ?? "",
    date: deDate(invoice.invoice_date),
    serviceStartDate: invoice.service_start_date ? deDate(invoice.service_start_date) : undefined,
    serviceEndDate: invoice.service_end_date ? deDate(invoice.service_end_date) : undefined,
    recipientName,
    recipientStreet: customer?.street ?? "",
    recipientZipCity: [customer?.zip_code, customer?.city].filter(Boolean).join(" "),
    positions: (items ?? []).map((it) => ({
      description: it.description,
      details: it.details ?? undefined,
      quantity: Number(it.quantity),
      unit: it.unit,
      unitPrice: it.unit_price,
      vatRate: it.vat_rate ?? invoice.vat_rate,
    })),
    vatRate: invoice.vat_rate,
    isReverseCharge: invoice.is_reverse_charge,
    paymentTermDays: invoice.payment_term_days,
  };

  return { data, settings, invoiceNumber: invoice.invoice_number };
}
