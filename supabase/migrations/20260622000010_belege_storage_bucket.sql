-- Privater Storage-Bucket für Eingangsbeleg-Dateien (Fotos/PDFs).
-- Zugriff nur für eingeloggte Nutzer (Ein-Nutzer-App, gleiches RLS-Muster).
insert into storage.buckets (id, name, public)
values ('belege', 'belege', false)
on conflict (id) do nothing;

create policy "belege_authenticated_all"
  on storage.objects for all to authenticated
  using (bucket_id = 'belege')
  with check (bucket_id = 'belege');
