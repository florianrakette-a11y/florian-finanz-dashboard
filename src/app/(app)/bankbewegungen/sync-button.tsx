"use client";

import { useActionState } from "react";
import { syncBankTransactions, type SyncState } from "./actions";

export function SyncButton() {
  const [state, formAction, isPending] = useActionState<SyncState, FormData>(
    syncBankTransactions,
    {},
  );

  return (
    <div className="flex items-center gap-4">
      <form action={formAction}>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {isPending ? "Synchronisiere…" : "Jetzt synchronisieren"}
        </button>
      </form>
      {state.message && (
        <span
          className={`text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}
        >
          {state.message}
        </span>
      )}
    </div>
  );
}
