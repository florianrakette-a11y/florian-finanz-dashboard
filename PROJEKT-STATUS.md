# Florian Finanz-Dashboard — Projektstatus & Handover

> Stand: 2026-06-20. Diese Datei ist der vollständige Wiedereinstiegspunkt für eine neue Claude-Code-Session. Bitte zuerst lesen.

## 1. Was ist das?
Privates Finanz-Dashboard für **eine Person** (Florian Rakette / Raket One, Label Clubkatzen, Beratung Knorke). Übersicht über fixe & variable Ausgaben, offene Rechnungen, Einnahmen; automatischer Abgleich gegen Bankbewegungen (über Buchhaltungsbutler); später teilautomatische Erfassung neuer Rechnungen aus Foto/E-Mail. Kein Multi-User. Wird später von „Manus" auf einer **spinnrat.de-Subdomain** gehostet.
Vollständiger Original-Auftrag: `/Users/florianrakette/Downloads/claude-code-auftrag-finanzdashboard_1.md`.

## 2. Tech-Stack & wichtige Eigenheiten
- **Next.js 16.2.9** (App Router, TypeScript), **Tailwind v4**, **Supabase** (Postgres, Auth, Storage).
- ⚠️ **Next 16-Besonderheit:** „middleware" heißt jetzt **`proxy`** → Datei `src/proxy.ts` (+ Helfer `src/lib/supabase/proxy.ts`). Die Datei `AGENTS.md` im Projekt mahnt: **vor Code-Änderungen die mitgelieferte Doku in `node_modules/next/dist/docs/` lesen** (APIs weichen teils von Trainingswissen ab). `params`/`searchParams` sind **Promises** (`await`).
- **Sprache:** Florian ist nicht-technisch → alles auf Deutsch erklären, keine Fachbegriffe ohne Erläuterung.
- **Geld:** immer in ganzen **Cent** (bigint) speichern; Formatierung/Parsing in `src/lib/format.ts` (de-DE).

