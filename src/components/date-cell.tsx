"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function formatDE(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function DateCell({
  value,
  action,
  placeholder = "offen",
}: {
  value: string | null;
  action: (date: string | null) => Promise<void>;
  placeholder?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save(next: string | null) {
    if ((next ?? "") === (value ?? "")) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      await action(next);
      router.refresh();
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded px-1.5 py-0.5 hover:bg-neutral-100 hover:ring-1 hover:ring-neutral-200"
        title="Eingangsdatum ändern"
      >
        {value ? (
          <span className="tabular-nums">{formatDE(value)}</span>
        ) : (
          <span className="italic text-neutral-400">{placeholder}</span>
        )}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <input
        type="date"
        autoFocus
        defaultValue={value ?? ""}
        disabled={isPending}
        onChange={(e) => save(e.target.value || null)}
        onBlur={() => setEditing(false)}
        className="rounded border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-900"
      />
      {value && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            save(null);
          }}
          disabled={isPending}
          className="text-xs text-neutral-500 hover:text-red-600"
        >
          leeren
        </button>
      )}
    </span>
  );
}
