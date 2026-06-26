"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export type FormState = { error?: string; ok?: boolean };

const TAX_REGIONS = ["inland", "eu", "drittland"] as const;

function readForm(formData: FormData) {
  const get = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const tax_region = String(formData.get("tax_region") ?? "inland");
  return {
    company_name: get("company_name"),
    first_name: get("first_name"),
    last_name: get("last_name"),
    street: get("street"),
    zip_code: get("zip_code"),
    city: get("city"),
    country: get("country") ?? "Deutschland",
    tax_region: (TAX_REGIONS as readonly string[]).includes(tax_region) ? tax_region : "inland",
    email: get("email"),
    phone: get("phone"),
    tax_id: get("tax_id"),
    notes: get("notes"),
    company_id: get("company_id") ? Number(formData.get("company_id")) : null,
  };
}

function validate(v: ReturnType<typeof readForm>): string | null {
  if (!v.company_name && !v.last_name) {
    return "Bitte einen Firmennamen oder Nachnamen angeben.";
  }
  return null;
}

/** Nächste freie Kundennummer (numerisch), Start bei 10001. */
async function nextCustomerNumber(supabase: Awaited<ReturnType<typeof requireUser>>): Promise<string> {
  const { data } = await supabase.from("customers").select("customer_number");
  const max = (data ?? []).reduce((m, r) => {
    const n = parseInt(r.customer_number, 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 10000);
  return String(max + 1);
}

export async function createCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  const v = readForm(formData);
  const err = validate(v);
  if (err) return { error: err };

  const supabase = await requireUser();
  const customer_number = await nextCustomerNumber(supabase);
  const { error } = await supabase.from("customers").insert({ ...v, customer_number });
  if (error) return { error: "Speichern fehlgeschlagen: " + error.message };

  revalidatePath("/kunden");
  return { ok: true };
}

export async function updateCustomer(id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const v = readForm(formData);
  const err = validate(v);
  if (err) return { error: err };

  const supabase = await requireUser();
  const { error } = await supabase.from("customers").update(v).eq("id", id);
  if (error) return { error: "Speichern fehlgeschlagen: " + error.message };

  revalidatePath("/kunden");
  revalidatePath(`/kunden/${id}`);
  redirect("/kunden");
}

export async function deleteCustomer(formData: FormData) {
  const id = Number(formData.get("id"));
  const supabase = await requireUser();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  // ponytail: FK schützt Kunden mit Rechnungen — Fehler dem Nutzer zeigen statt schlucken.
  if (error) {
    redirect("/kunden?fehler=" + encodeURIComponent("Kunde hat noch Rechnungen und kann nicht gelöscht werden."));
  }
  revalidatePath("/kunden");
}
