"use server";

import { requireUser } from "@/lib/auth";

export type Extracted = {
  recipient: string;
  iban: string;
  amount: string; // deutsches Format, z. B. "172,00"
  purpose: string;
  due_date: string; // "YYYY-MM-DD" oder ""
};

type Result = { data?: Extracted; error?: string };

const PROMPT = `Lies diese Rechnung/diesen Beleg aus. Antworte NUR mit JSON, keine Erklärung:
{"recipient": "", "iban": "", "amount_eur": 0, "purpose": "", "due_date": "YYYY-MM-DD oder leer"}
recipient = Empfänger/Zahlungsempfänger, amount_eur = zu zahlender Gesamtbetrag als Zahl, due_date = Fälligkeit. Unbekanntes leer lassen.`;

export async function extractReceipt(dataUrl: string): Promise<Result> {
  await requireUser();

  const m = /^data:(.+?);base64,(.+)$/.exec(dataUrl);
  if (!m) return { error: "Ungültige Datei." };
  const [, mediaType, base64] = m;

  // PDF (z. B. Adobe Scan) → document-Block; Bilder → image-Block. Beide ohne Beta-Header.
  const source = { type: "base64" as const, media_type: mediaType, data: base64 };
  const fileBlock =
    mediaType === "application/pdf"
      ? { type: "document", source: { ...source, media_type: "application/pdf" } }
      : { type: "image", source };

  let json;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", // ponytail: günstig für OCR; auf Opus heben, falls Erkennung patzt
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [fileBlock, { type: "text", text: PROMPT }],
          },
        ],
      }),
    });
    json = await res.json();
    if (!res.ok) return { error: `Claude-Fehler: ${json?.error?.message ?? res.status}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Anfrage fehlgeschlagen." };
  }

  const text: string = json?.content?.[0]?.text ?? "";
  const slice = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let parsed;
  try {
    parsed = JSON.parse(slice);
  } catch {
    return { error: "Antwort nicht lesbar. Bitte manuell erfassen." };
  }

  const eur = Number(String(parsed.amount_eur ?? "").replace(",", "."));
  return {
    data: {
      recipient: String(parsed.recipient ?? ""),
      iban: String(parsed.iban ?? ""),
      amount: Number.isFinite(eur) && eur > 0 ? eur.toFixed(2).replace(".", ",") : "",
      purpose: String(parsed.purpose ?? ""),
      due_date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.due_date) ? parsed.due_date : "",
    },
  };
}
