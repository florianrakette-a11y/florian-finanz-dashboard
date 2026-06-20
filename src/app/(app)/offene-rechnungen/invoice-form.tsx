"use client";

import { useActionState, useEffect, useRef } from "react";
import { createInvoice, type FormState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";
const labelClass = "text-sm font-medium text-neutral-700";

export function InvoiceForm() {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    createInvoice,
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
          <label htmlFor="recipient" className={labelClass}>
            Empfänger
          </label>
          <input id="recipient" name="recipient" required placeholder="z. B. Finanzamt" className={inputClass} />
        </div>
        <div className="space-y-1">
          <label htmlFor="amount" className={labelClass}>
            Betrag (€)
          </label>
          <input id="amount" name="amount" required inputMode="decimal" placeholder="238,00" className={inputClass} />
        </div>
        <div className="space-y-1">
          <label htmlFor="due_date" className={labelClass}>
            Fällig am <span className="text-neutral-400">(optional)</span>
          </label>
          <input id="due_date" name="due_date" type="date" className={inputClass} />
        </div>
        <div className="space-y-1">
          <label htmlFor="iban" className={labelClass}>
            IBAN <span className="text-neutral-400">(optional)</span>
          </label>
          <input id="iban" name="iban" className={inputClass} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="description" className={labelClass}>
            Beschreibung <span className="text-neutral-400">(optional, wofür)</span>
          </label>
          <input
            id="description"
            name="description"
            placeholder="z. B. Nachzahlung Beiträge 2024"
            className={inputClass}
          />
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
