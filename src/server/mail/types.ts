import "server-only";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/** A transport that can deliver one already-composed email. */
export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}
