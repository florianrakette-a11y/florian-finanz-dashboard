-- ===========================================================================
-- Florian Finanz Dashboard – Initiales Datenmodell
-- Ein Nutzer, kein Multi-Tenancy. RLS dennoch aktiv (Standardabsicherung).
-- Beträge immer als ganze Cent (bigint) speichern, nie als Fließkomma.
-- ===========================================================================

-- --- Enums -----------------------------------------------------------------

create type fixed_expense_category as enum (
  'Miete',
  'Internet & Telefon',
  'Software-Abos',
  'Steuern',
  'Darlehen',
  'Versicherung',
  'Weiterbildung',
  'Sonstiger Betriebsbedarf',
  'Reisekosten',
  'Leasingkosten'
);

create type expense_frequency as enum (
  'monthly',
  'quarterly',
  'biannual',
  'yearly'
);

-- Variable Kategorien: vorerst nur diese zwei, später erweiterbar.
create type variable_expense_category as enum (
  'tanken',
  'privat'
);

create type expense_source as enum (
  'manual',
  'bank_match'
);

create type invoice_status as enum (
  'open',
  'paid',
  'reminded'
);

create type invoice_source as enum (
  'email',
  'photo',
  'manual'
);

create type income_source as enum (
  'youtube',
  'igroove',
  'knorke',
  'elysium_or_other',
  'manus_invoice'
);

create type income_status as enum (
  'expected',
  'received'
);

create type bank_match_status as enum (
  'unmatched',
  'matched',
  'ignored'
);

create type mailbox as enum (
  'gmail_main',
  'raketone_imap',
  'spinnrat_imap'
);

create type email_classification as enum (
  'open_invoice',
  'paid_receipt',
  'reminder',
  'failed_debit',
  'irrelevant'
);

create type receipt_source as enum (
  'photo_upload',
  'email_attachment',
  'manual'
);

-- --- Trigger-Funktion für updated_at ---------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --- Tabellen ---------------------------------------------------------------

-- Belege zuerst, da andere Tabellen darauf verweisen.
create table receipt_files (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  source receipt_source not null,
  uploaded_at timestamptz not null default now(),
  ocr_extracted jsonb,
  pushed_to_buchhaltungsbutler boolean not null default false
);

create table fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount_cents bigint not null,
  category fixed_expense_category not null,
  due_day_of_month smallint not null check (due_day_of_month between 1 and 31),
  frequency expense_frequency not null default 'monthly',
  next_due_date date,
  end_date date,                       -- nullable: für befristete Posten (Kredite, Leasing)
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table bank_transactions (
  id uuid primary key default gen_random_uuid(),
  bb_transaction_id text unique not null,
  date date not null,
  amount_cents bigint not null,
  counterpart text,
  purpose text,
  matched_fixed_expense_id uuid references fixed_expenses(id) on delete set null,
  matched_variable_expense_id uuid,   -- FK wird nach variable_expenses ergänzt
  match_status bank_match_status not null default 'unmatched',
  raw_payload jsonb,
  synced_at timestamptz not null default now()
);

create table variable_expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  amount_cents bigint not null,
  category variable_expense_category not null,
  description text,
  source expense_source not null default 'manual',
  bank_transaction_id uuid references bank_transactions(id) on delete set null,
  receipt_file_id uuid references receipt_files(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Verknüpfung bank_transactions -> variable_expenses jetzt nachreichen.
alter table bank_transactions
  add constraint bank_transactions_matched_variable_expense_id_fkey
  foreign key (matched_variable_expense_id)
  references variable_expenses(id) on delete set null;

create table open_invoices (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  iban text,
  purpose text,
  amount_cents bigint not null,
  due_date date,
  status invoice_status not null default 'open',
  source invoice_source not null default 'manual',
  receipt_file_id uuid references receipt_files(id) on delete set null,
  email_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table income_entries (
  id uuid primary key default gen_random_uuid(),
  source income_source not null,
  month date not null,                 -- erster Tag des Monats als Konvention
  amount_cents bigint not null,
  status income_status not null default 'expected',
  created_at timestamptz not null default now()
);

create table email_scan_log (
  id uuid primary key default gen_random_uuid(),
  mailbox mailbox not null,
  message_id text not null,
  classification_suggested email_classification,
  confidence numeric(4,3),             -- 0.000 .. 1.000
  confirmed_by_user boolean not null default false,
  linked_open_invoice_id uuid references open_invoices(id) on delete set null,
  scanned_at timestamptz not null default now(),
  unique (mailbox, message_id)
);

-- --- Indizes für häufige Abfragen ------------------------------------------

create index idx_fixed_expenses_active on fixed_expenses(active);
create index idx_fixed_expenses_next_due on fixed_expenses(next_due_date);
create index idx_variable_expenses_date on variable_expenses(date);
create index idx_variable_expenses_category on variable_expenses(category);
create index idx_open_invoices_status on open_invoices(status);
create index idx_open_invoices_due_date on open_invoices(due_date);
create index idx_income_entries_month on income_entries(month);
create index idx_bank_transactions_date on bank_transactions(date);
create index idx_bank_transactions_match_status on bank_transactions(match_status);

-- --- updated_at Trigger ------------------------------------------------------

create trigger trg_fixed_expenses_updated_at
  before update on fixed_expenses
  for each row execute function set_updated_at();

create trigger trg_open_invoices_updated_at
  before update on open_invoices
  for each row execute function set_updated_at();

-- ===========================================================================
-- Row Level Security
-- Genau ein Nutzer. Jeder eingeloggte (authentifizierte) Nutzer darf alles,
-- anonyme Zugriffe werden komplett blockiert. RLS ist trotzdem aktiv, damit
-- ohne gültige Session gar nichts gelesen/geschrieben werden kann.
-- ===========================================================================

alter table receipt_files       enable row level security;
alter table fixed_expenses      enable row level security;
alter table bank_transactions   enable row level security;
alter table variable_expenses   enable row level security;
alter table open_invoices       enable row level security;
alter table income_entries      enable row level security;
alter table email_scan_log      enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'receipt_files', 'fixed_expenses', 'bank_transactions',
    'variable_expenses', 'open_invoices', 'income_entries', 'email_scan_log'
  ]
  loop
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t
    );
  end loop;
end;
$$;
