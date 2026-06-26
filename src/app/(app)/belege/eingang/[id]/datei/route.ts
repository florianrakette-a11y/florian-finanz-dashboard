import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Nicht angemeldet.", { status: 401 });

  const { data: inv } = await supabase
    .from("open_invoices")
    .select("receipt_file_id, receipt_files(storage_path)")
    .eq("id", id)
    .maybeSingle();

  const path = inv?.receipt_files?.storage_path;
  if (!path) return new Response("Keine Datei vorhanden.", { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const { data, error } = await supabase.storage
    .from("belege")
    .createSignedUrl(path, 60, download ? { download: true } : undefined);
  if (error || !data) return new Response("Datei nicht abrufbar.", { status: 404 });

  return Response.redirect(data.signedUrl, 302);
}
