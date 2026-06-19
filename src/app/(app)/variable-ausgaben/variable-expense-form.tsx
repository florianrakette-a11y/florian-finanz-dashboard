"use client";

import { useActionState, useEffect, useRef } from "react";
import { createVariableExpense, type FormState } from "./actions";
import { CategoryField } from "@/components/category-field";
import { CATEGORY_LABELS } from "@/lib/categories";

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";
const labelClass = "text-sm font-medium text-neutral-700";

export function VariableExpenseForm({
  defaultDate,
  knownCategories,
}: {
  defaultDate: string;
  knownCategories: string[];
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    createVariableExpense,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="date" className={labelClass}>
            Datum
          </label>
          <input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={defaultDate}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="amount" className={labelClass}>
            Betrag (€)
          </label>
          <input id="amount" name="amount" required inputMode="decimal" placeholder="80,00" className={inputClass} />
        </div>
        <CategoryField knownCategories={knownCategories} labels={CATEGORY_LABELS} />
        <div className="space-y-1">
          <label htmlFor="description" className={labelClass}>
            Beschreibung <span className="text-neutral-400">(optional)</span>
          </label>
          <input id="description" name="description" placeholder="z. B. Aral, Grover…" className={inputClass} />
        </div>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
      >
        {isPending ? "Speichern…" : "Hinzufügen"}
      </button>
    </form>
  );
}
