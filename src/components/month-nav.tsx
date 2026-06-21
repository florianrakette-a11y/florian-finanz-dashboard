import Link from "next/link";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/month";

const linkClass =
  "rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100";

/** Monats-Navigation (vor/zurück) für eine Seite. `basePath` z. B. "/einnahmen" oder "/". */
export function MonthNav({ basePath, month }: { basePath: string; month: string }) {
  const isCurrent = month === currentMonth();
  const href = (m: string) => `${basePath}?month=${m}`;

  return (
    <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3">
      <Link href={href(shiftMonth(month, -1))} className={linkClass}>
        ← {monthLabel(shiftMonth(month, -1))}
      </Link>
      <div className="text-center">
        <div className="text-base font-semibold text-neutral-900">{monthLabel(month)}</div>
        {!isCurrent && (
          <Link
            href={href(currentMonth())}
            className="text-xs text-neutral-500 hover:text-neutral-900"
          >
            → zum aktuellen Monat
          </Link>
        )}
      </div>
      <Link href={href(shiftMonth(month, 1))} className={linkClass}>
        {monthLabel(shiftMonth(month, 1))} →
      </Link>
    </div>
  );
}
