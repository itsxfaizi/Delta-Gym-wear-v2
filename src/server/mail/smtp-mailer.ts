import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import type { EmailMessage, Mailer } from "./types";

export type SmtpMailerConfig = {
  host: string;
  port: 465 | 587;
  user: string;
  password: string;
  from: string;
};

export class SmtpMailer implements Mailer {
  private readonly transporter: Transporter;

  constructor(private readonly config: SmtpMailerConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      requireTLS: config.port === 587,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }
}
