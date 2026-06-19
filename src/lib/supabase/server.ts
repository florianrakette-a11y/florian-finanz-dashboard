import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase-Client für Server Components, Server Actions und Route Handlers.
 * Liest/schreibt die Session über Cookies. Nutzt den anon-Key + RLS,
 * die Identität des eingeloggten Nutzers steckt im Session-Cookie.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // In Server Components kann nicht geschrieben werden – das übernimmt
            // die Middleware. Hier bewusst ignorieren.
          }
        },
      },
    },
  );
}
