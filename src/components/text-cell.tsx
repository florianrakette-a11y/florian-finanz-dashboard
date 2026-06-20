"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function TextCell({
  value,
  action,
  placeholder = "hinzufügen…",
}: {
  value: string | null;
  action: (text: string) => Promise<void>;
  placeholder?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save(next: string) {
    if (next.trim() === (value ?? "").trim()) {
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
        className="rounded px-1.5 py-0.5 text-left text-xs hover:bg-neutral-100 hover:ring-1 hover:ring-neutral-200"
        title="Beschreibung ändern"
      >
        {value ? (
          <span className="text-neutral-500">{value}</span>
        ) : (
          <span className="italic text-neutral-400">{placeholder}</span>
        )}
      </button>
    );
  }

  return (
    <input
      type="text"
      autoFocus
      defaultValue={value ?? ""}
      disabled={isPending}
      placeholder={placeholder}
      onKeyDown={(e) => {
        if (e.key === "Enter") save((e.target as HTMLInputElement).value);
        if (e.key === "Escape") setEditing(false);
      }}
      onBlur={(e) => save(e.target.value)}
      className="w-64 rounded border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-900"
    />
  );
}
