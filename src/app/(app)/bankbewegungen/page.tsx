import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { parseEuroToCents } from "@/lib/format";
import {
  currentMonth,
  isValidMonth,
  monthBounds,
  monthLabel,
  shiftMonth,
} from "@/lib/month";
import { SyncButton } from "./sync-button";
import { TransactionList } from "./transaction-list";

const searchInputClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";

function SearchBar({ q }: { q: string }) {
  return (
    <form action="/bankbewegungen" method="get" className="flex items-center gap-2">
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder="Suche: Gegenseite, Verwendungszweck oder Betrag…"
        className={searchInputClass}
      />
      <button
        type="submit"
        className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        Suchen
      </button>
      {q && (
        <Link
          href="/bankbewegungen"
          className="shrink-0 text-sm text-neutral-500 hover:text-neutral-900"
        >
          zurücksetzen
        </Link>
      )}
    </form>
  );
}

export default async function BankbewegungenPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; q?: string; konto?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const searching = q.length > 0;
  const supabase = await createClient();

  // --- Suchmodus: über alle Monate ---
  if (searching) {
    const esc = q.replace(/[,()%*]/g, " ").trim();
    const conditions = [`counterpart.ilike.%${esc}%`, `purpose.ilike.%${esc}%`];
    try {
      const cents = parseEuroToCents(q);
      if (cents > 0) conditions.push(`amount_cents.eq.${cents}`, `amount_cents.eq.${-cents}`);
    } catch {
      // q ist kein Betrag – nur Textsuche
    }

    const { data, error } = await supabase
      .from("bank_transactions")
      .select("*")
      .or(conditions.join(","))
      .order("date", { ascending: false })
      .limit(200);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Bankbewegungen</h2>
          <p className="mt-1 text-sm text-neutral-500">Suche über alle Monate.</p>
        </div>
        <SearchBar q={q} />
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Fehler bei der Suche: {error.message}
          </p>
        ) : (data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
            Keine Treffer für: {q}
          </div>
        ) : (
          <TransactionList rows={data ?? []} footerLabel={`Treffer für: ${q}`} />
        )}
      </div>
    );
  }

  // --- Monatsmodus ---
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const { from, to } = monthBounds(month);
  const konto = sp.konto === "Kontist" || sp.konto === "PayPal" ? sp.konto : null;

  let query = supabase
    .from("bank_transactions")
    .select("*")
    .gte("date", from)
    .lte("date", to);
  if (konto) query = query.eq("bb_account", konto);
  const { data: txns, error } = await query.order("date", { ascending: false });

  const rows = txns ?? [];
  const isCurrent = month === currentMonth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Bankbewegungen</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Aus Buchhaltungsbutler (Kontist & PayPal). Abruf nur lesend.
        </p>
      </div>

      <SearchBar q="" />

      <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3">
        <Link
          href={`/bankbewegungen?month=${shiftMonth(month, -1)}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
        >
          ← {monthLabel(shiftMonth(month, -1))}
        </Link>
        <div className="text-center">
          <div className="text-base font-semibold text-neutral-900">{monthLabel(month)}</div>
          {!isCurrent && (
            <Link href="/bankbewegungen" className="text-xs text-neutral-500 hover:text-neutral-900">
              → zum aktuellen Monat
            </Link>
          )}
        </div>
        <Link
          href={`/bankbewegungen?month=${shiftMonth(month, 1)}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
        >
          {monthLabel(shiftMonth(month, 1))} →
        </Link>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1">
          {([null, "Kontist", "PayPal"] as const).map((k) => {
            const active = konto === k;
            const href = k
              ? `/bankbewegungen?month=${month}&konto=${k}`
              : `/bankbewegungen?month=${month}`;
            return (
              <Link
                key={k ?? "alle"}
                href={href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {k ?? "Alle"}
              </Link>
            );
          })}
        </div>
        <SyncButton month={month} />
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Fehler beim Laden: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          Keine Bankbewegungen für {monthLabel(month)}. Klick oben auf den Button, um diesen
          Monat aus Buchhaltungsbutler zu holen.
        </div>
      ) : (
        <TransactionList rows={rows} footerLabel={`Saldo ${monthLabel(month)}`} />
      )}
    </div>
  );
}
