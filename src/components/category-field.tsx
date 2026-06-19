"use client";

import { useState } from "react";

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";
const labelClass = "text-sm font-medium text-neutral-700";

/**
 * Kategorie-Auswahl für Formulare: Dropdown aus den (synchronisierten) bekannten
 * Kategorien plus „+ Neue Kategorie…". Sendet `category` bzw. `custom_category`.
 */
export function CategoryField({
  knownCategories,
  labels = {},
  defaultValue = "",
}: {
  knownCategories: string[];
  labels?: Record<string, string>;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="space-y-1">
      <label htmlFor="category" className={labelClass}>
        Kategorie
      </label>
      <select
        id="category"
        name="category"
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={inputClass}
      >
        <option value="" disabled>
          Bitte wählen…
        </option>
        {knownCategories.map((c) => (
          <option key={c} value={c}>
            {labels[c] ?? c}
          </option>
        ))}
        <option value="__custom__">+ Neue Kategorie…</option>
      </select>

      {value === "__custom__" && (
        <input
          name="custom_category"
          required
          placeholder="Neue Kategorie…"
          className={`mt-2 ${inputClass}`}
        />
      )}
    </div>
  );
}
