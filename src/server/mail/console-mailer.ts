import "server-only";

import type { EmailMessage, Mailer } from "./types";

/**
 * The default transport: no email provider is configured yet, so a "send"
 * just logs the message. Safe in every environment, including CI and a
 * database-less dev box.
 */
export class ConsoleMailer implements Mailer {
  async send(message: EmailMessage): Promise<void> {
    console.info(`[mail] to=${message.to} subject="${message.subject}"`);
    console.info(message.text);
  }
}
