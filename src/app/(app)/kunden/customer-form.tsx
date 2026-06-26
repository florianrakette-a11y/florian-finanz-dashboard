"use client";

import { useActionState, useEffect, useRef } from "react";
import type { Database } from "@/lib/supabase/database.types";
import type { FormState } from "./actions";

type Customer = Database["public"]["Tables"]["customers"]["Row"];
type Company = Pick<Database["public"]["Tables"]["companies"]["Row"], "id" | "name">;

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";
const labelClass = "text-sm font-medium text-neutral-700";

const TAX_REGION_LABELS: Record<string, string> = {
  inland: "Inland (mit USt.)",
  eu: "EU-Ausland (Reverse Charge)",
  drittland: "Drittland",
};

export function CustomerForm({
  action,
  initial,
  companies,
  submitLabel,
  resetOnSuccess = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: Customer;
  companies: Company[];
  submitLabel: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="company_name" className={labelClass}>Firmenname</label>
          <input id="company_name" name="company_name" defaultValue={initial?.company_name ?? ""}
            placeholder="z. B. Plenumado GmbH" className={inputClass} />
        </div>

        <div className="space-y-1">
          <label htmlFor="first_name" className={labelClass}>Vorname</label>
          <input id="first_name" name="first_name" defaultValue={initial?.first_name ?? ""} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label htmlFor="last_name" className={labelClass}>Nachname</label>
          <input id="last_name" name="last_name" defaultValue={initial?.last_name ?? ""} className={inputClass} />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="street" className={labelClass}>Straße &amp; Hausnummer</label>
          <input id="street" name="street" defaultValue={initial?.street ?? ""} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label htmlFor="zip_code" className={labelClass}>PLZ</label>
          <input id="zip_code" name="zip_code" defaultValue={initial?.zip_code ?? ""} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label htmlFor="city" className={labelClass}>Ort</label>
          <input id="city" name="city" defaultValue={initial?.city ?? ""} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label htmlFor="country" className={labelClass}>Land</label>
          <input id="country" name="country" defaultValue={initial?.country ?? "Deutschland"} className={inputClass} />
        </div>

        <div className="space-y-1">
          <label htmlFor="tax_region" className={labelClass}>Steuerregion</label>
          <select id="tax_region" name="tax_region" defaultValue={initial?.tax_region ?? "inland"} className={inputClass}>
            {Object.entries(TAX_REGION_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className={labelClass}>E-Mail</label>
          <input id="email" name="email" type="email" defaultValue={initial?.email ?? ""} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label htmlFor="phone" className={labelClass}>Telefon</label>
          <input id="phone" name="phone" defaultValue={initial?.phone ?? ""} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label htmlFor="tax_id" className={labelClass}>USt-IdNr.</label>
          <input id="tax_id" name="tax_id" defaultValue={initial?.tax_id ?? ""} className={inputClass} />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="company_id" className={labelClass}>
            Eigene Firma <span className="text-neutral-400">(welcher Absender stellt die Rechnung)</span>
          </label>
          <select id="company_id" name="company_id" defaultValue={initial?.company_id ?? ""} className={inputClass}>
            <option value="">— keine —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="notes" className={labelClass}>Notizen</label>
          <textarea id="notes" name="notes" rows={2} defaultValue={initial?.notes ?? ""} className={inputClass} />
        </div>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button type="submit" disabled={isPending}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50">
        {isPending ? "Speichern…" : submitLabel}
      </button>
    </form>
  );
}
