# ADR-003: Admin release security and retention

Date: 2026-10-21. Status: owner approved; retention procedure implemented, isolated verification and provider checks remain in progress.

## Decisions

- All staff roles, including the owner, must complete TOTP MFA before using the admin console or any admin mutation. An invited staff member first accepts the invite and sets a password, then enrolls and verifies a TOTP factor before admin access.
- Access tokens last one hour. Set a 12-hour inactivity limit and a seven-day maximum session lifetime where the Supabase plan supports those controls. Refresh tokens rotate through Supabase Auth. Sign-out and suspended membership revoke admin access; emergency revocation also ends the Auth session.
- Admin mutations use same-origin CSRF checks in addition to authenticated, role-scoped server validation. The production Auth provider and the application both enforce rate limits for sign-in, password reset, and staff invitations. A process-local application counter alone is insufficient across server instances.
- The initial owner is created only after verifying their email and binding their Supabase Auth user ID to an active owner membership through an operator-controlled database step. User-editable metadata cannot grant a role. Keep a documented recovery procedure that verifies identity before a replacement owner is activated.
- Only the owner may read privileged audit entries. Keep append-only audit entries for one year, with actor, action, target, timestamp, request ID, outcome, and safe before/after data. A maintenance procedure may remove entries after that period; routine app roles cannot update or delete them.
- When an uploaded product photo has no current product reference, retain it for 30 days from the time it became unreferenced, then remove its public Storage object. A still-referenced image is never eligible. Record each cleanup decision and outcome. Product image references are removed independently of the stored object.
- Audit rows remain append-only for routine roles. Migration `0007_audit_retention.sql` grants only `service_role` access to a fixed RPC; it counts on dry run and deletes at most 5,000 rows per invocation only when `created_at` is strictly earlier than the database transaction time minus one calendar year. A trigger rejects deletes outside that path and rejects all product-revision mutations.

## Release verification

Verify the MFA enrollment and challenge flow, invitation acceptance, denied access at AAL1, active membership checks, session settings and revocation, Auth rate limits, same-origin mutation handling, audit access, and the image cleanup clock in an isolated project before promoting the matching application. The approved inactivity and maximum-session limits apply where the plan supports them; document their unavailability on the Free plan without silently upgrading it.

## Consequences and rollback

Staff need an authenticator app and a recovery process. Roll back an application regression by restoring the prior build; do not disable MFA silently after staff accounts have been enrolled. Keep additive audit and media tracking schema during an app rollback. Public image URLs stop serving after cleanup, so a 30-day recovery window and a dry-run report precede deletion. The audit retention RPC is additive and idempotent; on rollback it can remain installed while cron invocation is disabled.

## Staff invitation delivery (2026-10-22)

Staff account creation supports owner-shared one-time invitation links without SMTP. The owner must hold active owner membership and AAL2. Generating a link creates an unconfirmed Auth identity and an invited tenant membership; only accepting the verified project-local link, setting a password, and completing TOTP enables admin access. Existing Auth emails are rejected rather than linked by email. Link credentials are returned only in the successful creation response and never stored in audit metadata. An external Auth/database failure can leave an unbound identity; the app returns no link and never deletes an identity to compensate for this race. An operator verifies ownership before resolving that account.

Email delivery remains optional and independently fails closed behind `DELTA_INVITE_EMAIL_READY`; SMTP delivery to intended recipients must be verified before enabling it. `DELTA_INVITE_REDIRECT_READY` enables only the tested redirect/link acceptance flow. Legacy token-hash template readiness remains unset unless that separate mode has been verified. This delivery method implements the approved staff account scope; membership authorization, password setup, MFA and retention policies are unchanged.
