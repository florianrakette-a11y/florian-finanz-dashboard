-- Sicherheits-Härtung: festen search_path für die Trigger-Funktion setzen.
-- Empfehlung des Supabase-Security-Linters (lint 0011_function_search_path_mutable).
alter function public.set_updated_at() set search_path = '';
