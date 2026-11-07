import 'dotenv/config';
import nodemailer from 'nodemailer';

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function portalUrl() {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export async function sendCredentialEmail(input: {
  to: string;
  name: string;
  roleLabel: string;
  organizationName: string;
  password: string;
}) {
  if (!mailConfigured()) {
    throw new Error('Email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS before creating accounts.');
  }

  const fromAddress = process.env.MAIL_FROM || process.env.SMTP_USER;
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `ORZO <${fromAddress}>`,
    to: input.to,
    subject: 'Your ORZO sign-in credentials',
    text: [
      `Hello ${input.name},`,
      '',
      `An ORZO administrator created your ${input.roleLabel} account for ${input.organizationName}.`,
      '',
      `Email: ${input.to}`,
      `Password: ${input.password}`,
      '',
      `Sign in at ${portalUrl()}`,
    ].join('\n'),
  });
}
