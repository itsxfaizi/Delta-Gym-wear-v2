# ADR-004: Order confirmation email delivery

Date: 2026-10-22. Status: implementation accepted; production delivery pending sender-domain verification and credentials.

## Context

Order placement already composes a customer receipt and calls a `Mailer`, but production currently uses the console transport because no provider is configured. The project runs on Vercel and the user selected Resend after comparing free transactional email services.

## Decision

- Add a server-only SMTP adapter using Nodemailer and Resend's authenticated SMTP relay.
- Use direct TLS on port 465 by default. Port 587 is supported only with required STARTTLS.
- Keep HTTP API and console transports available. An unset provider uses console logging; selecting a provider with incomplete settings throws rather than silently dropping delivery configuration.
- Store the SMTP API key only in server environment as `MAIL_SMTP_PASS`; do not commit it, expose it to the browser, or include it in logs.
- Require a verified sender address. Production deployment must wait until a dedicated sender domain is verified and a scoped send-only key is configured.
- Await SMTP delivery in the order path. A delivery error is logged and does not undo a successfully committed COD order.

## Operational plan

1. Implement and test provider selection and SMTP message mapping.
2. Add a Resend sending subdomain and publish the exact DKIM/SPF records that Resend generates.
3. Create a send-only key limited to that verified domain and store it in Vercel production variables.
4. Verify one controlled order confirmation to an authorized test address in Resend's delivery logs.
5. Deploy the configured mailer and recheck a controlled order confirmation.

## Consequences and rollback

Nodemailer adds a small server dependency. SMTP may add a few seconds to order submission, so the send is awaited and has bounded connection timeouts. Provider rejection is observable in server logs, while order placement remains successful. Rollback consists of unsetting `MAIL_PROVIDER` to return to console logging or setting it to `http` with the existing HTTP credentials. Unsetting the provider disables delivery and must be treated as an operational change.

## Scope boundary

This covers the existing order-placement confirmation only. Shipping/status notifications and Supabase Auth mail configuration are separate work. Staff invitation delivery remains behind `DELTA_INVITE_EMAIL_READY` until its dedicated callback/template checks pass.
