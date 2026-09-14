import "server-only";

import type { EmailMessage, Mailer } from "./types";

export type HttpMailerConfig = {
  apiKey: string;
  from: string;
  /** Defaults to Resend's send endpoint; override for a different provider with the same {from,to,subject,html,text} body shape. */
  apiUrl?: string;
};

/** Thin adapter for a Resend-style "POST /emails" HTTP mail API. No SDK dependency. */
export class HttpMailer implements Mailer {
  constructor(private readonly config: HttpMailerConfig) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch(this.config.apiUrl ?? "https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Mail provider request failed with ${response.status}: ${body}`);
    }
  }
}
