import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export interface InvoicePosition {
  description: string;
  details?: string;
  quantity: number;
  unit: string;
  unitPrice: number; // Cent
  vatRate?: number;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  customerNumber: string;
  date: string;
  serviceStartDate?: string;
  serviceEndDate?: string;
  recipientName: string;
  recipientStreet: string;
  recipientZipCity: string;
  positions: InvoicePosition[];
  vatRate: number;
  isReverseCharge: boolean;
  paymentTermDays: number;
}

export interface CompanySettings {
  companyName: string;
  street: string;
  zipCode: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  taxNumber: string;
  vatId: string;
  iban: string;
  bic: string;
  bankName: string;
  owner: string;
  firstName: string;
  lastName: string;
  logoUrl: string; // lokaler Pfad unter /public, z. B. "/invoice-logos/raketone.png"
  invoiceIntroText: string;
  invoiceFooterText: string;
}

/** Löst einen /public-Pfad in eine Datei auf, sonst null. */
function resolveLogoPath(logoUrl: string): string | null {
  if (!logoUrl || !logoUrl.startsWith("/")) return null;
  const p = path.join(process.cwd(), "public", logoUrl);
  return fs.existsSync(p) ? p : null;
}

export function generateInvoicePdf(data: InvoicePdfData, settings: CompanySettings): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Logo links oben
      const logoPath = resolveLogoPath(settings.logoUrl);
      if (logoPath) {
        try {
          doc.image(logoPath, 50, 40, { width: 130 });
        } catch {
          // Logo defekt -> ohne Logo weiter.
        }
      }

      // Rechts oben: "Rechnung" + Details
      const rightX = 320;
      const labelWidth = 120;
      const valueWidth = 105;
      let y = 50;

      doc.fontSize(20).font("Helvetica-Bold").text("Rechnung", rightX, y, { align: "right", width: labelWidth + valueWidth });
      y += 30;

      doc.fontSize(9).font("Helvetica");
      doc.text("Rechnungsnr.:", rightX, y, { align: "left", width: labelWidth });
      doc.text(data.invoiceNumber, rightX + labelWidth, y, { align: "right", width: valueWidth });
      y += 14;
      doc.text("Kundennr.:", rightX, y, { align: "left", width: labelWidth });
      doc.text(data.customerNumber, rightX + labelWidth, y, { align: "right", width: valueWidth });
      y += 14;
      doc.text("Datum:", rightX, y, { align: "left", width: labelWidth });
      doc.text(data.date, rightX + labelWidth, y, { align: "right", width: valueWidth });
      y += 14;
      if (data.serviceStartDate && data.serviceEndDate) {
        doc.text("Leistungszeitraum:", rightX, y, { align: "left", width: labelWidth });
        const lzText = `${data.serviceStartDate.trim()} – ${data.serviceEndDate.trim()}`;
        doc.text(lzText, rightX + labelWidth, y, { align: "right", width: valueWidth, lineBreak: false });
        y += 18;
      } else {
        y += 18;
      }

      // Links: Empfängeradresse
      const addrY = 170;
      doc.fontSize(10).font("Helvetica");
      doc.text(data.recipientName, 50, addrY, { width: 280 });
      doc.text(data.recipientStreet, 50, addrY + 14, { width: 280 });
      doc.text(data.recipientZipCity, 50, addrY + 28, { width: 280 });

      // Rechts: Firmendaten
      let firmY = addrY;
      doc.fontSize(9).font("Helvetica");
      doc.text(settings.companyName, rightX, firmY, { align: "right", width: labelWidth + valueWidth });
      firmY += 12;
      const ownerFullName = [settings.firstName, settings.lastName].filter(Boolean).join(" ");
      if (ownerFullName) {
        doc.text(ownerFullName, rightX, firmY, { align: "right", width: labelWidth + valueWidth });
        firmY += 12;
      }
      doc.text(settings.street, rightX, firmY, { align: "right", width: labelWidth + valueWidth });
      firmY += 12;
      doc.text(`${settings.zipCode} ${settings.city}`, rightX, firmY, { align: "right", width: labelWidth + valueWidth });
      firmY += 12;
      doc.text(`Tel.: ${settings.phone}`, rightX, firmY, { align: "right", width: labelWidth + valueWidth });
      firmY += 12;
      doc.text(settings.email, rightX, firmY, { align: "right", width: labelWidth + valueWidth });

      // Einleitungstext
      y = 280;
      doc.fontSize(10).font("Helvetica");
      doc.text(settings.invoiceIntroText, 50, y, { width: 500 });
      y += 30;

      // Tabelle
      const col1X = 50, col2X = 80, col3X = 335, col4X = 378, col5X = 428, col6X = 488;
      const tableWidth = 545 - 50;
      const pageHeight = 842;
      const marginBottom = 120;
      const headerHeight = 20;

      const drawTableHeader = (headerY: number) => {
        doc.rect(col1X, headerY, tableWidth, headerHeight).fillAndStroke("#e0e0e0", "#000000");
        doc.fillColor("#000000").fontSize(9).font("Helvetica-Bold");
        doc.text("Pos.", col1X + 5, headerY + 6, { width: 25 });
        doc.text("Bezeichnung", col2X + 5, headerY + 6, { width: 250 });
        doc.text("Menge", col3X + 5, headerY + 6, { width: 40, align: "right" });
        doc.text("Einheit", col4X + 5, headerY + 6, { width: 45, align: "center" });
        doc.text("Einzel", col5X + 5, headerY + 6, { width: 55, align: "right" });
        doc.text("Gesamt", col6X + 5, headerY + 6, { width: 45, align: "right" });
      };

      drawTableHeader(y);
      y += headerHeight;

      data.positions.forEach((pos, index) => {
        const titleHeight = doc.font("Helvetica-Bold").fontSize(9).heightOfString(pos.description, { width: 250 });
        const detailsHeight = pos.details
          ? doc.font("Helvetica-Oblique").fontSize(9).heightOfString(pos.details, { width: 250 })
          : 0;
        const textHeight = titleHeight + (pos.details ? detailsHeight + 2 : 0);
        const rowHeight = Math.max(20, textHeight + 10);

        if (y + rowHeight > pageHeight - marginBottom) {
          doc.addPage();
          y = 50;
          drawTableHeader(y);
          y += headerHeight;
        }

        const startY = y;
        doc.font("Helvetica").fontSize(9).text(`${index + 1}`, col1X + 5, startY + 5, { width: 25 });
        doc.font("Helvetica-Bold").fontSize(9).text(pos.description, col2X + 5, startY + 5, { width: 250, lineBreak: true });
        if (pos.details) {
          const afterTitleY = startY + 5 + titleHeight;
          doc.font("Helvetica-Oblique").fontSize(9).text(pos.details, col2X + 5, afterTitleY, { width: 250, lineBreak: true });
        }
        doc.font("Helvetica").fontSize(9);
        doc.text(pos.quantity.toString(), col3X + 5, startY + 5, { width: 38, align: "right" });
        doc.text(pos.unit, col4X + 5, startY + 5, { width: 44, align: "center" });
        doc.text((pos.unitPrice / 100).toFixed(2).replace(".", ",") + " €", col5X + 2, startY + 5, { width: 58, align: "right" });
        doc.text((pos.quantity * pos.unitPrice / 100).toFixed(2).replace(".", ",") + " €", col6X + 2, startY + 5, { width: 52, align: "right" });
        doc.rect(col1X, startY, tableWidth, rowHeight).stroke();
        y += rowHeight;
      });

      // Summen
      y += 10;
      if (y + 160 > pageHeight - 50) {
        doc.addPage();
        y = 50;
      }
      const subtotal = data.positions.reduce((sum, pos) => sum + pos.quantity * pos.unitPrice, 0);
      const vatByRate: Record<number, number> = {};
      data.positions.forEach((pos) => {
        const posTotal = pos.quantity * pos.unitPrice;
        const posVatRate = data.isReverseCharge ? 0 : (pos.vatRate ?? data.vatRate);
        vatByRate[posVatRate] = (vatByRate[posVatRate] || 0) + Math.round((posTotal * posVatRate) / 100);
      });
      const vatAmount = Object.values(vatByRate).reduce((s, v) => s + v, 0);
      const total = subtotal + vatAmount;

      const sumLabelX = 380, sumValueX = 480, sumValueWidth = 60;
      doc.fontSize(10).font("Helvetica");
      doc.text("Zwischensumme", sumLabelX, y, { width: 95 });
      doc.text((subtotal / 100).toFixed(2).replace(".", ",") + " €", sumValueX, y, { width: sumValueWidth, align: "right" });
      y += 13;

      if (data.isReverseCharge) {
        doc.text("Reverse Charge – Übergang der Steuerschuld auf den Leistungsempfänger", 50, y, { width: 490 });
        y += 13;
      } else {
        Object.entries(vatByRate)
          .filter(([rate]) => parseInt(rate) > 0)
          .forEach(([rate, amount]) => {
            doc.text(`Umsatzsteuer ${rate} %`, sumLabelX, y, { width: 95 });
            doc.text((amount / 100).toFixed(2).replace(".", ",") + " €", sumValueX, y, { width: sumValueWidth, align: "right" });
            y += 13;
          });
      }

      doc.font("Helvetica-Bold");
      doc.text("Gesamtbetrag", sumLabelX, y, { width: 95 });
      doc.text((total / 100).toFixed(2).replace(".", ",") + " €", sumValueX, y, { width: sumValueWidth, align: "right" });

      // Schlusstext
      y += 25;
      doc.fontSize(10).font("Helvetica");
      settings.invoiceFooterText.split("\n").forEach((line) => {
        doc.text(line, 50, y, { width: 500 });
        y += 14;
      });

      // Fußzeile (3 Spalten)
      const currentPageBottom = pageHeight - 50;
      const footerY = Math.min(Math.max(y + 20, currentPageBottom - 80), currentPageBottom - 60);
      doc.fontSize(8).font("Helvetica");
      doc.text(settings.companyName, 50, footerY, { width: 150 });
      doc.text(settings.street, 50, footerY + 10, { width: 150 });
      doc.text(`${settings.zipCode} ${settings.city}`, 50, footerY + 20, { width: 150 });
      doc.text(`Tel.: ${settings.phone}`, 50, footerY + 30, { width: 150 });
      doc.text(settings.email, 50, footerY + 40, { width: 150 });
      if (settings.vatId) doc.text(`USt-IdNr.: ${settings.vatId}`, 220, footerY, { width: 150 });
      if (settings.taxNumber) doc.text(`Steuernummer: ${settings.taxNumber}`, 220, footerY + 10, { width: 150 });
      if (settings.owner) doc.text(`Inh. ${settings.owner}`, 220, footerY + 20, { width: 150 });
      if (settings.owner) doc.text(settings.owner, 390, footerY, { width: 150 });
      if (settings.bankName) doc.text(settings.bankName, 390, footerY + 10, { width: 150 });
      if (settings.iban) doc.text(`IBAN: ${settings.iban}`, 390, footerY + 20, { width: 150 });
      if (settings.bic) doc.text(`BIC: ${settings.bic}`, 390, footerY + 30, { width: 150 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
