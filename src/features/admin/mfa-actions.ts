"use server";

import { z } from "zod";

import { resolveAdminAccess } from "@/server/admin/guard";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { consumeRateLimit } from "@/server/rate-limit";

const verifyCodeSchema = z.object({
  factorId: z.uuid(),
  code: z.string().regex(/^\d{6}$/, "Enter the six-digit code from your authenticator app."),
});

type MfaResult = { ok: true } | { ok: false; message: string };
type EnrollmentResult =
  | { ok: true; factorId: string; qrCode: string; secret: string }
  | { ok: false; message: string };

/** Enrollment is available only after an active staff membership is resolved. */
export async function beginMfaEnrollment(): Promise<EnrollmentResult> {
  const access = await resolveAdminAccess();
  if (access.state !== "mfa_required") {
    return { ok: false, message: "Sign in with your staff account to continue." };
  }
  if (!consumeRateLimit(`mfa-enroll:${access.principal.userId}`, 5, 60 * 60_000).allowed) {
    return { ok: false, message: "Too many setup attempts. Try again later." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError || !factors) return { ok: false, message: "Authenticator setup is unavailable. Try again." };
  if (factors.totp.length > 0) {
    return { ok: false, message: "Use your enrolled authenticator to finish signing in." };
  }

  // An unfinished attempt has no recoverable QR secret after a reload. Clear
  // only unverified TOTP factors before starting a new enrollment.
  for (const factor of factors.all) {
    if (factor.factor_type !== "totp" || factor.status !== "unverified") continue;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) return { ok: false, message: "Could not restart setup. Try again later." };
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Delta staff authenticator",
  });
  if (error || !data?.totp) return { ok: false, message: "Could not start setup. Try again later." };
  return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Supabase verifies the one-time code and promotes this session to AAL2. */
export async function verifyMfaCode(rawInput: unknown): Promise<MfaResult> {
  const parsed = verifyCodeSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, message: "Enter the six-digit code from your authenticator app." };
  }
  const access = await resolveAdminAccess();
  if (access.state !== "mfa_required") {
    return { ok: false, message: "Sign in with your staff account to continue." };
  }
  if (!consumeRateLimit(`mfa-verify:${access.principal.userId}`, 10, 10 * 60_000).allowed) {
    return { ok: false, message: "Too many code attempts. Try again later." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError || !factors?.all.some((factor) =>
    factor.id === parsed.data.factorId && factor.factor_type === "totp"
  )) {
    return { ok: false, message: "Authenticator setup has expired. Start again." };
  }
  const { error } = await supabase.auth.mfa.challengeAndVerify(parsed.data);
  if (error) return { ok: false, message: "That code was not accepted. Try the current code." };
  return { ok: true };
}
