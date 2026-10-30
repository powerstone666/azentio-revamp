import 'server-only';

import nodemailer from 'nodemailer';

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
let checked = false;

export function getSmtpTransport() {
  if (checked) return transport;
  checked = true;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  if (!host || !user || !pass || !from) return null;

  const port = Number(process.env.SMTP_PORT ?? 465);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT must be a valid port number');
  transport = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
  return transport;
}
