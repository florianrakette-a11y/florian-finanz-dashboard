"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createIncome, type FormState } from "./actions";
import { Constants } from "@/lib/supabase/database.types";

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";
const labelClass = "text-sm font-medium text-neutral-700";

export const INCOME_SOURCE_LABELS: Record<string, string> = {
  youtube: "YouTube",
  igroove: "iGroove",
  knorke: "Knorke",
  elysium_or_other: "Elysium / Sonstige",
  manus_invoice: "Manus-Rechnung",
};

export const INCOME_STATUS_LABELS: Record<string, string> = {
  expected: "Erwartet",
  received: "Erhalten",
};

export function IncomeForm({
  month,
  knownSources,
}: {
  month: string;
  knownSources: { value: string; label: string }[];
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    createIncome,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [sourceValue, setSourceValue] = useState("");

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="month" value={month} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="source" className={labelClass}>
            Quelle
          </label>
          <select
            id="source"
            name="source"
            required
            value={sourceValue}
            onChange={(e) => setSourceValue(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Bitte wählen…
            </option>
            {knownSources.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
            <option value="__custom__">+ Neue Quelle…</option>
          </select>
        </div>

        {sourceValue === "__custom__" && (
          <div className="space-y-1">
            <label htmlFor="custom_source" className={labelClass}>
              Neue Quelle
            </label>
            <input
              id="custom_source"
              name="custom_source"
              required
              placeholder="z. B. Spotify, Bandcamp…"
              className={inputClass}
            />
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="amount" className={labelClass}>
            Betrag (€)
          </label>
          <input id="amount" name="amount" required inputMode="decimal" placeholder="1.124,00" className={inputClass} />
        </div>

        <div className="space-y-1">
          <label htmlFor="status" className={labelClass}>
            Status
          </label>
          <select id="status" name="status" required defaultValue="expected" className={inputClass}>
            {Constants.public.Enums.income_status.map((s) => (
              <option key={s} value={s}>
                {INCOME_STATUS_LABELS[s] ?? s}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="receipt_date" className={labelClass}>
            Eingang am <span className="text-neutral-400">(optional)</span>
          </label>
          <input id="receipt_date" name="receipt_date" type="date" className={inputClass} />
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
