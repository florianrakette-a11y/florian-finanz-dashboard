import { createClient } from "@/lib/supabase/server";
import { Constants } from "@/lib/supabase/database.types";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Anzeige-Labels für Kategorie-Werte, die nicht selbsterklärend sind. */
export const CATEGORY_LABELS: Record<string, string> = {
  tanken: "Tanken",
  privat: "Privat",
};

const STANDARD_CATEGORIES = [
  ...Constants.public.Enums.fixed_expense_category,
  ...Constants.public.Enums.variable_expense_category,
];

/**
 * Gemeinsame, synchronisierte Kategorienliste für fixe UND variable Ausgaben:
 * Standardwerte + alle in beiden Tabellen tatsächlich verwendeten Kategorien.
 */
export async function getKnownCategories(supabase: Client): Promise<string[]> {
  const [variable, fixed] = await Promise.all([
    supabase.from("variable_expenses").select("category"),
    supabase.from("fixed_expenses").select("category"),
  ]);

  const all = [
    ...STANDARD_CATEGORIES,
    ...(variable.data ?? []).map((r) => r.category),
    ...(fixed.data ?? []).map((r) => r.category),
  ];

  return Array.from(new Set(all)).sort((a, b) =>
    (CATEGORY_LABELS[a] ?? a).localeCompare(CATEGORY_LABELS[b] ?? b, "de"),
  );
}
