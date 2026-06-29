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
      <aside className="shrink-0 border-b border-neutral-200 bg-white p-3 md:flex md:w-60 md:min-h-screen md:flex-col md:justify-between md:border-b-0 md:border-r md:p-4">
        <div className="space-y-3 md:space-y-6">
          <div className="flex items-center justify-between px-1 md:px-3">
            <h1 className="text-base font-semibold text-neutral-900">
              Finanz Dashboard
            </h1>
            <form action="/auth/signout" method="post" className="md:hidden">
              <button type="submit" className="text-sm font-medium text-neutral-600">
                Abmelden
              </button>
            </form>
          </div>
          <Nav />
        </div>

        <div className="hidden space-y-2 px-3 md:block">
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