## 3. App starten / nutzen
```bash
cd /Users/florianrakette/ClaudeCode/florian-finanz-dashboard
npm run dev        # läuft auf http://localhost:3000
```
- Der Dev-Server stirbt manchmal zwischen Sessions → bei Bedarf neu starten.
- **Login:** E-Mail `florianrakette@gmail.com` (Passwort hat Florian gesetzt; Nutzer existiert in Supabase Auth, bestätigt). Ohne Login leitet alles auf `/login` um.
- iPhone-Test (für PWA später): über die Netzwerk-IP des Macs im selben WLAN (`npm run dev` zeigt die „Network"-URL).
- **Prüf-Routine nach Änderungen:** `npx tsc --noEmit` + `npx eslint .` + `npm run build`. Vor `build` ggf. `pkill -f "next dev"`.

## 4. Supabase
- **Projekt-Ref:** `gnzvwnvvjzuyicjofgxe` (Region EU/Frankfurt, Free-Tier).
- **Neue Schlüssel-Konvention:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (kein „anon").
- **MCP verbunden** (Server „supabase" in `.mcp.json`): DB-Arbeiten laufen direkt per MCP-Tools (`apply_migration`, `execute_sql`, `list_tables`, `get_advisors`, `generate_typescript_types`). Florian muss kein SQL anfassen.
- **Migrationen** zusätzlich versioniert in `supabase/migrations/` (0001 Schema, 0002 search_path-Härtung, 0003 bb_account, 0004 start_date, 0005 income_source→text, 0006 categories→text, 0007 receipt_date, 0008 description).
- **RLS** auf allen Tabellen aktiv, Policy `to authenticated using(true) with check(true)` (Ein-Nutzer-App — bewusst so; der „RLS always true"-Lint-Hinweis ist hier ok).
- TS-Typen: `src/lib/supabase/database.types.ts` (bei Schemaänderung pflegen/neu generieren).

## 5. Secrets (`.env.local`, NICHT im git; `.gitignore` hat `.env*` + `!.env.example`)
- ✅ Supabase URL + publishable key
- ✅ Buchhaltungsbutler: `BB_API_CLIENT`, `BB_API_SECRET`, `BB_API_KEY` (funktionieren)
- ✅ IMAP Strato (Phase 7, noch ungenutzt): `info@raketone.com` + `florian@spinnrat.de`, Host `imap.strato.de:993`, beide gleiches Passwort
- ❌ **Fehlt noch:** `ANTHROPIC_API_KEY` (für Foto-Erkennung), `SUPABASE_SECRET_KEY`, Google OAuth (Gmail/Drive)

## 6. Datenmodell (aktueller Stand)
- **fixed_expenses**: name, amount_cents, `category` (TEXT), due_day_of_month, frequency (enum monthly/quarterly/biannual/yearly), `start_date` (Anker für Rhythmus), end_date?, active, created/updated_at. (next_due_date existiert, ungenutzt.)
- **variable_expenses**: date, amount_cents, `category` (TEXT), description?, source (manual/bank_match), bank_transaction_id?, receipt_file_id?, created_at.
- **open_invoices**: recipient, iban?, purpose? (Bank-Verwendungszweck), `description?` (eigene Notiz), amount_cents, due_date?, status (open/paid/reminded), source (email/photo/manual), receipt_file_id?, email_message_id?, created/updated_at.
- **income_entries**: `source` (TEXT, frei), month (date=Monatserster), amount_cents, status (expected/received), `receipt_date?` (Eingang), created_at.
- **bank_transactions** (Spiegel aus BB): bb_transaction_id (unique), date, amount_cents (negativ=Abgang), counterpart, purpose, `bb_account` (Kontist/PayPal), matched_fixed_expense_id?, matched_variable_expense_id?, match_status (unmatched/matched/ignored), raw_payload (jsonb), synced_at.
- **receipt_files** & **email_scan_log**: angelegt, aber **noch ungenutzt** (für Phase 4/6/7).
- Hinweis: `category` (fix+variabel) und `income_entries.source` wurden von Enum auf **freien Text** umgestellt, damit eigene Werte möglich sind.

## 7. Was ist gebaut (mit Dateipfaden)
Alle Seiten liegen unter `src/app/(app)/` (Route-Group mit gemeinsamem Layout + Login-Schutz). Navigation: `src/components/nav.tsx`.

- **Übersicht / Dashboard** (`/`, `page.tsx`): Monatsnavigation; Soll (Einnahmen − fixe − variable) vs. Ist (Bank-Saldo des Monats); 4 KPI-Kacheln (anklickbar); „Ausgaben nach Kategorie" (fix fällig + variabel, mit Balken); „Anstehende Fälligkeiten".
- **Fixe Ausgaben** (`fixe-ausgaben/`): Monatsansicht „fällig in {Monat}" via `isFixedDueInMonth` (`src/lib/fixed-expenses.ts`, Rhythmus aus `start_date`+frequency); nicht-monatliche mit ⚠️ + Turnus-Badge; ausklappbare Gesamtliste; Anlegen/Bearbeiten (`[id]/page.tsx`)/Löschen/Aktiv-Schalter; Kategorie inline änderbar. 29 reale Posten geladen (Summe 2.994,79 €). **Wichtig:** Summe zeigt echte Beträge, KEINE Monats-Hochrechnung (so vom User gewünscht).
- **Variable Ausgaben** (`variable-ausgaben/`): Monatsnav, CRUD, Kategorie inline.
- **Offene Rechnungen** (`offene-rechnungen/`): Monatsnav (nach Fälligkeit) + undatierte immer sichtbar; „Offen gesamt"; CRUD (anlegen/bezahlt/löschen) + Beschreibung inline; **Erkennung fehlgeschlagener Abbuchungen** (`src/lib/failed-debits.ts` — Abbuchung+Rückbuchung-Paare) als bestätigbare Vorschläge. 4 reale Rechnungen geladen.
- **Einnahmen** (`einnahmen/`): Monatsnav, CRUD, **eigene Quellen** (Freitext-Dropdown + „Neue Quelle"), **Eingangsdatum** (inline, „offen" wenn leer), Status erwartet/erhalten. Juni geladen (4.570 € erhalten + 1.130,50 € erwartet; iGroove=1., YouTube=23.).
- **Bankbewegungen** (`bankbewegungen/`): Monatsnav, **Volltextsuche** über alle Monate (Gegenseite/Zweck/Betrag), **Kontist/PayPal-Tag + Filter**, Monats-Saldo, **Mehrfachauswahl (Checkboxen) → Sammelaktionen** „Zu variablen/fixen Ausgaben / Einnahmen" (`bulk-actions.ts`), markiert übernommene als „erfasst". Sync holt pro Monat nur den gewählten Monat. 727 Buchungen Jan–Jun synchronisiert.
- **Belege** (`belege/`): nur Platzhalter (Phase 4, s. u.).

**Gemeinsame Bausteine** (`src/components/`, `src/lib/`):
- `lib/month.ts` (Monatslogik), `lib/categories.ts` (synchronisierte Kategorien fix+variabel + `CATEGORY_LABELS`), `lib/auth.ts` (`requireUser` — in jeder Server Action), `lib/format.ts` (Geld), `lib/buchhaltungsbutler.ts`, `lib/failed-debits.ts`, `lib/fixed-expenses.ts`.
- `components/`: `month-nav.tsx`, `delete-button.tsx`, `category-cell.tsx` (Inline-Kategorie), `category-field.tsx` (Formular-Kategorie), `date-cell.tsx`, `text-cell.tsx`, `nav.tsx`.

## 8. Konventionen / Muster
- **Server Actions** (`actions.ts` je Bereich, `"use server"`): immer mit `requireUser()` (Auth-Prüfung), `revalidatePath(...)` nach Mutation. Formulare nutzen `useActionState`; Lösch/Status/Inline-Updates über kleine `<form action=...>` oder gebundene Actions (`.bind(null, id)`).
- **Inline-Bearbeiten** in Listen über die `*-cell.tsx`-Komponenten (Klick → Eingabe → speichert + `router.refresh()`).
- **Monatsnavigation** überall über `<MonthNav basePath=… month={month} />`; Monat steckt im Query-Param `?month=YYYY-MM`, Default = aktueller Monat.
- **Kategorien** sind synchronisiert (eine Quelle für fix+variabel); neue Kategorie/Quelle per „+ Neue …"-Option oder Inline.

## 9. Buchhaltungsbutler-API (hart erarbeitet — wichtig!)
- Host **`https://webapp.buchhaltungsbutler.de/api/v1`** (NICHT `app.` — Irrweg). Auth: HTTP **Basic** (Client:Secret) im Header **+ `api_key` im JSON-Body**, **POST-only**.
- Spec: `https://app.buchhaltungsbutler.de/docs/api/v1.de.json` (v1.9.1).
- `/accounts/get` listet Konten; `/transactions/get` (Body: api_key, date_from, date_to, account, limit, offset) → `{success,message,rows,data}`. Transaktion: `id_by_customer` (Zahl, global eindeutig), `to_from`, `amount` (String, engl. Format, negativ=Abgang), `booking_date`, `purpose`.
- Der BB-Account ist der **Geschäfts-Account „geile-teile-shop"** mit 40 Konten. Sync ruft **Kontist** (Name enthält „Kontist") + **PayPal** (Name === „PayPal") getrennt ab und taggt `bb_account`.
- ⚠️ STOLPERSTEIN gelöst: 401 trotz korrekter Werte → Secret in BB **neu generieren** half (angezeigtes Secret war inaktiv).

## 10. NÄCHSTER SCHRITT (entschieden): Foto-/Belegfunktion
- **Als PWA** umsetzen (nicht iMessage/WhatsApp/native App — gemeinsam so entschieden): Manifest + „Zum Home-Bildschirm hinzufügen"; Seite `belege/` mit `<input type="file" accept="image/*" capture="environment">` → öffnet iPhone-Kamera → Bild zu Supabase Storage → **Claude Vision** liest Empfänger/IBAN/Betrag/Verwendungszweck/Fälligkeit → **Bestätigungsschritt** → als offene Rechnung speichern (+ `receipt_files`).
- **Benötigt:** `ANTHROPIC_API_KEY` in `.env.local` (Florian holt ihn noch). Claude-Modell: aktuelles (z. B. `claude-opus-4-8` o. günstigeres für Vision).
- Tabelle `receipt_files` ist dafür schon da; `open_invoices.receipt_file_id` verknüpft.

## 11. Sonst noch offen (Auftrag-Phasen 6–9 etc.)
- Gmail-Scan (Phase 6) + IMAP-Scan Strato (Phase 7): Klassifikationsvorschläge → `email_scan_log`. IMAP **nur lesend** (FETCH/SELECT). Google-OAuth-Status (Testing→Production) live prüfen (7-Tage-Token-Problem).
- Google Drive (Phase 8): Manus-Rechnungsordner → erwartete Einnahmen.
- Beleg-Rückübertragung an BB (Phase 9, `/receipts`-Endpunkte).
- Voll-Edit für offene Rechnungen/variable Ausgaben/Einnahmen (aktuell nur fixe Ausgaben voll editierbar; sonst nur Inline-Felder).
- Echter Bank↔fixe-Ausgabe-Abgleichsvorschlag (Rest Phase 5).
- Januar-Bankbewegungen ggf. neu syncen (Konto-Tag fehlt evtl. noch).

## 12. Git
Sauber, alles committet, läuft (`tsc`/`eslint`/`build` grün). Branch: lokal, kein Remote. Letzter Commit: Refactor (gemeinsame Helfer). Keine Secrets im Repo (nur `.env.example`).
