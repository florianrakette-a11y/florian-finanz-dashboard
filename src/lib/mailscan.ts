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

function looksLikeReceipt(mail: ParsedMail): boolean {
  const subject = mail.subject || "";
  const from = mail.from?.text || "";
  return RECEIPT_RX.test(subject) || RECEIPT_RX.test(from);
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

type ScanResult = { mailbox: string; found: number; skipped: number; error?: string };

/** Scannt ein Postfach (INBOX) der letzten `sinceDays` Tage und legt Belege als 'pending' an. */
async function scanMailbox(box: Mailbox, sinceDays: number): Promise<ScanResult> {
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
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - sinceDays * 86400_000);
      const uids = await client.search({ since }, { uid: true });
      for (const uid of uids || []) {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg || !msg.source) continue;
        const mail = await simpleParser(msg.source);

        const pdfs = pdfAttachments(mail);
        const isReceipt = pdfs.length > 0 || looksLikeReceipt(mail);
        if (!isReceipt) continue;

        const baseId = mail.messageId || `uid-${uid}-${box.name}`;
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
          // Schon vorhanden? (dedup über mailbox+message_id)
          const { data: existing } = await supabase
            .from("email_imports")
            .select("id")
            .eq("mailbox", box.name)
            .eq("message_id", it.dedupId)
            .maybeSingle();
          if (existing) {
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
          if (!insErr) found++;
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return { mailbox: box.name, found, skipped };
}

/** Scannt alle konfigurierten Postfächer. Fehler je Postfach werden gesammelt, nicht geworfen. */
export async function scanAllMailboxes(sinceDays = 2): Promise<ScanResult[]> {
  const results: ScanResult[] = [];
  for (const box of configuredMailboxes()) {
    try {
      results.push(await scanMailbox(box, sinceDays));
    } catch (e) {
      results.push({ mailbox: box.name, found: 0, skipped: 0, error: e instanceof Error ? e.message : "unbekannt" });
    }
  }
  return results;
}
