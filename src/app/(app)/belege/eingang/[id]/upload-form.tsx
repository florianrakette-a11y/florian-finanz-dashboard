"use client";

import { useActionState } from "react";
import { uploadReceiptFile, type UploadState } from "../../actions";

export function UploadForm({ openInvoiceId, hasFile }: { openInvoiceId: string; hasFile: boolean }) {
  const [state, formAction, pending] = useActionState<UploadState, FormData>(
    uploadReceiptFile.bind(null, openInvoiceId),
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <input
        type="file"
        name="file"
        accept="application/pdf,image/jpeg,image/png,image/heic,image/webp"
        required
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-neutral-800"
      />
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Datei gespeichert.</p>}
      <button type="submit" disabled={pending}
        className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50">
        {pending ? "Lädt hoch…" : hasFile ? "Datei ersetzen" : "Datei hochladen"}
      </button>
    </form>
  );
}
