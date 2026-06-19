"use client";

import { useActionState, useEffect, useRef } from "react";
import { FREQUENCY_LABELS, centsToInput } from "@/lib/format";
import { Constants } from "@/lib/supabase/database.types";
import type { Database } from "@/lib/supabase/database.types";
import type { FormState } from "./actions";

type Row = Database["public"]["Tables"]["fixed_expenses"]["Row"];

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";
const labelClass = "text-sm font-medium text-neutral-700";

export function FixedExpenseForm({
  action,
  initial,
  submitLabel,
  resetOnSuccess = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: Row;
  submitLabel: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.ok) {
      formRef.current?.reset();
    }
  }, [state, resetOnSuccess]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="name" className={labelClass}>
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={initial?.name ?? ""}
            placeholder="z. B. Miete Büro"
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="amount" className={labelClass}>
            Betrag (€)
          </label>
          <input
            id="amount"
            name="amount"
            required
            inputMode="decimal"
            defaultValue={initial ? centsToInput(initial.amount_cents) : ""}
            placeholder="172,00"
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="category" className={labelClass}>
            Kategorie
          </label>
          <select
            id="category"
            name="category"
            required
            defaultValue={initial?.category ?? ""}
            className={inputClass}
          >
            <option value="" disabled>
              Bitte wählen…
            </option>
            {Constants.public.Enums.fixed_expense_category.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="frequency" className={labelClass}>
            Turnus
          </label>
          <select
            id="frequency"
            name="frequency"
            required
            defaultValue={initial?.frequency ?? "monthly"}
            className={inputClass}
          >
            {Constants.public.Enums.expense_frequency.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="due_day_of_month" className={labelClass}>
            Fälligkeitstag (1–31)
          </label>
          <input
            id="due_day_of_month"
            name="due_day_of_month"
            type="number"
            min={1}
            max={31}
            required
            defaultValue={initial?.due_day_of_month ?? 1}
            className={inputClass}
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="end_date" className={labelClass}>
            Enddatum <span className="text-neutral-400">(optional, z. B. bei Krediten/Leasing)</span>
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            defaultValue={initial?.end_date ?? ""}
            className={inputClass}
          />
        </div>

        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            name="active"
            defaultChecked={initial?.active ?? true}
            className="h-4 w-4 rounded border-neutral-300"
          />
          <span className="text-sm text-neutral-700">Aktiv</span>
        </label>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
      >
        {isPending ? "Speichern…" : submitLabel}
      </button>
    </form>
  );
}
