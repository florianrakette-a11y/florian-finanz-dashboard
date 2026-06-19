"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function CategoryCell({
  value,
  options,
  labels = {},
  action,
}: {
  value: string;
  options: string[];
  labels?: Record<string, string>;
  /** Gebundene Server-Action: speichert die neue Kategorie für diese Zeile. */
  action: (category: string) => Promise<void>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save(category: string) {
    const c = category.trim();
    if (!c || c === value) {
      setEditing(false);
      setCustom(false);
      return;
    }
    startTransition(async () => {
      await action(c);
      router.refresh();
      setEditing(false);
      setCustom(false);
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded px-1.5 py-0.5 text-left hover:bg-neutral-100 hover:ring-1 hover:ring-neutral-200"
        title="Kategorie ändern"
      >
        {labels[value] ?? value}
      </button>
    );
  }

  if (custom) {
    return (
      <span className="flex items-center gap-1">
        <input
          autoFocus
          defaultValue=""
          placeholder="Neue Kategorie…"
          disabled={isPending}
          onKeyDown={(e) => {
            if (e.key === "Enter") save((e.target as HTMLInputElement).value);
            if (e.key === "Escape") {
              setEditing(false);
              setCustom(false);
            }
          }}
          className="w-36 rounded border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-900"
        />
        <button
          type="button"
          onClick={(e) =>
            save((e.currentTarget.previousElementSibling as HTMLInputElement).value)
          }
          disabled={isPending}
          className="text-xs font-medium text-neutral-700 hover:text-neutral-900"
        >
          OK
        </button>
      </span>
    );
  }

  return (
    <select
      autoFocus
      defaultValue=""
      disabled={isPending}
      onChange={(e) => {
        if (e.target.value === "__custom__") setCustom(true);
        else if (e.target.value) save(e.target.value);
      }}
      onBlur={() => setEditing(false)}
      className="rounded border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-900"
    >
      <option value="" disabled>
        Kategorie wählen…
      </option>
      {options.map((o) => (
        <option key={o} value={o}>
          {labels[o] ?? o}
        </option>
      ))}
      <option value="__custom__">+ Neue Kategorie…</option>
    </select>
  );
}
