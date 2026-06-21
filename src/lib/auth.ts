import { createClient } from "@/lib/supabase/server";

/**
 * Stellt sicher, dass ein Nutzer angemeldet ist, und gibt den Supabase-Client zurück.
 * In jeder Server Action verwenden (Actions sind per POST direkt erreichbar).
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return supabase;
}
