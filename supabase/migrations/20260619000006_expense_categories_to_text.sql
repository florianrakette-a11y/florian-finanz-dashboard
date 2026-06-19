-- Kategorien auf freien Text umstellen, damit eigene Kategorien möglich sind.
-- Bestehende Werte (Miete, tanken, …) bleiben als Text erhalten.
alter table fixed_expenses alter column category type text;
alter table variable_expenses alter column category type text;
