import "server-only";

import { ConsoleMailer } from "./console-mailer";
import { HttpMailer } from "./http-mailer";
import { SmtpMailer } from "./smtp-mailer";
import type { Mailer } from "./types";

export type { EmailMessage, Mailer } from "./types";

/**
 * Provider selection is read directly from process.env (not src/server/env.ts)
 * because console delivery remains the default when no provider is selected.
 *
 * - MAIL_PROVIDER=smtp selects authenticated SMTP using the MAIL_SMTP_* settings.
 * - MAIL_PROVIDER=http selects the Resend-style HTTP transport using MAIL_API_KEY.
 * - An unset provider logs the email to the console. An explicitly selected but
 *   incomplete or unknown provider throws so production misconfiguration is visible.
 */
export function getMailer(): Mailer {
  const provider = process.env.MAIL_PROVIDER?.trim();
  const from = process.env.MAIL_FROM?.trim();

  if (!provider) return new ConsoleMailer();

  if (provider === "smtp") {
    const host = process.env.MAIL_SMTP_HOST?.trim();
    const portValue = process.env.MAIL_SMTP_PORT?.trim();
    const port = portValue ? Number(portValue) : 0;
    const user = process.env.MAIL_SMTP_USER?.trim();
    const password = process.env.MAIL_SMTP_PASS?.trim();

    if (!host || !from || !user || !password || (port !== 465 && port !== 587)) {
      throw new Error("SMTP mail is selected but its configuration is incomplete");
    }

    return new SmtpMailer({ host, port, user, password, from });
  }

  if (provider === "http") {
    const apiKey = process.env.MAIL_API_KEY?.trim();
    if (!apiKey || !from) {
      throw new Error("HTTP mail is selected but its configuration is incomplete");
    }
    return new HttpMailer({ apiKey, from, apiUrl: process.env.MAIL_API_URL?.trim() || undefined });
  }

  throw new Error(`Unsupported mail provider: ${provider}`);
}
