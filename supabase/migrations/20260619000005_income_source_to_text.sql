-- Einnahmequelle von festem Enum auf freien Text umstellen,
-- damit beliebige neue Quellen angelegt werden können.
-- Bestehende Werte (youtube, igroove, …) bleiben als Text erhalten.
alter table income_entries alter column source type text;
