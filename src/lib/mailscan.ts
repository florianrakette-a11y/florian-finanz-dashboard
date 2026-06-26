import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail, type Attachment } from "mailparser";
import PDFDocument from "pdfkit";
import { createAdminClient } from "@/lib/supabase/admin";

export type Mailbox = { name: string; host: string; port: number; user: string; pass: string };

/** Postfächer aus ENV – nur die mit gesetztem Passwort werden gescannt. */
export function configuredMailboxes(): Mailbox[] {
  const boxes: Mailbox[] = [];
  if (process.env.IMAP_RAKETONE_USER && process.env.IMAP_RAKETONE_PASSWORD) {
    boxes.push({
      name: process.env.IMAP_RAKETONE_USER,
      host: process.env.IMAP_HOST || "imap.strato.de",
      port: Number(process.env.IMAP_PORT || 993),
      user: process.env.IMAP_RAKETONE_USER,
      pass: process.env.IMAP_RAKETONE_PASSWORD,
    });
  }
  if (process.env.IMAP_GMAIL_USER && process.env.IMAP_GMAIL_PASSWORD) {
    boxes.push({
      name: process.env.IMAP_GMAIL_USER,
      host: process.env.IMAP_GMAIL_HOST || "imap.gmail.com",
      port: Number(process.env.IMAP_GMAIL_PORT || 993),
      user: process.env.IMAP_GMAIL_USER,
      pass: process.env.IMAP_GMAIL_PASSWORD,
    });
  }
  return boxes;
}

// Betreff/Absender, die nach Rechnung/Beleg aussehen.
const RECEIPT_RX =
  /rechnung|invoice|receipt|beleg|quittung|zahlung|payment|order confirmation|bestellbest|kaufbeleg|kassenbon/i;

// Mahnungen / fehlgeschlagene Zahlungen / Zahlungserinnerungen → mit offenen Rechnungen abgleichen (kein Beleg).
const DUNNING_RX =
  /mahnung|zahlungserinnerung|erfolglose? zahlung|fehlgeschlagen|nicht erfolgreich|unsuccessful|payment failed|declined|did\s?n.?t go through|could\s?n.?t process|could not process|have\s?n.?t been able|was\s?n.?t able|overdue|past due|problem mit (?:ihrer|deiner|der|unserer)?\s*.{0,12}zahlung|problem with .{0,12}payment|rechnungsproblem|handeln erforderlich|action required|warten.{0,20}auf.{0,20}zahlung|letzte zahlung/i;

// Eindeutig kein Beleg und keine Mahnung → ganz verwerfen.
const JUNK_RX =
  /kandidaten|jobagent|stepstone|werkänderung|werbung|newsletter|returned mail|mailer-daemon|undelivered|gekündigt|forderungssache|reagieren/i;

function looksLikeReceipt(mail: ParsedMail): boolean {
  const subject = mail.subject || "";
  const from = mail.from?.text || "";
  return RECEIPT_RX.test(subject) || RECEIPT_RX.test(from);
}

// Mahnstufe aus Betreff+Text. Höherer rank = dringlicher.
function mahnLevel(text: string): { rank: number; label: string } {
  const t = text.toLowerCase();
  if (/letzte mahnung|final (notice|reminder|demand)/.test(t)) return { rank: 4, label: "Letzte Mahnung" };
  if (/3\.\s*mahnung|dritte mahnung|third reminder/.test(t)) return { rank: 3, label: "3. Mahnung" };
  if (/2\.\s*mahnung|zweite mahnung|second reminder/.test(t)) return { rank: 2, label: "2. Mahnung" };
  if (/1\.\s*mahnung|erste mahnung|first reminder/.test(t)) return { rank: 1, label: "1. Mahnung" };
  if (/\bmahnung\b/.test(t)) return { rank: 2, label: "Mahnung" };
  if (/fehlgeschlagen|unsuccessful|payment failed|erfolglose? zahlung|declined/.test(t))
    return { rank: 1, label: "Zahlung fehlgeschlagen" };
  if (/zahlungserinnerung|payment reminder|gentle reminder|warten.{0,20}auf.{0,20}zahlung/.test(t))
    return { rank: 0, label: "Zahlungserinnerung" };
  return { rank: 0, label: "Zahlungshinweis" };
}

const TOKEN_STOP = new Set([
  "gmbh", "team", "mail", "info", "service", "kundenservice", "rechnung", "rechnungen",
  "noreply", "order", "transactions", "statements", "payments", "billing", "group",
  "global", "limited", "company", "kundeninformation", "support", "kunden", "no-reply",
]);

// Tokens aus Absendername + Domain (zum Abgleich mit Empfängername der offenen Rechnung).
function senderTokens(name: string, address: string): string[] {
  const toks = new Set<string>();
  name.toLowerCase().split(/[^a-zäöüß0-9]+/).forEach((w) => {
    if (w.length >= 4 && !TOKEN_STOP.has(w)) toks.add(w);
  });
  const dom = (address.split("@")[1] || "").split(".");
  const sld = dom.length >= 2 ? dom[dom.length - 2] : "";
  if (sld.length >= 3 && !TOKEN_STOP.has(sld)) toks.add(sld);
  return [...toks];
}

