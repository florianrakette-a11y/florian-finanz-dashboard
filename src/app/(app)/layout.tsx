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
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="flex w-60 shrink-0 flex-col justify-between border-r border-neutral-200 bg-white p-4">
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

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
