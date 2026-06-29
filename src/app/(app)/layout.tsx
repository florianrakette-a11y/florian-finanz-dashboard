import { Nav } from "@/components/nav";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 md:flex-row">
      {/* Mobil: Burger-Menü (nativ via <details>, klappt nur auf Tap auf) */}
      <details className="border-b border-neutral-200 bg-white md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between p-4">
          <span className="text-base font-semibold text-neutral-900">Finanz Dashboard</span>
          <span className="text-2xl leading-none text-neutral-700" aria-label="Menü">☰</span>
        </summary>
        <div className="space-y-3 px-3 pb-3">
          <Nav />
          <form action="/auth/signout" method="post" className="px-3">
            <button type="submit" className="text-sm font-medium text-neutral-600">
              Abmelden
            </button>
          </form>
        </div>
      </details>

      {/* Desktop: feste Sidebar */}
      <aside className="hidden shrink-0 border-r border-neutral-200 bg-white p-4 md:flex md:min-h-screen md:w-60 md:flex-col md:justify-between">
        <div className="space-y-6">
          <div className="px-3">
            <h1 className="text-base font-semibold text-neutral-900">
              Finanz Dashboard
            </h1>
          </div>
          <Nav />
        </div>

        <div className="space-y-2 px-3">
          <p className="truncate text-xs text-neutral-500">{user?.email}</p>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Abmelden
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
