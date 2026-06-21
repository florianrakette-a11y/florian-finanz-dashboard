"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { extractReceipt, type Extracted } from "./extract-action";
import { createInvoice, type FormState } from "../offene-rechnungen/actions";

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";
const labelClass = "text-sm font-medium text-neutral-700";

// Verkleinert das Foto auf max. 1568px lange Kante (Claude-Empfehlung) → JPEG.
async function toDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1568 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function ReceiptScanner() {
  const [status, setStatus] = useState<"idle" | "reading" | "review">("idle");
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(createInvoice, {});

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setStatus("reading");
    try {
      const res = await extractReceipt(await toDataUrl(file));
      if (res.error) {
        setErr(res.error);
        setStatus("idle");
      } else {
        setExtracted(res.data!);
        setStatus("review");
      }
    } catch {
      setErr("Bild konnte nicht verarbeitet werden.");
      setStatus("idle");
    }
  }

  if (state.ok) {
    return (
      <div className="space-y-4 rounded-2xl border border-green-200 bg-green-50 p-6 text-sm">
        <p className="font-medium text-green-800">Als offene Rechnung gespeichert. ✅</p>
        <div className="flex gap-3">
          <Link href="/offene-rechnungen" className="font-medium text-green-800 underline">
            Zu den offenen Rechnungen
          </Link>
          <button
            onClick={() => {
              setExtracted(null);
              setStatus("idle");
            }}
            className="font-medium text-neutral-600 hover:text-neutral-900"
          >
            Nächsten Beleg scannen
          </button>
        </div>
      </div>
    );
  }

  if (status === "review" && extracted) {
    return (
      <form action={formAction} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <p className="text-sm text-neutral-500">Prüfen und korrigieren, dann speichern:</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="recipient" className={labelClass}>Empfänger</label>
            <input id="recipient" name="recipient" required defaultValue={extracted.recipient} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label htmlFor="amount" className={labelClass}>Betrag (€)</label>
            <input id="amount" name="amount" required inputMode="decimal" defaultValue={extracted.amount} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label htmlFor="due_date" className={labelClass}>Fällig am <span className="text-neutral-400">(optional)</span></label>
            <input id="due_date" name="due_date" type="date" defaultValue={extracted.due_date} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label htmlFor="iban" className={labelClass}>IBAN <span className="text-neutral-400">(optional)</span></label>
            <input id="iban" name="iban" defaultValue={extracted.iban} className={inputClass} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="description" className={labelClass}>Beschreibung <span className="text-neutral-400">(optional)</span></label>
            <input id="description" name="description" defaultValue={extracted.purpose} className={inputClass} />
          </div>
        </div>
        {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={pending} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
            {pending ? "Speichern…" : "Als offene Rechnung speichern"}
          </button>
          <button type="button" onClick={() => { setExtracted(null); setStatus("idle"); }} className="text-sm text-neutral-500 hover:text-neutral-900">
            Verwerfen
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
        {status === "reading" ? "Lese Beleg…" : "Rechnung fotografieren"}
        <input type="file" accept="image/*" capture="environment" disabled={status === "reading"} onChange={onPick} className="hidden" />
      </label>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
    </div>
  );
}
