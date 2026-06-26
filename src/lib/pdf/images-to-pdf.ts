import PDFDocument from "pdfkit";

const A4 = { w: 595.28, h: 841.89 }; // Punkte
const MARGIN = 30;

/** Macht aus mehreren Bildern (Buffer, JPEG/PNG) ein PDF – ein Bild pro A4-Seite. */
export function imagesToPdf(images: Buffer[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: MARGIN });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      images.forEach((img, i) => {
        if (i > 0) doc.addPage();
        doc.image(img, MARGIN, MARGIN, {
          fit: [A4.w - 2 * MARGIN, A4.h - 2 * MARGIN],
          align: "center",
          valign: "center",
        });
      });
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
