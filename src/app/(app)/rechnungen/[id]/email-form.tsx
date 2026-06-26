"use client";

import { useActionState } from "react";
import { sendInvoiceEmail, type FormState } from "../actions";

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";

export function EmailForm({
  invoiceId,
  defaultTo,
  defaultSubject,
  defaultMessage,
}: {
  invoiceId: number;
  defaultTo: string;
  defaultSubject: string;
  defaultMessage: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    sendInvoiceEmail.bind(null, invoiceId),
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="text-sm font-medium text-neutral-700">An (E-Mail)</label>
        <input name="to" type="text" defaultValue={defaultTo} placeholder="kunde@example.com" className={inputClass} />
      </div>
      <div>
        <label className="text-sm font-medium text-neutral-700">Betreff</label>
        <input name="subject" defaultValue={defaultSubject} className={inputClass} />
      </div>
      <div>
        <label className="text-sm font-medium text-neutral-700">Nachricht</label>
        <textarea name="message" rows={6} defaultValue={defaultMessage} className={`${inputClass} resize-y`} />
      </div>
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">E-Mail wurde versendet ✓</p>}
      <button type="submit" disabled={pending}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
        {pending ? "Sende…" : "E-Mail senden"}
      </button>
    </form>
  );
}
