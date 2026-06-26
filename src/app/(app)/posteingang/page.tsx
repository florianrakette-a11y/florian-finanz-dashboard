import { requireUser } from "@/lib/auth";
import { InboxItem, type InboxImport } from "./inbox-item";

export default async function PosteingangPage() {
  const supabase = await requireUser();
  const { data } = await supabase
    .from("email_imports")
    .select("id, mailbox, sender, subject, received_at, amount_cents")
    .eq("status", "pending")
    .order("received_at", { ascending: false });

  const items = (data ?? []) as InboxImport[];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Posteingang</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Aus E-Mails erkannte Belege (1× täglich automatisch geprüft). Bestätige oder verwirf sie.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          Keine offenen Belege. Neue E-Mail-Belege erscheinen hier automatisch.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((imp) => (
            <InboxItem key={imp.id} imp={imp} />
          ))}
        </div>
      )}
    </div>
  );
}
