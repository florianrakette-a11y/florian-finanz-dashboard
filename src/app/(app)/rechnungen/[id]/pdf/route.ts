import { createClient } from "@/lib/supabase/server";
import { loadInvoicePdfData } from "@/lib/pdf/load-invoice";
import { generateInvoicePdf } from "@/lib/pdf/invoice-pdf";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const invoiceId = Number(id);
  if (!Number.isFinite(invoiceId)) {
    return new Response("Ungültige ID", { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Nicht angemeldet.", { status: 401 });

  const loaded = await loadInvoicePdfData(supabase, invoiceId);
  if (!loaded) return new Response("Rechnung nicht gefunden", { status: 404 });

  const pdf = await generateInvoicePdf(loaded.data, loaded.settings);
  const download = new URL(request.url).searchParams.get("download") === "1";
  const disposition = download ? "attachment" : "inline";
  const filename = `${loaded.invoiceNumber.replace(/[^\w.-]+/g, "_")}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
