import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit lädt seine Font-Daten (.afm) zur Laufzeit aus node_modules —
  // nicht bundeln, sonst fehlen die Dateien in der Route.
  serverExternalPackages: ["pdfkit", "nodemailer", "imapflow", "mailparser"],
  // Scan-Uploads (mehrere Fotos als base64) überschreiten das 1-MB-Default für Server Actions.
  experimental: { serverActions: { bodySizeLimit: "15mb" } },
};

export default nextConfig;
