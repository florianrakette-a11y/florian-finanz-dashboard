-- Startdatum (erste Zahlung) als Anker für den Turnus-Rhythmus.
alter table fixed_expenses add column start_date date;

-- Backfill bestehender (monatlicher) Posten: Anker in der Vergangenheit,
-- Tag aus due_day_of_month, damit sie ab sofort jeden Monat als fällig gelten.
update fixed_expenses
set start_date = ('2025-01-' || lpad(due_day_of_month::text, 2, '0'))::date
where start_date is null;
