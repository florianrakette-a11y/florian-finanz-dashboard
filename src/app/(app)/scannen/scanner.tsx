"use client";

import { useActionState, useState } from "react";
import { extractReceipt } from "./extract-action";
import { saveScan, type ScanState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";
const labelClass = "text-sm font-medium text-neutral-700";

// Foto auf max. 1568px lange Kante verkleinern → JPEG (klein genug fürs PDF/OCR).
async function toDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1568 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function Scanner() {
  const [images, setImages] = useState<string[]>([]);
  const [pdfs, setPdfs] = useState<{ name: string; url: string }[]>([]);
  const [kind, setKind] = useState<"paid" | "open">("paid");
  const [f, setF] = useState({ counterparty: "", amount: "", date: "", category: "tanken", purpose: "", vat: "19" });
  const [reading, setReading] = useState(false);
  const [readErr, setReadErr] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<ScanState, FormData>(saveScan, {});

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const imgs = files.filter((file) => !isPdf(file));
    const pdfFiles = files.filter(isPdf);
    const urls = await Promise.all(imgs.map(toDataUrl));
    const pdfUrls = await Promise.all(pdfFiles.map(readAsDataUrl));
    setImages((prev) => [...prev, ...urls]);
    setPdfs((prev) => [...prev, ...pdfUrls.map((url, i) => ({ name: pdfFiles[i].name, url }))]);
    e.target.value = "";
  }

  async function readWithClaude() {
    const source = images[0] ?? pdfs[0]?.url;
    if (!source) return;
    setReading(true);
    setReadErr(null);
    const res = await extractReceipt(source);
    setReading(false);
    if (res.error || !res.data) {
      setReadErr(res.error ?? "Konnte nicht ausgelesen werden.");
      return;
    }
    setF((prev) => ({
      ...prev,
      counterparty: res.data!.recipient || prev.counterparty,
      amount: res.data!.amount || prev.amount,
      date: res.data!.due_date || prev.date,
      purpose: res.data!.purpose || prev.purpose,
    }));
  }

  if (state.ok) {
    return (
      <div className="space-y-4 rounded-2xl border border-green-200 bg-green-50 p-6">
        <p className="font-medium text-green-800">Beleg gespeichert ✓</p>
        <p className="text-sm text-green-700">{state.info}</p>
        <a href="/scannen" className="inline-block rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
          Nächsten Beleg scannen
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="images" value={JSON.stringify(images)} />
      <input type="hidden" name="pdfs" value={JSON.stringify(pdfs.map((p) => p.url))} />
      <input type="hidden" name="kind" value={kind} />

      {/* Aufnahme */}
      <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-6">
        <label className={labelClass}>
          Beleg fotografieren, Foto wählen oder PDF hochladen (z. B. Adobe Scan). Mehrere Fotos → ein PDF.
        </label>
        <input type="file" accept="image/*,application/pdf" multiple onChange={onPick}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white" />
        {(images.length > 0 || pdfs.length > 0) && (
          <>
            <div className="flex flex-wrap gap-2">
              {images.map((src, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Seite ${i + 1}`} className="h-24 w-20 rounded border border-neutral-200 object-cover" />
                  <button type="button" onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute -right-2 -top-2 rounded-full bg-white px-1 text-xs text-red-600 shadow">✕</button>
                </div>
              ))}
              {pdfs.map((p, i) => (
                <div key={`pdf-${i}`} className="relative flex h-24 w-20 flex-col items-center justify-center gap-1 rounded border border-neutral-200 bg-neutral-50 p-1 text-center">
                  <span className="text-lg">📄</span>
                  <span className="w-full truncate text-[10px] text-neutral-500">{p.name}</span>
                  <button type="button" onClick={() => setPdfs((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -right-2 -top-2 rounded-full bg-white px-1 text-xs text-red-600 shadow">✕</button>
                </div>
              ))}
            </div>
            <div>
              <button type="button" onClick={readWithClaude} disabled={reading}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50">
                {reading ? "Lese aus…" : "Mit Claude auslesen"}
              </button>
              {readErr && <p className="mt-1 text-sm text-red-600">{readErr}</p>}
            </div>
          </>
        )}
      </div>

      {/* Art */}
      <div className="flex gap-3">
        <button type="button" onClick={() => setKind("paid")}
          className={`rounded-full border px-4 py-1.5 text-sm ${kind === "paid" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-600"}`}>
          Bereits bezahlt (Ausgabe)
        </button>
        <button type="button" onClick={() => setKind("open")}
          className={`rounded-full border px-4 py-1.5 text-sm ${kind === "open" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-600"}`}>
          Offene Rechnung
        </button>
      </div>

      {/* Felder */}
      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-neutral-200 bg-white p-6 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label className={labelClass}>Lieferant / Empfänger</label>
          <input name="counterparty" value={f.counterparty} onChange={(e) => setF({ ...f, counterparty: e.target.value })} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Betrag (€, brutto)</label>
          <input name="amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="58,90" className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>{kind === "open" ? "Fällig am" : "Belegdatum"}</label>
          <input name="date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>USt.-Satz (für Buchhaltungsbutler)</label>
          <select name="vat_rate" value={f.vat} onChange={(e) => setF({ ...f, vat: e.target.value })} className={inputClass}>
            <option value="19">19 %</option><option value="7">7 %</option><option value="0">0 %</option><option value="">unklar / mehrere</option>
          </select>
        </div>
        {kind === "paid" ? (
          <div className="space-y-1">
            <label className={labelClass}>Kategorie</label>
            <input name="category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="z. B. tanken" className={inputClass} />
          </div>
        ) : (
          <div className="space-y-1">
            <label className={labelClass}>Verwendungszweck</label>
            <input name="purpose" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} className={inputClass} />
          </div>
        )}
      </div>

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <button type="submit" disabled={pending || (images.length === 0 && pdfs.length === 0)}
        className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
        {pending ? "Speichere & sende an Buchhaltungsbutler…" : "Speichern & an Buchhaltungsbutler"}
      </button>
    </form>
  );
}
