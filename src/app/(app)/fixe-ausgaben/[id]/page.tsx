import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FixedExpenseForm } from "../fixed-expense-form";
import { updateFixedExpense } from "../actions";

export default async function EditFixedExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: expense } = await supabase
    .from("fixed_expenses")
    .select("*")
    .eq("id", id)
    .single();

  if (!expense) notFound();

  const updateAction = updateFixedExpense.bind(null, id);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/fixe-ausgaben"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Zurück zur Übersicht
        </Link>
        <h2 className="mt-2 text-2xl font-semibold text-neutral-900">
          Fixe Ausgabe bearbeiten
        </h2>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <FixedExpenseForm
          action={updateAction}
          initial={expense}
          submitLabel="Änderungen speichern"
        />
      </div>
    </div>
  );
}
