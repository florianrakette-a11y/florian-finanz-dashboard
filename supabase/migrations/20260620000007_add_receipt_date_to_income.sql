-- Optionales Eingangsdatum (wann die Einnahme auf dem Konto eingeht / erwartet wird).
-- Leer = noch offen/unbekannt.
alter table income_entries add column receipt_date date;
