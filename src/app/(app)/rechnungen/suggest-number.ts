import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Schlägt die nächste Rechnungsnummer vor: Präfix der Standard-Firma + laufende Nummer.
 * ponytail: nur ein Vorschlag, kein Zähler-Management — das Feld ist frei editierbar
 * und die DB-Unique-Regel verhindert Doppelte. Upgrade-Pfad: echten Nummernkreis pflegen.
 */
export async function suggestInvoiceNumber(
  supabase: SupabaseClient<Database>,
): Promise<string> {
  const { data } = await supabase
    .from("companies")
    .select("invoice_prefix, invoice_counter, is_default")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prefix = data?.invoice_prefix ?? "RE";
  const next = (data?.invoice_counter ?? 0) + 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}
