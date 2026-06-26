"use client";

import { useActionState, useState } from "react";
import { confirmAsExpense, confirmAsInvoice, rejectImport, type InboxState } from "./actions";
import { centsToInput } from "@/lib/format";

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";
const labelClass = "text-xs font-medium text-neutral-600";

export type InboxImport = {
  id: string;
  mailbox: string;
  sender: string | null;
  subject: string | null;
  received_at: string | null;
  amount_cents: number | null;
};

export function InboxItem({ imp }: { imp: InboxImport }) {
  const [kind, setKind] = useState<"paid" | "open">("paid");
  const action = kind === "paid" ? confirmAsExpense : confirmAsInvoice;
  const [state, formAction, pending] = useActionState<InboxState, FormData>(action, {});

  const defaultDate = imp.received_at ? imp.received_at.slice(0, 10) : "";
  const defaultAmount = imp.amount_cents != null ? centsToInput(imp.amount_cents) : "";

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-neutral-900">{imp.subject || "(kein Betreff)"}</p>
          <p className="truncate text-sm text-neutral-500">{imp.sender || "?"}</p>
          <p className="mt-1 text-xs text-neutral-400">
            Postfach: {imp.mailbox}
            {imp.received_at ? ` · ${new Date(imp.received_at).toLocaleDateString("de-DE")}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <a href={`/posteingang/${imp.id}/datei`} target="_blank" rel="noreferrer"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50">
            PDF ansehen
          </a>
          <form action={rejectImport}>
            <input type="hidden" name="id" value={imp.id} />
            <button type="submit" className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
              Verwerfen
            </button>
          </form>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => setKind("paid")}
          className={`rounded-full border px-3 py-1 text-sm ${kind === "paid" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-600"}`}>
          Bereits bezahlt (Ausgabe)
        </button>
        <button type="button" onClick={() => setKind("open")}
          className={`rounded-full border px-3 py-1 text-sm ${kind === "open" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-600"}`}>
          Offene Rechnung
        </button>
      </div>

      <form action={formAction} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={imp.id} />
        <div className="space-y-1">
          <label className={labelClass}>Betrag (€, brutto)</label>
          <input name="amount" inputMode="decimal" defaultValue={defaultAmount} placeholder="58,90" className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>{kind === "open" ? "Fällig am" : "Belegdatum"}</label>
          <input name="date" type="date" defaultValue={defaultDate} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>USt.-Satz (Buchhaltungsbutler)</label>
          <select name="vat_rate" defaultValue="19" className={inputClass}>
            <option value="19">19 %</option><option value="7">7 %</option><option value="0">0 %</option><option value="">unklar</option>
          </select>
        </div>
        {kind === "paid" ? (
          <div className="space-y-1">
            <label className={labelClass}>Kategorie</label>
            <input name="category" defaultValue="" placeholder="z. B. Software" className={inputClass} />
          </div>
        ) : (
          <div className="space-y-1">
            <label className={labelClass}>Verwendungszweck</label>
            <input name="purpose" defaultValue={imp.subject || ""} className={inputClass} />
          </div>
        )}

        {state.error && <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

        <div className="sm:col-span-2">
          <button type="submit" disabled={pending}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
            {pending ? "Speichere & sende an Buchhaltungsbutler…" : "Übernehmen & an Buchhaltungsbutler"}
          </button>
        </div>
      </form>
    </div>
  );
}
