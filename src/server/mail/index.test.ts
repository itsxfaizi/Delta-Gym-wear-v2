import { ConsoleMailer } from "./console-mailer";
import { getMailer } from "./index";
import { HttpMailer } from "./http-mailer";

const MAIL_ENV_KEYS = [
  "MAIL_PROVIDER",
  "MAIL_API_KEY",
  "MAIL_API_URL",
  "MAIL_SMTP_HOST",
  "MAIL_SMTP_PORT",
  "MAIL_SMTP_USER",
  "MAIL_SMTP_PASS",
  "MAIL_FROM",
] as const;

const previousMailEnv = Object.fromEntries(MAIL_ENV_KEYS.map((key) => [key, process.env[key]]));

describe("getMailer", () => {
  beforeEach(() => {
    for (const key of MAIL_ENV_KEYS) delete process.env[key];
  });

  afterAll(() => {
    for (const key of MAIL_ENV_KEYS) {
      const value = previousMailEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("keeps console delivery as the default when no provider is configured", () => {
    expect(getMailer()).toBeInstanceOf(ConsoleMailer);
  });

  it("selects SMTP when a complete SMTP configuration is present", () => {
    Object.assign(process.env, {
      MAIL_PROVIDER: "smtp",
      MAIL_SMTP_HOST: "smtp.resend.com",
      MAIL_SMTP_PORT: "465",
      MAIL_SMTP_USER: "resend",
      MAIL_SMTP_PASS: "test-api-key",
      MAIL_FROM: "Delta Gym Wear <orders@mail.deltagymwear.com>",
    });

    expect(getMailer()).not.toBeInstanceOf(ConsoleMailer);
  });

  it("fails closed when SMTP is selected with missing credentials", () => {
    process.env.MAIL_PROVIDER = "smtp";

    expect(() => getMailer()).toThrow("SMTP mail is selected but its configuration is incomplete");
  });

  it("rejects insecure or unsupported SMTP ports", () => {
    Object.assign(process.env, {
      MAIL_PROVIDER: "smtp",
      MAIL_SMTP_HOST: "smtp.resend.com",
      MAIL_SMTP_PORT: "25",
      MAIL_SMTP_USER: "resend",
      MAIL_SMTP_PASS: "test-api-key",
      MAIL_FROM: "orders@mail.deltagymwear.com",
    });

    expect(() => getMailer()).toThrow("SMTP mail is selected but its configuration is incomplete");
  });

  it("fails closed when the HTTP provider is selected with missing credentials", () => {
    process.env.MAIL_PROVIDER = "http";

    expect(() => getMailer()).toThrow("HTTP mail is selected but its configuration is incomplete");
  });

  it("retains the existing HTTP mail provider when configured", () => {
    Object.assign(process.env, {
      MAIL_PROVIDER: "http",
      MAIL_API_KEY: "test-api-key",
      MAIL_FROM: "orders@mail.deltagymwear.com",
    });

    expect(getMailer()).toBeInstanceOf(HttpMailer);
  });
});