type OpenInv = { id: string; recipient: string; amount_cents: number };

/** Findet die eine offene Rechnung, die zur Mahnung passt (Betrag und/oder Absender). null bei 0 oder mehreren. */
function matchOpenInvoice(open: OpenInv[], tokens: string[], amountCents: number | null): string | null {
  let best: { id: string; score: number } | null = null;
  let tie = false;
  for (const inv of open) {
    const rec = inv.recipient.toLowerCase();
    let score = 0;
    if (amountCents != null && inv.amount_cents === amountCents) score += 2;
    if (tokens.some((t) => rec.includes(t))) score += 1;
    if (score === 0) continue;
    if (!best || score > best.score) {
      best = { id: inv.id, score };
      tie = false;
    } else if (score === best.score) {
      tie = true;
    }
  }
  return best && !tie ? best.id : null;
}

function pdfAttachments(mail: ParsedMail): Attachment[] {
  return (mail.attachments || []).filter(
    (a) =>
      a.contentType === "application/pdf" ||
      (a.filename || "").toLowerCase().endsWith(".pdf"),
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&euro;/g, "€")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Rendert eine Mail (Kopf + Text) als schlichtes A4-PDF. Für Belege ohne PDF-Anhang. */
function emailToPdf(mail: ParsedMail): Promise<Buffer> {
  const body = mail.text?.trim() || (mail.html ? stripHtml(mail.html) : "") || "(kein Text)";
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(9).fillColor("#666");
      doc.text(`Von: ${mail.from?.text || "-"}`);
      doc.text(`An: ${mail.to ? (Array.isArray(mail.to) ? mail.to.map((t) => t.text).join(", ") : mail.to.text) : "-"}`);
      doc.text(`Datum: ${mail.date ? mail.date.toLocaleString("de-DE") : "-"}`);
      doc.moveDown(0.5);
      doc.fontSize(13).fillColor("#000").text(mail.subject || "(kein Betreff)");
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").stroke();
      doc.moveDown(0.8);
      doc.fontSize(10).fillColor("#222").text(body, { lineGap: 2 });
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

// Erster €-Betrag im Text → Cent (grobe Vorbelegung, vom Nutzer prüfbar).
function guessAmountCents(mail: ParsedMail): number | null {
  const text = `${mail.subject || ""}\n${mail.text || (mail.html ? stripHtml(mail.html) : "")}`;
  const m = text.match(/(?:€|EUR)\s*([0-9]{1,4}(?:[.,][0-9]{3})*[.,][0-9]{2})|([0-9]{1,4}(?:[.,][0-9]{3})*[.,][0-9]{2})\s*(?:€|EUR)/i);
  const raw = m?.[1] ?? m?.[2];
  if (!raw) return null;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const cents = Math.round(parseFloat(normalized) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

type ScanResult = { mailbox: string; found: number; skipped: number; dunningMatched?: number; error?: string };

// Läuft den BODYSTRUCTURE-Baum ab (ohne die Mail herunterzuladen) und sucht ein PDF.
type BodyNode = { type?: string; subtype?: string; parameters?: Record<string, string>; dispositionParameters?: Record<string, string>; childNodes?: BodyNode[] };
function structureHasPdf(node: BodyNode | undefined): boolean {
  if (!node) return false;
  const sub = (node.subtype || "").toLowerCase();
  const fname = (node.dispositionParameters?.filename || node.parameters?.name || "").toLowerCase();
  if (((node.type || "").toLowerCase() === "application" && sub === "pdf") || fname.endsWith(".pdf")) return true;
  return (node.childNodes || []).some(structureHasPdf);
}

function textLooksLikeReceipt(subject: string, from: string): boolean {
  return RECEIPT_RX.test(subject) || RECEIPT_RX.test(from);
}

/** Scannt ein Postfach (INBOX) ab `since` und legt Belege als 'pending' an. */
async function scanMailbox(box: Mailbox, since: Date): Promise<ScanResult> {
  const supabase = createAdminClient();
  const client = new ImapFlow({
    host: box.host,
    port: box.port,
    secure: true,
    auth: { user: box.user, pass: box.pass },
    logger: false,
  });

  let found = 0;
  let skipped = 0;
  let dunningMatched = 0;
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Bereits importierte Message-IDs dieses Postfachs (für Dedup vor dem Download).
      const { data: existingRows } = await supabase
        .from("email_imports")
        .select("message_id")
        .eq("mailbox", box.name);
      const seen = new Set((existingRows ?? []).map((r) => r.message_id));
      const alreadyDone = (baseId: string) => seen.has(baseId) || seen.has(`${baseId}#0`);

      // 1) Nur Kopfdaten + Anhang-Struktur holen (billig), Kandidaten bestimmen.
      const candidates: number[] = [];
      const dunningUids: number[] = [];
      for await (const m of client.fetch(
        { since },
        { uid: true, envelope: true, bodyStructure: true },
      )) {
        const subject = m.envelope?.subject || "";
        const from = (m.envelope?.from || []).map((a) => `${a.name ?? ""} ${a.address ?? ""}`).join(" ");
        const baseId = m.envelope?.messageId || `uid-${m.uid}-${box.name}`;
        if (alreadyDone(baseId)) {
          skipped++;
          continue;
        }
        if (JUNK_RX.test(subject)) continue;
        if (DUNNING_RX.test(subject) || DUNNING_RX.test(from)) {
          dunningUids.push(m.uid);
          continue;
        }
        const hasPdf = structureHasPdf(m.bodyStructure as BodyNode | undefined);
        if (hasPdf || textLooksLikeReceipt(subject, from)) candidates.push(m.uid);
      }

      // 2) Nur Kandidaten komplett herunterladen + verarbeiten.
      for (const uid of candidates) {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg || !msg.source) continue;
        const mail = await simpleParser(msg.source);

        const pdfs = pdfAttachments(mail);
        const isReceipt = pdfs.length > 0 || looksLikeReceipt(mail);
        if (!isReceipt) continue;

        const baseId = mail.messageId || `uid-${uid}-${box.name}`;
        if (alreadyDone(baseId)) {
          skipped++;
          continue;
        }
        const sender = mail.from?.text?.slice(0, 300) || null;
        const subject = mail.subject?.slice(0, 500) || null;
        const receivedAt = mail.date ? mail.date.toISOString() : null;
        const amount = guessAmountCents(mail);

        // Pro PDF-Anhang ein Beleg; ohne Anhang die ganze Mail als PDF.
        const items: { dedupId: string; buf: Buffer; label: string }[] = [];
        if (pdfs.length > 0) {
          pdfs.forEach((a, i) => {
            items.push({
              dedupId: pdfs.length > 1 ? `${baseId}#${i}` : baseId,
              buf: a.content,
              label: a.filename || `anhang-${i + 1}.pdf`,
            });
          });
        } else {
          items.push({ dedupId: baseId, buf: await emailToPdf(mail), label: "mail.pdf" });
        }

        for (const it of items) {
          if (seen.has(it.dedupId)) {
            skipped++;
            continue;
          }

          const safe = it.label.replace(/[^\w.-]+/g, "_");
          const path = `mail/${box.user.replace(/[^\w.-]+/g, "_")}/${uid}-${safe}`;
          const { error: upErr } = await supabase.storage
            .from("belege")
            .upload(path, it.buf, { contentType: "application/pdf", upsert: true });
          if (upErr) continue;

          const { error: insErr } = await supabase.from("email_imports").insert({
            mailbox: box.name,
            message_id: it.dedupId,
            sender,
            subject,
            received_at: receivedAt,
            storage_path: path,
            amount_cents: amount,
            status: "pending",
          });
          if (!insErr) {
            found++;
            seen.add(it.dedupId);
          }
        }
      }

      // 3) Mahnungen mit offenen Rechnungen abgleichen und Hinweis setzen.
      if (dunningUids.length > 0) {
        const { data: openInv } = await supabase
          .from("open_invoices")
          .select("id, recipient, amount_cents")
          .neq("status", "paid");
        const open = (openInv ?? []) as OpenInv[];

        if (open.length > 0) {
          // Pro offene Rechnung die dringlichste Mahnung sammeln.
          const best = new Map<string, { rank: number; text: string }>();
          for (const uid of dunningUids) {
            const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
            if (!msg || !msg.source) continue;
            const mail = await simpleParser(msg.source);
            const fromAddr = mail.from?.value?.[0];
            const tokens = senderTokens(fromAddr?.name || "", fromAddr?.address || "");
            const amount = guessAmountCents(mail);
            const id = matchOpenInvoice(open, tokens, amount);
            if (!id) continue;

            const body = mail.text || (mail.html ? stripHtml(mail.html) : "");
            const { rank, label } = mahnLevel(`${mail.subject || ""}\n${body}`);
            const d = mail.date;
            const date = d
              ? `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`
              : "";
            const text = date ? `${label} am ${date}` : label;
            const prev = best.get(id);
            if (!prev || rank >= prev.rank) best.set(id, { rank, text });
          }

          for (const [id, { text }] of best) {
            const { error } = await supabase
              .from("open_invoices")
              .update({ mahn_hinweis: text, status: "reminded" })
              .eq("id", id)
              .neq("status", "paid");
            if (!error) dunningMatched++;
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return { mailbox: box.name, found, skipped, dunningMatched };
}

/** Scannt alle konfigurierten Postfächer der letzten `sinceHours` Stunden. Fehler je Postfach gesammelt, nicht geworfen. */
export async function scanAllMailboxes(sinceHours = 36): Promise<ScanResult[]> {
  const since = new Date(Date.now() - sinceHours * 3600_000);
  const results: ScanResult[] = [];
  for (const box of configuredMailboxes()) {
    try {
      results.push(await scanMailbox(box, since));
    } catch (e) {
      results.push({ mailbox: box.name, found: 0, skipped: 0, error: e instanceof Error ? e.message : "unbekannt" });
    }
  }
  return results;
}
