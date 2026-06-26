import { NextRequest, NextResponse } from "next/server";
import { scanAllMailboxes } from "@/lib/mailscan";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Wird 1x täglich vom Cron (Supabase pg_cron) aufgerufen.
 * Schutz: Header x-cron-secret muss CRON_SECRET entsprechen.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    // Standard: letzte 36 Stunden (täglicher Lauf). Manueller Nachlauf via ?hours=720 (z. B. ganzer Monat).
    const hoursParam = Number(req.nextUrl.searchParams.get("hours"));
    const hours = Number.isFinite(hoursParam) && hoursParam > 0 ? hoursParam : 36;
    const results = await scanAllMailboxes(hours);
    return NextResponse.json({ ok: true, hours, results });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unbekannt" },
      { status: 500 },
    );
  }
}
