import "server-only";

import { ConsoleMailer } from "./console-mailer";
import { HttpMailer } from "./http-mailer";
import type { Mailer } from "./types";

export type { EmailMessage, Mailer } from "./types";

/**
 * Provider selection, read directly from process.env (not src/server/env.ts:
 * these are all optional and a missing one must fall back, never throw).
 *
 * - MAIL_PROVIDER=http plus MAIL_API_KEY and MAIL_FROM switches to the Resend-style
 *   HTTP transport. MAIL_API_URL optionally points it at a different provider.
 * - Anything else (including no provider key at all, the default in every
 *   environment today) logs the email to the console instead of sending it.
 */
export function getMailer(): Mailer {
  const provider = process.env.MAIL_PROVIDER?.trim();
  const apiKey = process.env.MAIL_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();

  if (provider === "http" && apiKey && from) {
    return new HttpMailer({ apiKey, from, apiUrl: process.env.MAIL_API_URL?.trim() || undefined });
  }

  return new ConsoleMailer();
}
