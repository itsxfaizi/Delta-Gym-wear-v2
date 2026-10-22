import nodemailer from "nodemailer";

import { SmtpMailer } from "./smtp-mailer";

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
}));

const createTransport = jest.mocked(nodemailer.createTransport);

describe("SmtpMailer", () => {
  const sendMail = jest.fn();

  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue({ accepted: ["customer@example.com"] });
    createTransport.mockReset().mockReturnValue({ sendMail } as never);
  });

  it("sends a plain-text and HTML order receipt through authenticated TLS SMTP", async () => {
    const mailer = new SmtpMailer({
      host: "smtp.resend.com",
      port: 465,
      user: "resend",
      password: "test-api-key",
      from: "Delta Gym Wear <orders@mail.deltagymwear.com>",
    });

    await mailer.send({
      to: "customer@example.com",
      subject: "Order DG-240131-0001 confirmed",
      text: "Your order is confirmed.",
      html: "<p>Your order is confirmed.</p>",
    });

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: { user: "resend", pass: "test-api-key" },
    }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: "Delta Gym Wear <orders@mail.deltagymwear.com>",
      to: "customer@example.com",
      subject: "Order DG-240131-0001 confirmed",
      text: "Your order is confirmed.",
      html: "<p>Your order is confirmed.</p>",
    }));
  });

  it("uses required STARTTLS for port 587", async () => {
    const mailer = new SmtpMailer({
      host: "smtp.resend.com",
      port: 587,
      user: "resend",
      password: "test-api-key",
      from: "orders@mail.deltagymwear.com",
    });

    await mailer.send({ to: "customer@example.com", subject: "Test", text: "Test", html: "<p>Test</p>" });

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      port: 587,
      secure: false,
      requireTLS: true,
    }));
  });

  it("propagates a provider rejection so the order handler can log it", async () => {
    const mailer = new SmtpMailer({
      host: "smtp.resend.com",
      port: 465,
      user: "resend",
      password: "test-api-key",
      from: "orders@mail.deltagymwear.com",
    });
    sendMail.mockRejectedValueOnce(new Error("SMTP rejected message"));

    await expect(mailer.send({ to: "customer@example.com", subject: "Test", text: "Test", html: "<p>Test</p>" }))
      .rejects.toThrow("SMTP rejected message");
  });
});
