import 'dotenv/config';
import path from 'path';
import nodemailer from 'nodemailer';

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function portalUrl() {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function changePasswordUrl(email: string) {
  return `${portalUrl()}/?change-password=1&email=${encodeURIComponent(email)}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function logoAttachment() {
  return {
    filename: 'orzo-logo.png',
    path: path.resolve(process.cwd(), 'public', 'orzo-logo.png'),
    cid: 'orzo-logo',
  };
}

function passwordButton(email: string, label: string) {
  const href = changePasswordUrl(email);
  return `
    <a href="${escapeHtml(href)}" style="display:inline-block;background:#123c68;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.02em;padding:14px 26px;border-radius:12px;">
      ${escapeHtml(label)}
    </a>
    <p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:#6b7c90;">
      Or open this link:<br />
      <a href="${escapeHtml(href)}" style="color:#168b91;word-break:break-all;">${escapeHtml(href)}</a>
    </p>`;
}

function accountCard(input: { title: string; name: string; email: string; password: string }) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#f4f8fb;border:1px solid #d7e4ef;border-radius:16px;">
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#168b91;">${escapeHtml(input.title)}</p>
          <p style="margin:8px 0 0;font-size:16px;font-weight:700;color:#123c68;">${escapeHtml(input.name)}</p>
          <p style="margin:12px 0 0;font-size:13px;color:#4d6278;"><strong>Email</strong><br />${escapeHtml(input.email)}</p>
          <p style="margin:10px 0 0;font-size:13px;color:#4d6278;"><strong>Temporary password</strong><br />
            <span style="display:inline-block;margin-top:4px;padding:8px 12px;background:#ffffff;border-radius:8px;font-family:Consolas,Menlo,monospace;font-size:15px;color:#123c68;">${escapeHtml(input.password)}</span>
          </p>
          <div style="margin-top:16px;">${passwordButton(input.email, 'Change password')}</div>
        </td>
      </tr>
    </table>`;
}

function emailShell(input: { headline: string; intro: string; body: string }) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#e7f1fb;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e7f1fb;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 18px 50px rgba(18,60,104,0.16);">
            <tr>
              <td style="background:linear-gradient(135deg,#102f52,#155b86 55%,#168b91);padding:32px 28px;text-align:center;">
                <img src="cid:orzo-logo" alt="ORZO" width="92" height="92" style="display:block;margin:0 auto 14px;border-radius:46px;border:3px solid rgba(255,255,255,0.35);" />
                <p style="margin:0;color:#a6eee4;font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;">ORZO Translation</p>
                <h1 style="margin:10px 0 0;color:#ffffff;font-size:28px;line-height:1.2;">${escapeHtml(input.headline)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 8px;color:#24384c;font-size:15px;line-height:1.6;">
                ${input.intro}
                ${input.body}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 28px;color:#6b7c90;font-size:12px;line-height:1.6;">
                The temporary password is replaced as soon as you save a new one. If you were not expecting this message, you can ignore it.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function deliver(input: { to: string; subject: string; text: string; html: string }) {
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
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: [logoAttachment()],
  });
}

export async function sendCredentialEmail(input: {
  to: string;
  name: string;
  roleLabel: string;
  organizationName: string;
  password: string;
}) {
  const link = changePasswordUrl(input.to);
  await deliver({
    to: input.to,
    subject: 'Your ORZO account is ready',
    text: [
      `Hello ${input.name},`,
      '',
      `An ORZO administrator created your ${input.roleLabel} account for ${input.organizationName}.`,
      '',
      `Email: ${input.to}`,
      `Temporary password: ${input.password}`,
      '',
      `Change your password: ${link}`,
    ].join('\n'),
    html: emailShell({
      headline: 'Your account is ready',
      intro: `<p style="margin:0;">Hello ${escapeHtml(input.name)},</p>
        <p style="margin:12px 0 0;">An administrator opened your <strong>${escapeHtml(input.roleLabel)}</strong> account for <strong>${escapeHtml(input.organizationName)}</strong>. Use the temporary password once, then choose the password only you know.</p>`,
      body: accountCard({
        title: input.roleLabel,
        name: input.name,
        email: input.to,
        password: input.password,
      }),
    }),
  });
}

export async function sendOrganizationCredentials(input: {
  to: string;
  adminName: string;
  organizationName: string;
  adminEmail: string;
  adminPassword: string;
  deskName: string;
  deskEmail: string;
  deskPassword: string;
}) {
  await deliver({
    to: input.to,
    subject: `Welcome to ORZO, ${input.organizationName}`,
    text: [
      `Hello ${input.adminName},`,
      '',
      `Both sign-in accounts for ${input.organizationName} are below.`,
      '',
      'Organization admin',
      `Name: ${input.adminName}`,
      `Email: ${input.adminEmail}`,
      `Temporary password: ${input.adminPassword}`,
      `Change password: ${changePasswordUrl(input.adminEmail)}`,
      '',
      'Triage desk',
      `Name: ${input.deskName}`,
      `Email: ${input.deskEmail}`,
      `Temporary password: ${input.deskPassword}`,
      `Change password: ${changePasswordUrl(input.deskEmail)}`,
    ].join('\n'),
    html: emailShell({
      headline: `Welcome, ${input.organizationName}`,
      intro: `<p style="margin:0;">Hello ${escapeHtml(input.adminName)},</p>
        <p style="margin:12px 0 0;">Both accounts for <strong>${escapeHtml(input.organizationName)}</strong> are ready. Each temporary password should be replaced before the desk is used.</p>`,
      body: `${accountCard({
        title: 'Organization admin',
        name: input.adminName,
        email: input.adminEmail,
        password: input.adminPassword,
      })}${accountCard({
        title: 'Triage desk',
        name: input.deskName,
        email: input.deskEmail,
        password: input.deskPassword,
      })}`,
    }),
  });
}
