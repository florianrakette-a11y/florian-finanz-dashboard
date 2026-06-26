import nodemailer from "nodemailer";

type Attachment = { filename: string; content: Buffer };

/** Versendet eine Mail über das konfigurierte Strato-SMTP (nur serverseitig). */
export async function sendMail(opts: {
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  attachments?: Attachment[];
}): Promise<void> {
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  await transport.sendMail({
    from: process.env.SMTP_USER,
    to: opts.to.join(", "),
    cc: opts.cc?.length ? opts.cc.join(", ") : undefined,
    subject: opts.subject,
    text: opts.text,
    attachments: opts.attachments,
  });
}
