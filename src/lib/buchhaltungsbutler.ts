import "server-only";

// Buchhaltungsbutler-API-Client. Läuft ausschließlich server-seitig.
// Auth: HTTP Basic (Client:Secret) im Header + api_key im JSON-Body, POST-only.
// Host laut offizieller Spec (v1.9.1): webapp.buchhaltungsbutler.de

const BASE = "https://webapp.buchhaltungsbutler.de/api/v1";

export type BBTransaction = {
  id_by_customer: number;
  to_from: string | null;
  amount: string; // engl. Dezimalformat, negativ = Abgang, z. B. "-9.99"
  booking_date: string; // "YYYY-MM-DD HH:MM:SS"
  value_date: string | null;
  purpose: string | null;
};

function authHeader(): string {
  const client = process.env.BB_API_CLIENT;
  const secret = process.env.BB_API_SECRET;
  if (!client || !secret) {
    throw new Error("BB_API_CLIENT / BB_API_SECRET fehlen in der Umgebung.");
  }
  return "Basic " + Buffer.from(`${client}:${secret}`).toString("base64");
}

async function bbPost<T = unknown>(
  path: string,
  body: Record<string, unknown>,
): Promise<{ rows: number; data: T[] }> {
  const apiKey = process.env.BB_API_KEY;
  if (!apiKey) throw new Error("BB_API_KEY fehlt in der Umgebung.");

  const res = await fetch(BASE + path, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ api_key: apiKey, ...body }),
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success !== true) {
    throw new Error(
      `Buchhaltungsbutler-Fehler (HTTP ${res.status}): ${
        json?.message || "unbekannte Antwort"
      }`,
    );
  }
  return { rows: json.rows ?? 0, data: Array.isArray(json.data) ? json.data : [] };
}

export type BBAccount = {
  name: string;
  postingaccount_number: string | null;
};

/** Listet die in Buchhaltungsbutler verbundenen Konten. */
export async function fetchAccounts(): Promise<BBAccount[]> {
  const { data } = await bbPost<BBAccount>("/accounts/get", {});
  return data;
}

/**
 * Holt Transaktionen, paginiert in 500er-Schritten.
 * Mit `dateFrom`/`dateTo` (Format 'YYYY-MM-DD') und optional `account` (Kontonummer)
 * serverseitig eingegrenzt.
 */
export async function fetchTransactions(opts?: {
  dateFrom?: string;
  dateTo?: string;
  account?: number;
}): Promise<BBTransaction[]> {
  const all: BBTransaction[] = [];
  const limit = 500;
  let offset = 0;

  for (;;) {
    const { data } = await bbPost<BBTransaction>("/transactions/get", {
      limit,
      offset,
      ...(opts?.dateFrom ? { date_from: opts.dateFrom } : {}),
      ...(opts?.dateTo ? { date_to: opts.dateTo } : {}),
      ...(opts?.account != null ? { account: opts.account } : {}),
    });
    all.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }
  return all;
}

/** "-9.99" -> -999 (ganze Cent, Vorzeichen bleibt erhalten). */
export function bbAmountToCents(amount: string): number {
  const n = Number(String(amount).replace(/,/g, "")); // evtl. Tausendertrennzeichen entfernen
  if (!Number.isFinite(n)) throw new Error("Ungültiger Betrag: " + amount);
  return Math.round(n * 100);
}

/** "2026-06-18 02:00:00" -> "2026-06-18". */
export function bbDateOnly(dateTime: string): string {
  return dateTime.slice(0, 10);
}
