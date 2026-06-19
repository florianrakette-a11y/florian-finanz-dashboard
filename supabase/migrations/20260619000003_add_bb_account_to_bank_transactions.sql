-- Herkunftskonto je Bankbewegung (z. B. "Kontist", "PayPal"), für Anzeige/Filter.
alter table bank_transactions add column bb_account text;
create index idx_bank_transactions_bb_account on bank_transactions(bb_account);
